import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Messages = Record<string, unknown>;

let cachedMessages: Map<string, Messages> = new Map();

function getI18nDir(): string {
  if (process.env.IVYFLOW_ASSETS_DIR) {
    return path.join(process.env.IVYFLOW_ASSETS_DIR, 'i18n');
  }
  return path.resolve(__dirname, '..', '..', 'assets', 'i18n');
}

function loadMessages(locale: string): Messages {
  if (cachedMessages.has(locale)) {
    return cachedMessages.get(locale)!;
  }

  // Check embedded assets first
  if (typeof (globalThis as Record<string, unknown>).__ivyflow_assets !== 'undefined') {
    const assets = (globalThis as Record<string, unknown>).__ivyflow_assets as Record<string, string>;
    const key = `i18n/${locale}.json`;
    if (assets[key]) {
      try {
        const msgs = JSON.parse(assets[key]);
        cachedMessages.set(locale, msgs);
        return msgs;
      } catch { /* fall through */ }
    }
  }

  // Fall back to filesystem
  const filePath = path.join(getI18nDir(), `${locale}.json`);
  if (existsSync(filePath)) {
    try {
      const msgs = JSON.parse(readFileSync(filePath, 'utf-8'));
      cachedMessages.set(locale, msgs);
      return msgs;
    } catch { /* fall through */ }
  }

  return {};
}

export function t(key: string, locale: string = 'zh-CN', params?: Record<string, string | number>): string {
  const msgs = loadMessages(locale);
  const keys = key.split('.');
  let value: unknown = msgs;
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // fallback to key itself
    }
  }

  if (typeof value !== 'string') return key;

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
  }

  return value;
}
