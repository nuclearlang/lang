// Calls, written by hand in idiomatic Dart (the same program as ../dispatch.nuc).
abstract interface class Shape {
  int area();
}

class Square implements Shape {
  final int side;
  const Square(this.side);
  @override
  int area() => side * side;
}

class Rect implements Shape {
  final int w, h;
  const Rect(this.w, this.h);
  @override
  int area() => w * h;
}

class Tri implements Shape {
  final int b, h;
  const Tri(this.b, this.h);
  @override
  int area() => b * h ~/ 2;
}

typedef Fn = int Function(int x);
Fn adder(int n) => (x) => x + n;
Fn compose(Fn f, Fn g) => (x) => g(f(x));

void main() {
  final shapes = <Shape>[
    for (var i = 0; i < 1000; i++)
      i % 3 == 0 ? Square(i % 7) : i % 3 == 1 ? Rect(i % 5, i % 11) : Tri(i % 13, i % 4),
  ];
  var total = 0;
  for (var round = 0; round < 1000; round++) {
    for (final s in shapes) {
      total += s.area();
    }
  }
  final f = compose(adder(3), compose((x) => x * 2, adder(-1)));
  var acc = 0;
  for (var i = 0; i < 2000000; i++) {
    acc = (acc + f(i)) % 1000003;
  }
  var count = 0;
  void bump() => count++;
  for (var i = 0; i < 500000; i++) {
    bump();
  }
  print('$total $acc $count');
}
