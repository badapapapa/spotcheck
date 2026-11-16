// A small seeded pseudo-random generator (mulberry32), so the isolation
// forest and the synthetic tests give the same results on every run.
// Not for anything security-related.

/** A function returning numbers in [0, 1), fixed by `seed`. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [0, n). */
export function randomInt(rand: () => number, n: number): number {
  return Math.floor(rand() * n);
}
