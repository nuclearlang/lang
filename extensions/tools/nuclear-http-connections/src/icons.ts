// The icons of the request page: one stroke style (16×16, 1.4 px, round ends, `currentColor`), so each section is
// colored by its CSS with the theme's `nuclearHttpConnections.*` colors. Static markup, never user content.

const svg = (body: string) =>
  `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  // the request's sections
  params: svg('<path d="M2.5 4h6M12 4h1.5M2.5 8h1.5M7.5 8h6M2.5 12h8M14 12h-.5"/><circle cx="10.2" cy="4" r="1.6"/><circle cx="5.7" cy="8" r="1.6"/><circle cx="12" cy="12" r="1.6"/>'),
  headers: svg('<path d="M2.5 4h3M2.5 8h3M2.5 12h3M8 4h5.5M8 8h5.5M8 12h3.5"/><path d="M6.6 3v10" opacity=".45"/>'),
  body: svg('<path d="M5.5 2.5c-1.4 0-2 .6-2 1.9v1.8c0 .9-.5 1.5-1.4 1.8.9.3 1.4.9 1.4 1.8v1.8c0 1.3.6 1.9 2 1.9M10.5 2.5c1.4 0 2 .6 2 1.9v1.8c0 .9.5 1.5 1.4 1.8-.9.3-1.4.9-1.4 1.8v1.8c0 1.3-.6 1.9-2 1.9"/><circle cx="8" cy="8" r=".4" fill="currentColor"/>'),
  auth: svg('<rect x="3" y="7" width="10" height="7" rx="1.6"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7"/><path d="M8 9.7v1.6"/>'),
  rules: svg('<path d="M6.8 9.2l2.4-2.4"/><path d="M7.4 4.6l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M8.6 11.4l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1"/>'),
  vars: svg('<path d="M4.5 2.5C3 4 2.3 6 2.3 8s.7 4 2.2 5.5M11.5 2.5C13 4 13.7 6 13.7 8s-.7 4-2.2 5.5"/><path d="M6.2 5.8l3.6 4.4M9.8 5.8l-3.6 4.4"/>'),
  env: svg('<path d="M8 2 2.2 5 8 8l5.8-3z"/><path d="M2.2 8 8 11l5.8-3M2.2 11 8 14l5.8-3"/>'),
  response: svg('<path d="M8 2v7.5M5 6.8l3 3 3-3"/><path d="M2.5 10v2.3c0 .7.5 1.2 1.2 1.2h8.6c.7 0 1.2-.5 1.2-1.2V10"/>'),
  send: svg('<path d="M14 2 6.8 9.2M14 2 9.6 14l-2.8-4.8L2 6.4z"/>'),
  // the response's views
  pretty: svg('<path d="M3 3h3.5M5 3v10M5 8h3.5M5 13h3.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="11" cy="13" r="1.5"/>'),
  raw: svg('<path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4"/>'),
  preview: svg('<path d="M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="2"/>'),
  list: svg('<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".5" fill="currentColor"/><circle cx="2.8" cy="8" r=".5" fill="currentColor"/><circle cx="2.8" cy="12" r=".5" fill="currentColor"/>'),
  // the scopes of a variable
  global: svg('<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 1.8 2.6 3.8 2.6 6S9.8 12.2 8 14M8 2C6.2 3.8 5.4 5.8 5.4 8s.8 4.2 2.6 6"/>'),
  project: svg('<path d="M2 4.6c0-.6.5-1.1 1.1-1.1h3l1.5 1.6h5.3c.6 0 1.1.5 1.1 1.1v5.7c0 .6-.5 1.1-1.1 1.1H3.1c-.6 0-1.1-.5-1.1-1.1z"/>'),
  component: svg('<path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5z"/><path d="M2.5 5 8 8.2 13.5 5M8 8.2v6"/>'),
  code: svg('<path d="M8 1.8 13 3.6v4c0 3.2-2.2 5.6-5 6.6-2.8-1-5-3.4-5-6.6v-4z"/><path d="M6 8.2l1.4 1.4L10.2 6.8"/>'),
  // actions
  copy: svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.4"/><path d="M10.5 3.2V3c0-.8-.6-1.4-1.4-1.4H4c-.8 0-1.4.6-1.4 1.4v5.1c0 .8.6 1.4 1.4 1.4h.2"/>'),
  save: svg('<path d="M4 2.5h8v11L8 10.6 4 13.5z"/>'),
  eye: svg('<path d="M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="2"/>'),
  eyeOff: svg('<path d="M6.3 3.8A6.8 6.8 0 0 1 8 3.6c4 0 6.4 4.4 6.4 4.4a11 11 0 0 1-1.9 2.4M9.8 12.1a6 6 0 0 1-1.8.3C4 12.4 1.6 8 1.6 8a11.4 11.4 0 0 1 2.6-3"/><path d="M2.5 2.5l11 11"/>'),
  trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.4 4.5l.7 8.6c0 .5.4.9.9.9h4c.5 0 .9-.4.9-.9l.7-8.6"/>'),
  plus: svg('<path d="M8 3v10M3 8h10"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  chevron: svg('<path d="M6 4l4 4-4 4"/>'),
  expand: svg('<path d="M4.5 6 8 9.5 11.5 6"/><path d="M4.5 2.5 8 6l3.5-3.5" opacity=".5"/>'),
  collapse: svg('<path d="M4.5 10 8 6.5l3.5 3.5"/><path d="M4.5 13.5 8 10l3.5 3.5" opacity=".5"/>'),
  columns: svg('<rect x="2" y="2.5" width="12" height="11" rx="1.4"/><path d="M8 2.5v11"/>'),
  rows: svg('<rect x="2" y="2.5" width="12" height="11" rx="1.4"/><path d="M2 8h12"/>'),
  format: svg('<path d="M2.5 13.5 10 6M9 2.5v1.8M13.5 7h-1.8M12.3 3.7l-1.3 1.3"/>'),
  key: svg('<circle cx="5.3" cy="10.7" r="2.6"/><path d="M7.2 8.8 13 3M11 5l1.6 1.6M12.4 3.6 14 5.2"/>'),
  bolt: svg('<path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z"/>'),
  undo: svg('<path d="M5 3 2 6l3 3"/><path d="M2 6h7.5a4 4 0 0 1 0 8H6"/>'),
  clock: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>'),
  size: svg('<path d="M3 13.5h10M4.5 13.5V9M8 13.5V4M11.5 13.5V7"/>'),
  link: svg('<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5"/><path d="M12 9.5v3c0 .6-.4 1-1 1H3.5c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1h3"/>'),
  restore: svg('<path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8"/><path d="M2.5 2.5v3h3"/>'),
};
