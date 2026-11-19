// The embedded mode (ADR-synapsis-0009): the app mounted in an element of a host's page, in a shadow root with the
// project's stylesheet (CSS variables of the host cross it: its theme), an in-memory router, and every call through
// the host's bridge when it gives one. The generated `src/embed.ts` calls `mountApp` with the app's pieces.
import { createElement } from 'react';
import type { Element } from './react.js';
import { createRoot } from 'react-dom/client';
import { Synapsis } from './app.js';
import type { Bridge } from './sockets.js';

/** What the host gives: its bridge to the service, and the first path of the app's router. */
export interface Host {
  bridge?: Bridge;
  path?: string;
}

/** Mounts `app` in `element`; gives back the function that unmounts it. */
export async function mountApp(
  element: HTMLElement,
  host: Host,
  app: () => Element,
  start: () => Promise<void>,
  styles = '',
): Promise<() => void> {
  Synapsis.embed(host);
  if (!Synapsis.started) await start();
  const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
  shadow.replaceChildren();
  if (styles) {
    const style = document.createElement('style');
    style.textContent = styles;
    shadow.append(style);
  }
  const container = document.createElement('div');
  shadow.append(container);
  const root = createRoot(container);
  root.render(createElement(app));
  return () => {
    root.unmount();
    shadow.replaceChildren();
  };
}
