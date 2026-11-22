// Fannkuch, written by hand in idiomatic Dart (the same program as ../fannkuch.nuc).
void main() {
  const n = 9;
  final perm = List<int>.generate(n, (i) => i);
  final counts = List<int>.filled(n, 0);
  var maxFlips = 0;
  var checksum = 0;
  var sign = 1;
  var r = n;
  while (true) {
    for (; r != 1; r--) {
      counts[r - 1] = r;
    }
    final work = List<int>.of(perm);
    var flips = 0;
    for (var k = work[0]; k != 0; k = work[0]) {
      for (var i = 0, j = k; i < j; i++, j--) {
        final t = work[i];
        work[i] = work[j];
        work[j] = t;
      }
      flips++;
    }
    if (flips > maxFlips) maxFlips = flips;
    checksum += sign * flips;
    sign = -sign;
    var done = true;
    for (; r != n; r++) {
      final first = perm[0];
      for (var i = 0; i < r; i++) {
        perm[i] = perm[i + 1];
      }
      perm[r] = first;
      if (--counts[r] > 0) {
        done = false;
        break;
      }
    }
    if (done) break;
  }
  print('$checksum $maxFlips');
}
