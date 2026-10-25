import { describe, expect, it } from 'vitest';
import { createRng, nextRn } from '../../src/core/rng';

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed and a different one for another seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 20 }, () => nextRn(a, 'test'));
    const seqB = Array.from({ length: 20 }, () => nextRn(b, 'test'));
    const seqC = Array.from({ length: 20 }, () => nextRn(c, 'test'));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('returns integers in 0..99 with a roughly uniform spread', () => {
    const rng = createRng(7);
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 10000; i++) {
      const rn = nextRn(rng, 'spread');
      expect(Number.isInteger(rn) && rn >= 0 && rn <= 99).toBe(true);
      counts[Math.floor(rn / 10)]! += 1;
    }
    for (const count of counts) expect(count).toBeGreaterThan(850);
  });

  it('logs every consumed RN with its reason', () => {
    const rng = createRng(1);
    const first = nextRn(rng, 'hit');
    const second = nextRn(rng, 'crit');
    expect(rng.log).toEqual([
      { value: first, reason: 'hit' },
      { value: second, reason: 'crit' },
    ]);
  });

  it('is plain data: a structured clone continues the same sequence', () => {
    const rng = createRng(99);
    nextRn(rng, 'warmup');
    const copy = structuredClone(rng);
    expect(nextRn(copy, 'x')).toBe(nextRn(rng, 'x'));
  });
});
