/**
 * Memory Linker — memory record linking (v0.15).
 *
 * Re-exports from knowledge-linking.ts for clean imports under memory/.
 */

export {
  createLink,
  getLinks,
  traverse,
  deleteLink,
  createAutoLink,
} from '../knowledge-linking.js';

export type {
  KnowledgeLink,
  LinkResult,
  LinksQueryResult,
  TraverseStep,
  TraverseResult,
  LinkRelation,
} from '../knowledge-linking.js';
