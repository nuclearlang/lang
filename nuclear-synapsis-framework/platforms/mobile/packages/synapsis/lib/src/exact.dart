import 'package:decimal/decimal.dart';
import 'package:json_annotation/json_annotation.dart';

/// The exact numbers of Nuclear (`bigint`: [BigInt], `bigdouble`: [Decimal]; ADR-lang-0015) in the JSON of an app,
/// the backend's rule: an exact number travels as a JSON text, the language's `toString()` both ways. A `bigint` is
/// read with the rule of `text.toBigInt()` (an optional sign and digits), a `bigdouble` with `text.toBigDouble()`
/// (also decimals and an exponent); blanks around it are ignored. A JSON number, another text or a value of more
/// than [maxDigits] digits is a decoding error: a [FormatException], as any answer that is not the model's JSON.
abstract final class Exact {
  /// The most digits an exact number of an answer has, written without an exponent (the backend's limit).
  static const int maxDigits = 1000;

  static final RegExp _bigint = RegExp(r'^[+-]?[0-9]+$');
  static final RegExp _bigdouble = RegExp(r'^[+-]?([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$');

  /// `text.toBigInt()`: the whole number of [text], or null; also null past [maxDigits] digits.
  static BigInt? parseBigInt(String text) {
    final t = text.trim();
    if (!_bigint.hasMatch(t) || t.replaceFirst(RegExp('^[+-]'), '').length > maxDigits) return null;
    return BigInt.parse(t);
  }

  /// `text.toBigDouble()`: the exact decimal of [text], or null; also null past [maxDigits] digits.
  static Decimal? parseBigDouble(String text) {
    final t = text.trim();
    final m = t.length > 2 * maxDigits ? null : _bigdouble.firstMatch(t);
    if (m == null) return null;
    final whole = m[1]!, fraction = m[2] ?? '', exponent = m[3] ?? '0';
    // an exponent of more than 6 digits writes more than maxDigits digits (`1e999999999`)
    if (exponent.replaceFirst(RegExp('^[+-]'), '').length > 6) return null;
    final digits = '$whole$fraction'.replaceFirst(RegExp('^0+(?=.)'), '').length;
    final e = int.parse(exponent) - fraction.length;
    if ((e >= 0 ? digits + e : (digits > -e + 1 ? digits : -e + 1)) > maxDigits) return null;
    return Decimal.parse(t);
  }

  /// `toString()` of a `bigdouble`: the shortest exact text with at least one decimal (`0.3`, `2.0`).
  static String text(Decimal d) {
    final s = d.toString();
    return s.contains('.') ? s : '$s.0';
  }

  /// A `bigint` of a JSON answer.
  static BigInt bigint(Object? json) {
    if (json is! String) throw FormatException('a bigint travels as a JSON text, not $json');
    return parseBigInt(json) ?? (throw FormatException("'$json' is not the text of a bigint"));
  }

  /// A `bigdouble` of a JSON answer.
  static Decimal bigdouble(Object? json) {
    if (json is! String) throw FormatException('a bigdouble travels as a JSON text, not $json');
    return parseBigDouble(json) ?? (throw FormatException("'$json' is not the text of a bigdouble"));
  }

  /// The value a comparison of the local database or a form uses: a [Decimal] of an exact number or of its
  /// text, null for anything else.
  static Decimal? of(Object? v) => switch (v) {
    Decimal() => v,
    BigInt() => Decimal.fromBigInt(v),
    String() => parseBigDouble(v),
    _ => null,
  };

  /// What `jsonEncode` writes for a value of a row: an exact number as its text, a model as its JSON.
  static Object? encodable(Object? v) => switch (v) {
    BigInt() => v.toString(),
    Decimal() => text(v),
    _ => (v as dynamic).toJson(),
  };
}

/// The JSON of a `bigint` field of a model (the dialect writes `@BigIntJson()` on it).
class BigIntJson implements JsonConverter<BigInt, Object> {
  const BigIntJson();

  @override
  BigInt fromJson(Object json) => Exact.bigint(json);

  @override
  Object toJson(BigInt value) => value.toString();
}

/// The JSON of a `bigdouble` field of a model (the dialect writes `@BigDoubleJson()` on it).
class BigDoubleJson implements JsonConverter<Decimal, Object> {
  const BigDoubleJson();

  @override
  Decimal fromJson(Object json) => Exact.bigdouble(json);

  @override
  Object toJson(Decimal value) => Exact.text(value);
}
