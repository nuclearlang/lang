// Texts, written by hand in idiomatic Dart (the same program as ../texts.nuc).
void main() {
  final parts = <String>[for (var i = 0; i < 200000; i++) 'item-${i % 1000}:${i * 7 % 13}'];
  final text = parts.join(';');
  final fields = text.split(';');
  var upper = 0;
  var long = 0;
  for (final f in fields) {
    final pair = f.split(':');
    final name = pair[0].toUpperCase().replaceFirst('ITEM-', '');
    if (name.length == 3) long++;
    if (pair[1] == '0' && f.startsWith('item-1')) upper++;
  }
  print(fields.take(5).map((f) => f.padLeft(12, '.')).join('|'));
  print('length ${text.length} fields ${fields.length} long $long upper $upper');
  print('index ${text.indexOf('item-999')} last ${text.lastIndexOf('item-0:')} has ${text.contains('item-500:')}');
  print(text.substring(0, 40).replaceAll('-', '_').trim());
}
