import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';

// Root rule 14: what a user reads never sends them to a source tree (spec 018, C4/H1).
test('no message of the extension names the source tree or a cargo build', () => {
  const bundle = JSON.parse(fs.readFileSync(path.join(__dirname, '../../l10n/bundle.l10n.es.json'), 'utf8')) as Record<string, string>;
  const wrong = Object.keys(bundle).filter((m) => /cargo build|the nuclear repository|source tree/i.test(m));
  assert.deepEqual(wrong, []);
});
