/**
 * Cursor `.mdc` rule format — wraps the source markdown in a YAML frontmatter
 * block recognized by Cursor's rule loader. ≤ 30 lines (design.md §9.1).
 */

const FRONTMATTER = [
  '---',
  'description: IvyFlow phase guard — enforces 9-step workflow per phase',
  'globs: ["**/*"]',
  'alwaysApply: true',
  '---',
  '',
].join('\n');

export function renderRuleAsMdc(mdContent: string): string {
  return FRONTMATTER + mdContent.replace(/\r\n/g, '\n');
}
