// An isolation forest (Liu, Ting and Zhou, 2008), seeded so its scores are
// the same on every run. Each tree splits a random sample on random features
// at random points; a point that is isolated in few splits is unusual. The
// score is 2^(−mean depth / c(n)): near 1 for points isolated at once, about
// 0.5 or below for ordinary ones.

import { randomInt, seeded } from "./rng.ts";

type Node =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: Node; right: Node };

export type Forest = { trees: Node[]; sampleSize: number };

/** Average depth of an unsuccessful search in a binary tree of n points. */
export function c(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

function build(
  rows: number[][],
  depth: number,
  maxDepth: number,
  rand: () => number,
): Node {
  if (depth >= maxDepth || rows.length <= 1)
    return { leaf: true, size: rows.length };
  const dims = rows[0]!.length;
  // Try features in a random order until one has a range to split.
  const order = Array.from({ length: dims }, (_, i) => i);
  for (let i = dims - 1; i > 0; i--) {
    const j = randomInt(rand, i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (const feature of order) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      lo = Math.min(lo, r[feature]!);
      hi = Math.max(hi, r[feature]!);
    }
    if (hi <= lo) continue;
    const split = lo + rand() * (hi - lo);
    return {
      leaf: false,
      feature,
      split,
      left: build(
        rows.filter((r) => r[feature]! < split),
        depth + 1,
        maxDepth,
        rand,
      ),
      right: build(
        rows.filter((r) => r[feature]! >= split),
        depth + 1,
        maxDepth,
        rand,
      ),
    };
  }
  return { leaf: true, size: rows.length };
}

/** Builds `trees` trees, each on a random sample of `sampleSize` rows. */
export function fitForest(
  rows: readonly number[][],
  { trees = 100, sampleSize = 256, seed = 1 } = {},
): Forest {
  const rand = seeded(seed);
  const n = Math.min(sampleSize, rows.length);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, n)));
  const out: Node[] = [];
  for (let t = 0; t < trees; t++) {
    const sample = Array.from(
      { length: n },
      () => rows[randomInt(rand, rows.length)]!,
    );
    out.push(build(sample, 0, maxDepth, rand));
  }
  return { trees: out, sampleSize: n };
}

function pathLength(node: Node, x: readonly number[], depth: number): number {
  if (node.leaf) return depth + c(node.size);
  return pathLength(
    x[node.feature]! < node.split ? node.left : node.right,
    x,
    depth + 1,
  );
}

/** The anomaly score of `x`, in (0, 1]. */
export function score(forest: Forest, x: readonly number[]): number {
  const mean =
    forest.trees.reduce((s, t) => s + pathLength(t, x, 0), 0) /
    forest.trees.length;
  return 2 ** (-mean / c(forest.sampleSize));
}
