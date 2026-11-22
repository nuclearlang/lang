// Binary trees, written by hand in idiomatic Dart (the same program as ../binarytrees.nuc).
class Tree {
  final Tree? left;
  final Tree? right;
  const Tree(this.left, this.right);
}

Tree build(int depth) => depth == 0 ? const Tree(null, null) : Tree(build(depth - 1), build(depth - 1));

int count(Tree t) {
  final l = t.left;
  final r = t.right;
  if (l == null || r == null) return 1;
  return 1 + count(l) + count(r);
}

void main() {
  const maxDepth = 16;
  print('stretch ${count(build(maxDepth + 1))}');
  final long = build(maxDepth);
  for (var depth = 4; depth <= maxDepth; depth += 4) {
    final rounds = 1 << (maxDepth - depth + 4);
    var total = 0;
    for (var i = 0; i < rounds; i++) {
      total += count(build(depth));
    }
    print('$rounds trees of depth $depth: $total');
  }
  print('long lived ${count(long)}');
}
