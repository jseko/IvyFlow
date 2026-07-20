function getWidth(requested?: number): number {
  if (requested) return Math.max(40, requested);
  const cols = process.stdout.columns ?? 80;
  return Math.min(Math.max(cols, 80), 120);
}

export function borderTop(width: number): string {
  return `┌${'─'.repeat(width)}┐`;
}

export function borderMid(width: number): string {
  return `├${'─'.repeat(width)}┤`;
}

export function borderBottom(width: number): string {
  return `└${'─'.repeat(width)}┘`;
}

export function sectionHeader(title: string, width: number): string {
  return `│ ${title.padEnd(width - 2)} │`;
}

export function center(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

export function box(title: string, content: string, width?: number): string {
  const w = getWidth(width);
  const top = `┌─ ${title} ${'─'.repeat(Math.max(0, w - title.length - 6))}┐`;
  const bottom = `└${'─'.repeat(w - 2)}┘`;
  const lines = content.split('\n').map((l) => `│ ${l.padEnd(w - 4)} │`);
  return [top, ...lines, bottom].join('\n');
}

export function row(label: string, value: string | number, width?: number): string {
  const w = getWidth(width);
  const content = `${label}${value}`;
  return content.length > w - 4 ? content.slice(0, w - 7) + '...' : content;
}

export function bar(label: string, value: number, max: number, width?: number): string {
  const w = getWidth(width);
  const barW = Math.max(0, w - 30);
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const filled = Math.round(ratio * barW);
  const bar = '█'.repeat(filled) + '░'.repeat(barW - filled);
  const pct = max > 0 ? `${Math.round(ratio * 100)}%` : '0%';
  return `${label.padEnd(20)} ${bar} ${pct}`;
}

export function table(headers: string[], rows: string[][], width?: number): string {
  const w = getWidth(width);
  const colW = Math.floor((w - 4 - (headers.length - 1) * 3) / headers.length);
  const pad = (s: string) => s.slice(0, colW - 1).padEnd(colW);
  const header = headers.map(pad).join(' │ ');
  const sep = '─'.repeat(w - 4);
  const body = rows.map((r) => r.map(pad).join(' │ ')).join('\n');
  return [header, sep, body].join('\n');
}

export function section(title: string, content: string, width?: number): string {
  const w = getWidth(width);
  const line = '─'.repeat(Math.min(title.length + 4, w - 4));
  return `\n${line}\n  ${title}\n${line}\n${content}`;
}
