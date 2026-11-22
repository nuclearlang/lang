// A data pipeline, written by hand in idiomatic TypeScript (the same program as ../pipeline.nuc).
interface Order {
  id: number;
  customer: string;
  amount: number;
  paid: boolean;
}

const next = (seed: number): number => (seed * 48271) % 2147483647;

export function main(): void {
  const names = ['ana', 'luis', 'eva', 'bob', 'zoe', 'max', 'kim', 'sam'];
  const orders: Order[] = [];
  let seed = 7;
  for (let i = 0; i < 300000; i++) {
    seed = next(seed);
    orders.push({ id: i, customer: names[seed % names.length], amount: seed % 1000, paid: seed % 3 !== 0 });
  }
  const paid = orders.filter((o) => o.paid);
  const total = paid.reduce((sum, o) => sum + o.amount, 0);
  const big = paid.filter((o) => o.amount > 900).length;
  const byCustomer = new Map<string, Order[]>();
  for (const o of paid) {
    const group = byCustomer.get(o.customer);
    if (group) group.push(o);
    else byCustomer.set(o.customer, [o]);
  }
  const ranked = [...byCustomer.keys()].sort((a, b) => byCustomer.get(b)!.length - byCustomer.get(a)!.length);
  for (const c of ranked.slice(0, 3)) {
    const group = byCustomer.get(c)!;
    console.log(`${c} ${group.length} ${group.reduce((m, o) => Math.max(m, o.amount), 0)}`);
  }
  const top = [...paid].sort((a, b) => b.amount - a.amount || a.id - b.id).slice(0, 3).map((o) => o.id);
  console.log(`total ${total} big ${big} top ${top.join(',')}`);
  const unique = new Set(orders.map((o) => o.amount % 97)).size;
  console.log(`any ${orders.some((o) => o.amount === 999)} all ${orders.every((o) => o.amount < 1000)} unique ${unique}`);
}

main();
