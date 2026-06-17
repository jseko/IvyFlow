/**
 * GitHub Copilot `.github/copilot-instructions.md` format — flattens the
 * source markdown into two top-level sections: DO and DO NOT.
 *
 * Extraction strategy (intentionally crude — design.md §9.1 forbids IR/AST):
 *   - lines starting with "✅", "DO ", "MUST", "SHALL"  → DO
 *   - lines starting with "❌", "DO NOT", "MUST NOT", "禁止" → DO NOT
 * Everything else is dropped. ≤ 50 lines.
 */

const DO_PATTERNS = [/^✅/, /^DO /i, /^MUST(?! NOT)/i, /^SHALL(?! NOT)/i];
const DONT_PATTERNS = [/^❌/, /^DO NOT/i, /^MUST NOT/i, /^SHALL NOT/i, /^禁止/];

function classify(line: string): 'do' | 'dont' | null {
  const trimmed = line.replace(/^[-*]\s*/, '').trim();
  if (!trimmed) return null;
  if (DONT_PATTERNS.some((re) => re.test(trimmed))) return 'dont';
  if (DO_PATTERNS.some((re) => re.test(trimmed))) return 'do';
  return null;
}

export function renderRuleAsCopilot(mdContent: string): string {
  const dos: string[] = [];
  const donts: string[] = [];
  for (const raw of mdContent.split('\n')) {
    const kind = classify(raw);
    if (!kind) continue;
    const cleaned = raw.replace(/^[-*]\s*/, '').trim();
    (kind === 'do' ? dos : donts).push(`- ${cleaned}`);
  }
  const out: string[] = ['# IvyFlow phase guard'];
  out.push('', '## DO');
  out.push(dos.length ? dos.join('\n') : '- (no DO rules extracted)');
  out.push('', '## DO NOT');
  out.push(donts.length ? donts.join('\n') : '- (no DO NOT rules extracted)');
  out.push('');
  return out.join('\n');
}
