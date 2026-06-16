import { describe, it, expect } from 'vitest';
import {
  IvyPhase,
  canTransition,
  isTerminalPhase,
  parsePhase,
  listPhases,
} from './phase-machine.js';

describe('IvyPhase enum', () => {
  it('exposes exactly 5 string values in declared order', () => {
    expect(Object.values(IvyPhase)).toEqual(['open', 'design', 'build', 'verify', 'archive']);
  });

  it('listPhases returns the same canonical order', () => {
    expect(listPhases()).toEqual([
      IvyPhase.OPEN,
      IvyPhase.DESIGN,
      IvyPhase.BUILD,
      IvyPhase.VERIFY,
      IvyPhase.ARCHIVE,
    ]);
  });
});

describe('canTransition — forward path', () => {
  it.each([
    [IvyPhase.OPEN, IvyPhase.DESIGN],
    [IvyPhase.DESIGN, IvyPhase.BUILD],
    [IvyPhase.BUILD, IvyPhase.VERIFY],
    [IvyPhase.VERIFY, IvyPhase.ARCHIVE],
  ])('%s -> %s is legal', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
});

describe('canTransition — rollback paths', () => {
  it.each([
    [IvyPhase.DESIGN, IvyPhase.OPEN],
    [IvyPhase.BUILD, IvyPhase.DESIGN],
    [IvyPhase.VERIFY, IvyPhase.BUILD],
  ])('%s -> %s is legal', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
});

describe('canTransition — illegal skip-aheads and disallowed rollbacks', () => {
  it.each([
    [IvyPhase.OPEN, IvyPhase.BUILD],
    [IvyPhase.OPEN, IvyPhase.VERIFY],
    [IvyPhase.OPEN, IvyPhase.ARCHIVE],
    [IvyPhase.DESIGN, IvyPhase.VERIFY],
    [IvyPhase.DESIGN, IvyPhase.ARCHIVE],
    [IvyPhase.BUILD, IvyPhase.ARCHIVE],
    [IvyPhase.BUILD, IvyPhase.OPEN],
    [IvyPhase.VERIFY, IvyPhase.DESIGN], // explicitly disallowed
    [IvyPhase.VERIFY, IvyPhase.OPEN],
    [IvyPhase.ARCHIVE, IvyPhase.OPEN],
    [IvyPhase.ARCHIVE, IvyPhase.DESIGN],
    [IvyPhase.ARCHIVE, IvyPhase.BUILD],
    [IvyPhase.ARCHIVE, IvyPhase.VERIFY],
  ])('%s -> %s is illegal', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('OPEN -> OPEN is a no-op and not a transition', () => {
    expect(canTransition(IvyPhase.OPEN, IvyPhase.OPEN)).toBe(false);
  });
});

describe('isTerminalPhase', () => {
  it('ARCHIVE is terminal', () => {
    expect(isTerminalPhase(IvyPhase.ARCHIVE)).toBe(true);
  });

  it.each([IvyPhase.OPEN, IvyPhase.DESIGN, IvyPhase.BUILD, IvyPhase.VERIFY])(
    '%s is non-terminal',
    (phase) => {
      expect(isTerminalPhase(phase)).toBe(false);
    },
  );
});

describe('parsePhase', () => {
  it.each([
    ['open', IvyPhase.OPEN],
    ['design', IvyPhase.DESIGN],
    ['build', IvyPhase.BUILD],
    ['verify', IvyPhase.VERIFY],
    ['archive', IvyPhase.ARCHIVE],
  ])('accepts %s', (raw, expected) => {
    expect(parsePhase(raw)).toBe(expected);
  });

  it.each(['', 'implementing', 'OPEN', ' open', 'open ', 'foo'])(
    'rejects %s and returns null',
    (raw) => {
      expect(parsePhase(raw)).toBeNull();
    },
  );
});
