/**
 * Knowledge Extractor — reads proposal.md, design.md, and tasks.md from a
 * change directory and extracts structured knowledge records using regex
 * pattern matching on structured headings.
 *
 * Design constraints (NO AI, NO inference):
 * - Regex-only extraction from ## Decision, ## Constraints, ## Risk headings
 * - Only 4 extractable types: decision, constraint, risk, fact
 * - FORBIDDEN types: summary, recommendation, analysis
 * - Deterministic: same documents → same output
 * - Graceful degradation: empty/missing docs → empty arrays
 */

import path from 'path';

import { readFile, fileExists, readDir } from '../utils/fs.js';
import type {
  ProjectKnowledge,
  DecisionRecord,
  ConstraintRecord,
  RiskRecord,
  FactRecord,
} from './types.js';

// ─── Extractable Types ───

const FORBIDDEN_HEADINGS = [
  /^##\s+Summary/i,
  /^##\s+Recommendation/i,
  /^##\s+Analysis/i,
  /^##\s+Trade.?off/i,
];

// ─── Public API ───

export interface KnowledgeExtractorOptions {
  changeDir: string;   // openspec/changes/<name>/
}

/**
 * Extract structured knowledge from change documents.
 * Returns a ProjectKnowledge object with 4 typed arrays.
 * Always returns a valid object — never throws.
 */
export async function extractKnowledge(opts: KnowledgeExtractorOptions): Promise<ProjectKnowledge> {
  const { changeDir } = opts;
  const knowledge: ProjectKnowledge = {
    decisions: [],
    constraints: [],
    risks: [],
    facts: [],
  };

  const files = await readDir(changeDir);
  const docFiles = files.filter((f) =>
    ['proposal.md', 'design.md', 'tasks.md'].includes(f),
  );

  for (const file of docFiles) {
    const filePath = path.join(changeDir, file);
    const content = await readFile(filePath).catch(() => '');

    if (!content) continue;

    const sections = splitIntoSections(content);

    for (const { heading, body } of sections) {
      // Skip forbidden sections
      if (isForbiddenSection(heading)) continue;

      // Extract by heading pattern
      if (/^##\s+Decision/i.test(heading) || /^##\s+Key Decision/i.test(heading) || /^##\s+Architecture Decision/i.test(heading) || /^##\s+ADR/i.test(heading)) {
        knowledge.decisions.push(...extractDecisions(body, file));
      }

      if (/^##\s+Constraint/i.test(heading)) {
        knowledge.constraints.push(...extractConstraints(body, file));
      }

      if (/^##\s+Risk/i.test(heading)) {
        knowledge.risks.push(...extractRisks(body, file));
      }

      if (/^##\s+Facts?/i.test(heading) || /^##\s+Technical Facts?/i.test(heading) || /^##\s+Assumptions?/i.test(heading)) {
        knowledge.facts.push(...extractFacts(body, file));
      }
    }

    // Special case: extract completed task facts from tasks.md
    if (file === 'tasks.md') {
      const completedTasks = extractCompletedTasks(content);
      for (const task of completedTasks) {
        knowledge.facts.push({
          id: nextId('FAC'),
          description: task,
          source: file,
          category: 'convention',
        });
      }
    }
  }

  return knowledge;
}

// ─── Section Splitting ───

interface Section {
  heading: string;
  body: string;
}

function splitIntoSections(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');
  let currentHeading = '';
  let currentBody: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (inSection) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
      }
      currentHeading = line.trim();
      currentBody = [];
      inSection = true;
    } else if (inSection) {
      currentBody.push(line);
    }
  }

  if (inSection) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
  }

  return sections;
}

function isForbiddenSection(heading: string): boolean {
  return FORBIDDEN_HEADINGS.some((re) => re.test(heading));
}

// ─── Extractors ───

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter++;
  const padded = String(idCounter).padStart(3, '0');
  return `${prefix}-${padded}`;
}

function extractDecisions(body: string, source: string): DecisionRecord[] {
  const records: DecisionRecord[] = [];
  const items = extractListItems(body);

  for (const item of items) {
    const match = item.match(/^(.*?)[:：]\s*(.+)/);
    if (match) {
      records.push({
        id: nextId('DEC'),
        title: match[1].trim(),
        description: match[2].trim(),
        date: new Date().toISOString().split('T')[0],
        source,
        status: 'accepted',
      });
    } else if (item.length > 5) {
      records.push({
        id: nextId('DEC'),
        title: item.trim().substring(0, 60),
        description: item.trim(),
        date: new Date().toISOString().split('T')[0],
        source,
        status: 'accepted',
      });
    }
  }

  return records;
}

function extractConstraints(body: string, source: string): ConstraintRecord[] {
  const records: ConstraintRecord[] = [];
  const items = extractListItems(body);

  for (const item of items) {
    const severity: 'must' | 'should' | 'may' =
      /must|必须|requir|需要|强制/i.test(item) ? 'must' :
      /should|建议|推荐/i.test(item) ? 'should' : 'must';

    records.push({
      id: nextId('CON'),
      description: item.trim(),
      source,
      severity,
    });
  }

  return records;
}

function extractRisks(body: string, source: string): RiskRecord[] {
  const records: RiskRecord[] = [];
  const items = extractListItems(body);

  for (const item of items) {
    // Try to extract: "Risk description — Mitigation: ..."
    const parts = item.split(/[—\-–]?\s*(Mitigation|缓解|应对)[:：]/i);
    const description = (parts[0] ?? item).trim();
    const mitigation = parts.length > 2 ? parts.slice(1).join(':').replace(/^(Mitigation|缓解|应对)[:：]/i, '').trim() : undefined;

    const impact: 'high' | 'medium' | 'low' =
      /high|严重|高/i.test(description) ? 'high' :
      /low|轻微|低/i.test(description) ? 'low' : 'medium';

    records.push({
      id: nextId('RSK'),
      description,
      source,
      impact,
      mitigation,
    });
  }

  return records;
}

function extractFacts(body: string, source: string): FactRecord[] {
  const records: FactRecord[] = [];
  const items = extractListItems(body);

  for (const item of items) {
    const category: FactRecord['category'] =
      /tech|stack|framework|language|库|框架|语言/i.test(item) ? 'techStack' :
      /depend|npm|package|依赖|包/i.test(item) ? 'dependency' :
      /convention|style|规范|风格/i.test(item) ? 'convention' :
      /env|node|git|环境/i.test(item) ? 'environment' : 'other';

    records.push({
      id: nextId('FAC'),
      description: item.trim(),
      source,
      category,
    });
  }

  return records;
}

/**
 * Extract completed task descriptions from tasks.md content.
 * Matches `- [x]` markers (case-insensitive, handles `[X]` too).
 * Returns trimmed task descriptions, deduplicated.
 */
function extractCompletedTasks(content: string): string[] {
  const tasks: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[[xX]\]\s+(.+)/);
    if (match) {
      const desc = match[1].trim();
      if (desc && !tasks.includes(desc)) {
        tasks.push(desc);
      }
    }
  }

  return tasks;
}

// ─── Helpers ───

/**
 * Extract list items from markdown section body.
 * Handles: - item, * item, 1. item, or plain paragraph lines.
 */
function extractListItems(body: string): string[] {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];

  for (const line of lines) {
    const listMatch = line.match(/^[-*]\s+(.+)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
    if (listMatch) {
      items.push(listMatch[1]);
    } else if (numberedMatch) {
      items.push(numberedMatch[1]);
    } else if (line.length > 10 && !line.startsWith('<!--')) {
      items.push(line);
    }
  }

  return items;
}
