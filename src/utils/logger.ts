// Logger writes to console intentionally; no eslint disable needed because
// the project's eslint config does not enable no-console.

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function paint(color: keyof typeof COLORS, msg: string): string {
  if (process.env.NO_COLOR || !process.stdout.isTTY) return msg;
  return `${COLORS[color]}${msg}${COLORS.reset}`;
}

export const logger = {
  info(msg: string): void {
    console.log(msg);
  },
  success(msg: string): void {
    console.log(paint('green', `✓ ${msg}`));
  },
  warn(msg: string): void {
    console.warn(paint('yellow', `⚠ ${msg}`));
  },
  error(msg: string): void {
    console.error(paint('red', `✗ ${msg}`));
  },
  step(msg: string): void {
    console.log(paint('blue', `▸ ${msg}`));
  },
  dim(msg: string): void {
    console.log(paint('gray', msg));
  },
  header(msg: string): void {
    console.log(`\n${paint('blue', msg)}`);
  },
  divider(): void {
    console.log(paint('gray', '─'.repeat(60)));
  },
};
