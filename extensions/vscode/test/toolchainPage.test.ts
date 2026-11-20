// The toolchains' cards of the welcome and of Settings (TC_JS in src/toolchainHost.ts), run as the page runs them:
// a toolchain is needed only for the platforms chosen, none at all before a choice, and the steps are this system's.
import assert from 'node:assert/strict';
import test from 'node:test';
import { TC_JS, TC_TEXTS } from '../src/toolchainHost';

const en = (TC_TEXTS as unknown as { en: Record<string, string> }).en;
function cards(tc: Record<string, unknown>, onboarding = true): string {
  const t = (key: string, ...args: string[]) => (en[key] ?? key).replace(/\{(\d)\}/g, (_m, i) => args[Number(i)] ?? '');
  const esc = (s: string) => String(s);
  const document = { addEventListener: () => undefined };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('t', 'esc', 'document', 'vscode', `${TC_JS}; return toolchainCards;`);
  return run(t, esc, document, {})(tc, onboarding, {});
}
const base = { paths: {}, onPath: {}, statuses: [{ id: 'python', where: 'included', path: '/i/python3' }, { id: 'node', where: 'path', path: '/usr/bin/node' }, { id: 'flutter', where: 'missing' }] };

test('backend and web only: Flutter is never asked, and nothing is needed', () => {
  const html = cards({ ...base, platforms: ['backend', 'web'], workspace: [], os: 'darwin' });
  assert.ok(!html.includes('Flutter'));
  assert.ok(!html.includes('class="warn">!'));
});

test('no platform chosen yet: every toolchain is optional, Flutter included', () => {
  const html = cards({ ...base, platforms: [], workspace: [], os: 'darwin' });
  assert.ok(html.includes(en['tc.choose']));
  assert.ok(html.includes('only for Mobile (Flutter)') && !html.includes('needed for'));
});

test("mobile on a Mac without Flutter: needed, the Mac's steps, NuclearLang's install marked as not tried there", () => {
  const html = cards({ ...base, platforms: ['mobile'], workspace: [], os: 'darwin' });
  assert.ok(html.includes('needed for Mobile (Flutter)'));
  assert.ok(html.includes('brew install --cask flutter'));
  assert.ok(html.includes('Not tried yet on a clean Mac'));
});

test("Windows has no NuclearLang install of a toolchain: only the steps and the user's own", () => {
  const html = cards({ ...base, platforms: ['mobile'], workspace: [], os: 'win32' });
  assert.ok(!html.includes('data-tc="tcInstall"'));
  assert.ok(html.includes('docs.flutter.dev/get-started/install/windows'));
});
