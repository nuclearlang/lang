import 'dart:convert';

import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:synapsis/synapsis.dart';
import 'package:synapsis/testing.dart';

/// A model with exact fields as the transpiler writes it (`@BigIntJson()`, `@BigDoubleJson()`).
class Balance {
  const Balance({this.id, required this.code, required this.amount});

  factory Balance.fromJson(Map<String, dynamic> j) => Balance(
    id: j['id'] as int?,
    code: const BigIntJson().fromJson(j['code']),
    amount: const BigDoubleJson().fromJson(j['amount']),
  );

  final int? id;
  final BigInt code;
  final Decimal amount;

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': const BigIntJson().toJson(code),
    'amount': const BigDoubleJson().toJson(amount),
  };
}

class BalancesConfig extends AppConfig {
  @override
  final List<Connection> connections = [Http(baseUrl: 'https://api.test/')];
}

void main() {
  group('the JSON of an exact number', () {
    test('a text both ways, the language toString()', () {
      final b = Balance.fromJson({'code': '12345678901234567890123', 'amount': ' 0.30 '});
      expect(b.code, BigInt.parse('12345678901234567890123'));
      expect(b.amount + Decimal.parse('0.1'), Decimal.parse('0.4'));
      expect(b.toJson(), {'id': null, 'code': '12345678901234567890123', 'amount': '0.3'});
      expect(const BigDoubleJson().toJson(Decimal.fromInt(2)), '2.0');
      expect(Exact.parseBigDouble('1.5e3'), Decimal.parse('1500'));
      expect(Exact.parseBigInt('+7'), BigInt.from(7));
    });

    test('a JSON number, another text or too many digits is a decoding error', () {
      for (final bad in <Object>[5, 1.5, '0x1F', '1.5', ' ', '1e3', '9' * 1001]) {
        expect(() => const BigIntJson().fromJson(bad), throwsFormatException, reason: '$bad');
      }
      for (final bad in <Object>[0.1, '.5', '1.', 'NaN', '1e999999999', '1${'0' * 1000}']) {
        expect(() => const BigDoubleJson().fromJson(bad), throwsFormatException, reason: '$bad');
      }
      expect(Exact.parseBigDouble('9' * 1000), isNotNull);
    });
  });

  group('a local table with exact fields', () {
    late LocalTable<Balance> balances;

    setUp(() async {
      await SynapsisTest.start(BalancesConfig());
      balances = LocalTable<Balance>('balance', Balance.fromJson, key: 'id', generated: true, exact: {'code', 'amount'});
      Local.register(balances);
    });

    test('keeps the text and compares and sorts by value', () async {
      for (final (code, amount) in [('9', '10.5'), ('100', '9.75'), ('12345678901234567890123', '0.3')]) {
        await balances.save(Balance(code: BigInt.parse(code), amount: Decimal.parse(amount)));
      }
      final row = jsonDecode((await balances.box).values.last) as Map<String, dynamic>;
      expect(row['code'], '12345678901234567890123');
      final byAmount = await balances.orderBy('amount').getMany();
      expect(byAmount.map((b) => Exact.text(b.amount)), ['0.3', '9.75', '10.5']);
      final byCode = await balances.orderBy('code', desc: true).getMany();
      expect(byCode.map((b) => '${b.code}'), ['12345678901234567890123', '100', '9']);
      expect((await balances.where({'amount': gt(Decimal.parse('9.8'))}).getMany()).single.code, BigInt.from(9));
      expect(await balances.where({'code': gte(BigInt.from(10))}).count(), 2);
      expect(await balances.where({'amount': between(Decimal.parse('0.3'), Decimal.parse('9.75'))}).count(), 2);
      expect(await balances.where({'amount': Decimal.parse('0.30')}).count(), 1);
      expect(await balances.where({'code': oneOf([BigInt.from(9), BigInt.from(100)])}).count(), 2);
      expect(await balances.where({'code': ne(BigInt.from(9))}).count(), 2);
      expect(await balances.where({'code': BigInt.from(100)}).update({'amount': Decimal.parse('1')}), 1);
      expect((await balances.where({'code': BigInt.from(100)}).getOne()).getOrElse((_) => throw 'x').amount, Decimal.one);
    });
  });

  group('the form rules of an exact field', () {
    test('the text of its type, @min and @max compared exactly', () {
      expect(Rules.bigint()('12345678901234567890123', const {}), isNull);
      expect(Rules.bigint()('1.5', const {}), isNotNull);
      expect(Rules.bigdouble()('0.1', const {}), isNull);
      expect(Rules.bigdouble()('abc', const {}), isNotNull);
      final min = Rules.minExact(Decimal.parse('0.30000000000000000001'));
      expect(min('0.3', const {}), isNotNull);
      expect(min('0.30000000000000000001', const {}), isNull);
      expect(Rules.maxExact(BigInt.parse('9007199254740993'))('9007199254740994', const {}), isNotNull);
      expect(Rules.asBigDouble(' 0.1 '), Decimal.parse('0.1'));
      expect(Rules.asBigInt('x'), isNull);
    });
  });
}
