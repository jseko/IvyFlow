import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export function getLocalVersion(): string {
  const { version } = require('../../package.json');
  return version as string;
}
