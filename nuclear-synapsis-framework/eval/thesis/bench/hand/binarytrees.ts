// Binary trees, written by hand in idiomatic TypeScript (the same program as ../binarytrees.nuc).
class Tree {
  constructor(public left: Tree | null, public right: Tree | null) {}
}

function build(depth: number): Tree {
  return depth === 0 ? new Tree(null, null) : new Tree(build(depth - 1), build(depth - 1));
}

function count(t: Tree): number {
  if (t.left === null || t.right === null) return 1;
  return 1 + count(t.left) + count(t.right);
}

export function main(): void {
  const maxDepth = 16;
  console.log(`stretch ${count(build(maxDepth + 1))}`);
  const long = build(maxDepth);
  for (let depth = 4; depth <= maxDepth; depth += 4) {
    const rounds = 1 << (maxDepth - depth + 4);
    let total = 0;
    for (let i = 0; i < rounds; i++) total += count(build(depth));
    console.log(`${rounds} trees of depth ${depth}: ${total}`);
  }
  console.log(`long lived ${count(long)}`);
}

main();
