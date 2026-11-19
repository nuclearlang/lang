// The device page's script must parse: a syntax error leaves the panel blank (no frame, no sizes).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DevicePanel } from '../src/mobile-device';
import { WebDevicePanel } from '../src/web-device';

test("the Synapsis device's page script parses", () => {
  const html: string = (DevicePanel.prototype as unknown as { html(this: unknown): string }).html.call({ context: { globalState: { get: () => undefined } } });
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  assert.ok(scripts.length > 0);
  for (const s of scripts) assert.doesNotThrow(() => new Function(s), 'the page script has a syntax error');
});

test("the web device's page script parses", () => {
  const view = { preset: 'Responsive', width: 1280, height: 800, landscape: false, scheme: 'system', throttle: 'none', noCache: false };
  const html: string = (WebDevicePanel.prototype as unknown as { html(this: unknown): string }).html.call({ view });
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  assert.ok(scripts.length > 0);
  for (const s of scripts) assert.doesNotThrow(() => new Function(s), 'the page script has a syntax error');
});
