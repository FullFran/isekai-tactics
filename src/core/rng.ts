/** One consumed random number and why it was drawn (`hit`, `crit`, `levelup:str`...). */
export interface RnEntry {
  value: number;
  reason: string;
}

/**
 * Seeded PRNG (mulberry32) kept as plain data so battle state can be cloned,
 * serialised and replayed. `log` records every consumed RN.
 */
export interface Rng {
  seed: number;
  state: number;
  log: RnEntry[];
}

export function createRng(seed: number): Rng {
  return { seed: seed >>> 0, state: seed >>> 0, log: [] };
}

function nextUint32(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let z = rng.state;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return (z ^ (z >>> 14)) >>> 0;
}

/** Draws one RN in 0..99 and logs it. */
export function nextRn(rng: Rng, reason: string): number {
  const value = Math.floor((nextUint32(rng) / 2 ** 32) * 100);
  rng.log.push({ value, reason });
  return value;
}
