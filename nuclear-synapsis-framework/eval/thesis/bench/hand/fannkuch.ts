// Fannkuch, written by hand in idiomatic TypeScript (the same program as ../fannkuch.nuc).
export function main(): void {
  const n = 9;
  const perm = Array.from({ length: n }, (_, i) => i);
  const counts = new Array<number>(n).fill(0);
  let maxFlips = 0;
  let checksum = 0;
  let sign = 1;
  let r = n;
  for (;;) {
    for (; r !== 1; r--) counts[r - 1] = r;
    const work = perm.slice();
    let flips = 0;
    for (let k = work[0]; k !== 0; k = work[0]) {
      for (let i = 0, j = k; i < j; i++, j--) {
        const t = work[i];
        work[i] = work[j];
        work[j] = t;
      }
      flips++;
    }
    if (flips > maxFlips) maxFlips = flips;
    checksum += sign * flips;
    sign = -sign;
    let done = true;
    for (; r !== n; r++) {
      const first = perm[0];
      for (let i = 0; i < r; i++) perm[i] = perm[i + 1];
      perm[r] = first;
      if (--counts[r] > 0) {
        done = false;
        break;
      }
    }
    if (done) break;
  }
  console.log(`${checksum} ${maxFlips}`);
}

main();
