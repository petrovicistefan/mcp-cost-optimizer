const PRODUCT = 'cost-optimizer';

export function assertControlPlaneUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) {
    throw new Error('CONTROL_PLANE_URL must be an http(s) URL');
  }
  return baseUrl.replace(/\/$/, '');
}

/** Reserve quota units before a billable hosted op. Never send usage records or rates. */
export async function consume({ baseUrl, apiKey, requestId, units = 1, product = PRODUCT, fetchImpl = fetch, timeoutMs = 10000 }) {
  const root = assertControlPlaneUrl(baseUrl);
  if (typeof apiKey !== 'string' || !apiKey) return { ok: false, status: 401, error: 'unauthorized' };
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) {
    return { ok: false, status: 400, error: 'invalid_request_id' };
  }
  if (!Number.isSafeInteger(units) || units < 1) return { ok: false, status: 400, error: 'invalid_units' };

  const payload = { product, requestId, units };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${root}/v1/usage/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (response.status === 200 && body?.allowed) {
      return { ok: true, status: 200, duplicate: Boolean(body.duplicate), used: body.used, limit: body.limit, payload };
    }
    if (response.status === 429) return { ok: false, status: 429, error: 'quota_exceeded', used: body?.used, limit: body?.limit, payload };
    if (response.status === 409) return { ok: false, status: 409, error: 'request_id_conflict', payload };
    if (response.status === 401) return { ok: false, status: 401, error: 'unauthorized', payload };
    return { ok: false, status: response.status >= 400 ? response.status : 502, error: body?.error ?? 'control_plane_error', payload };
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return { ok: false, status: 502, error: aborted ? 'control_plane_timeout' : 'control_plane_unreachable', payload };
  } finally {
    clearTimeout(timer);
  }
}
