import { describe, expect, test } from 'vitest';
import { AppConfig, Decode, Http, HttpMethod, Json, Repository, exactText, wire } from '../src/index.js';
import { SynapsisTest } from '../src/testing.js';

/** A model with an exact field as the dialect writes it. */
class Price {
  readonly code: bigint;
  readonly label: string;

  constructor(init: { code: bigint; label: string }) {
    this.code = init.code;
    this.label = init.label;
  }

  static fromJson(json: Json): Price {
    return new Price({ code: BigInt(exactText(json['code'], 'bigint')), label: json['label_text'] as string });
  }

  toJson(): Json {
    return { code: String(this.code), label_text: this.label };
  }
}

class PriceRepository extends Repository {
  create(price: Price): Promise<Price> {
    return this.send(HttpMethod.post, '', { body: price, decode: Decode.one(Price.fromJson) });
  }
}

class TestConfig extends AppConfig {
  connections = [new Http({ baseUrl: 'https://api.test/' })];
}

describe('the JSON of an exact number', () => {
  test('a text of the language is read; blanks around it are ignored', () => {
    expect(exactText(' 12345678901234567890123 ', 'bigint')).toBe('12345678901234567890123');
    expect(exactText('+7', 'bigint')).toBe('+7');
    expect(exactText('0.1', 'bigdouble')).toBe('0.1');
    expect(exactText('1.5e3', 'bigdouble')).toBe('1.5e3');
    expect(exactText('9'.repeat(1000), 'bigdouble')).toHaveLength(1000);
  });

  test('a JSON number, another text or too many digits is a decoding error', () => {
    for (const bad of [5, 1.5, null, undefined, '0x1F', '1.5', ' ', '1e3', '9'.repeat(1001)]) {
      expect(() => exactText(bad, 'bigint'), String(bad)).toThrow(TypeError);
    }
    for (const bad of [0.1, '.5', '1.', 'NaN', '1e999999999', `1${'0'.repeat(1000)}`]) {
      expect(() => exactText(bad, 'bigdouble'), String(bad)).toThrow(TypeError);
    }
  });

  test('a request body is the JSON of its models: their names, exact fields as texts', async () => {
    await SynapsisTest.start(new TestConfig());
    SynapsisTest.respondWith({ code: '12345678901234567890124', label_text: 'b' });
    const saved = await new PriceRepository().create(new Price({ code: 12345678901234567890123n, label: 'a' }));
    expect(SynapsisTest.requests[0]!.body).toEqual({ code: '12345678901234567890123', label_text: 'a' });
    expect(saved.code).toBe(12345678901234567890124n);
    expect(JSON.stringify({ n: 2n ** 70n }, wire)).toBe('{"n":"1180591620717411303424"}');
  });

  test('an answer with a JSON number where an exact number goes fails to decode', async () => {
    await SynapsisTest.start(new TestConfig());
    SynapsisTest.respondWith({ code: 5, label_text: 'b' });
    await expect(new PriceRepository().create(new Price({ code: 1n, label: 'a' }))).rejects.toThrow(TypeError);
  });
});
