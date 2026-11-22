// A data pipeline, written by hand in idiomatic Dart (the same program as ../pipeline.nuc).
class Order {
  final int id;
  final String customer;
  final int amount;
  final bool paid;
  const Order(this.id, this.customer, this.amount, this.paid);
}

int next(int seed) => (seed * 48271) % 2147483647;

void main() {
  const names = ['ana', 'luis', 'eva', 'bob', 'zoe', 'max', 'kim', 'sam'];
  final orders = <Order>[];
  var seed = 7;
  for (var i = 0; i < 300000; i++) {
    seed = next(seed);
    orders.add(Order(i, names[seed % names.length], seed % 1000, seed % 3 != 0));
  }
  final paid = orders.where((o) => o.paid).toList();
  final total = paid.fold(0, (sum, o) => sum + o.amount);
  final big = paid.where((o) => o.amount > 900).length;
  final byCustomer = <String, List<Order>>{};
  for (final o in paid) {
    (byCustomer[o.customer] ??= []).add(o);
  }
  final ranked = byCustomer.keys.toList()..sort((a, b) => byCustomer[b]!.length.compareTo(byCustomer[a]!.length));
  for (final c in ranked.take(3)) {
    final group = byCustomer[c]!;
    final max = group.fold(0, (m, o) => o.amount > m ? o.amount : m);
    print('$c ${group.length} $max');
  }
  final sorted = [...paid]..sort((a, b) => b.amount != a.amount ? b.amount.compareTo(a.amount) : a.id.compareTo(b.id));
  final top = sorted.take(3).map((o) => o.id);
  print('total $total big $big top ${top.join(',')}');
  final unique = orders.map((o) => o.amount % 97).toSet().length;
  print('any ${orders.any((o) => o.amount == 999)} all ${orders.every((o) => o.amount < 1000)} unique $unique');
}
