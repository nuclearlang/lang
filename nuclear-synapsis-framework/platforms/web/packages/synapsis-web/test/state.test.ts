import { expect, test } from 'vitest';
import { StateManager } from '../src/index.js';

// What the react dialect writes for an asynchronous `@state` method (statemanager_method.tpl): only the latest call's
// answer is emitted, so a list read twice never shows the older read when it comes back last.
class Lists extends StateManager<string> {
  constructor() {
    super('empty');
  }
  async load(read: () => Promise<string>): Promise<void> {
    const turn$ = this.stateTurn();
    const value = await read();
    if (!this.isLatestTurn(turn$)) return;
    this.emit(value);
  }
}

test('an older answer that comes back last is dropped', async () => {
  const m = new Lists();
  let slow!: (v: string) => void;
  const first = m.load(() => new Promise((r) => (slow = r)));
  await m.load(async () => 'two messages');
  slow('one message');
  await first;
  expect(m.state).toBe('two messages');
});
