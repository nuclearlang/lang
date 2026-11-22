// Calls, written by hand in idiomatic TypeScript (the same program as ../dispatch.nuc).
interface Shape {
  area(): number;
}

class Square implements Shape {
  constructor(private side: number) {}
  area(): number {
    return this.side * this.side;
  }
}

class Rect implements Shape {
  constructor(private w: number, private h: number) {}
  area(): number {
    return this.w * this.h;
  }
}

class Tri implements Shape {
  constructor(private b: number, private h: number) {}
  area(): number {
    return Math.trunc((this.b * this.h) / 2);
  }
}

type Fn = (x: number) => number;
const adder = (n: number): Fn => (x) => x + n;
const compose = (f: Fn, g: Fn): Fn => (x) => g(f(x));

export function main(): void {
  const shapes: Shape[] = [];
  for (let i = 0; i < 1000; i++) {
    shapes.push(i % 3 === 0 ? new Square(i % 7) : i % 3 === 1 ? new Rect(i % 5, i % 11) : new Tri(i % 13, i % 4));
  }
  let total = 0;
  for (let round = 0; round < 1000; round++) {
    for (const s of shapes) total += s.area();
  }
  const f = compose(adder(3), compose((x) => x * 2, adder(-1)));
  let acc = 0;
  for (let i = 0; i < 2000000; i++) acc = (acc + f(i)) % 1000003;
  let count = 0;
  const bump = (): void => {
    count++;
  };
  for (let i = 0; i < 500000; i++) bump();
  console.log(`${total} ${acc} ${count}`);
}

main();
