import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// package.json is the single source of truth for the server version.
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

export const VERSION = manifest.version;
