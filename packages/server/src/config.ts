import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// From dist/ (or src/) → server/ → packages/ → project root
export const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
export const WATCHLIST_PATH = resolve(PROJECT_ROOT, 'watchlist.json');
