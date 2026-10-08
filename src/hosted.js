import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { analyzeUsage, compareModels, estimateCost } from './core.js';
import { assertControlPlaneUrl, consume } from './control-plane-client.js';

const PRODUCT = 'cost-optimizer';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const MAX_BODY = 8 * 1024 * 1024;
const ROUTES = new Map([
  ['/v1/estimate', body => estimateCost(body.record, body.rates)],
  ['/v1/analyze', body => analyzeUsage(body.records, body.rates)],
  ['/v1/compare', body => compareModels(body.records, body.rates, body.targetModel)],
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'body_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) throw new HttpError(400, 'invalid_json');
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    return body;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

function bearer(req) {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ') || !auth.slice(7)) throw new HttpError(401, 'unauthorized');
  return auth.slice(7);
}

export function createHostedServer({ controlPlaneUrl, consumeImpl = consume, fetchImpl }) {
  const baseUrl = assertControlPlaneUrl(controlPlaneUrl);
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(body));
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/health' && req.method === 'GET') return send(200, { status: 'ok' });

      const apiKey = bearer(req);
      const run = ROUTES.get(path);
      if (req.method !== 'POST' || !run) throw new HttpError(404, 'not_found');

      const body = await readBody(req);
      if (!validId(body.requestId)) throw new HttpError(400, 'invalid_request_id');
      const units = body.units === undefined ? 1 : body.units;
      if (!Number.isSafeInteger(units) || units < 1) throw new HttpError(400, 'invalid_units');

      const reservation = await consumeImpl({ baseUrl, apiKey, requestId: body.requestId, units, fetchImpl });
      if (!reservation.ok) {
        const status = reservation.status === 429 || reservation.status === 401 || reservation.status === 409
          ? reservation.status
          : reservation.status >= 400 && reservation.status < 600 ? reservation.status : 502;
        throw new HttpError(status, reservation.error ?? 'control_plane_error');
      }

      let report;
      try {
        report = run(body);
      } catch (error) {
        throw new HttpError(400, error.message || 'analysis_failed');
      }

      return send(200, {
        report,
        usage: {
          product: PRODUCT,
          requestId: body.requestId,
          units,
          duplicate: reservation.duplicate,
          used: reservation.used,
          limit: reservation.limit,
        },
      });
    } catch (error) {
      if (!error.status) console.error('Hosted request failure:', error.code ?? error.name);
      send(error.status ?? 500, { error: error.status ? error.message : 'internal_error' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createHostedServer({ controlPlaneUrl: process.env.CONTROL_PLANE_URL });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.PORT ?? 3102), process.env.HOST ?? '127.0.0.1', () => {
    console.log('Cost Optimizer hosted listening');
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
