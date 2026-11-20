// The icons of the Environments page: the stroke style of HTTP Connections' (16×16, 1.4 px, round ends,
// `currentColor`), so each badge is colored by its CSS. Static markup, never user content.

const svg = (body: string) =>
  `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  env: svg('<path d="M8 2 2.2 5 8 8l5.8-3z"/><path d="M2.2 8 8 11l5.8-3M2.2 11 8 14l5.8-3"/>'),
  shared: svg('<path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M9.5 2.5v3h3M5.5 8.5h5M5.5 11h3.5"/>'),
  project: svg('<path d="M2 4.6c0-.6.5-1.1 1.1-1.1h3l1.5 1.6h5.3c.6 0 1.1.5 1.1 1.1v5.7c0 .6-.5 1.1-1.1 1.1H3.1c-.6 0-1.1-.5-1.1-1.1z"/>'),
  secret: svg('<rect x="3" y="7" width="10" height="7" rx="1.6"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7"/><path d="M8 9.7v1.6"/>'),
  client: svg('<rect x="4.5" y="1.8" width="7" height="12.4" rx="1.4"/><path d="M7 12h2"/>'),
  required: svg('<path d="M8 2.5v11M3.2 5.2l9.6 5.6M12.8 5.2 3.2 10.8"/>'),
  missing: svg('<path d="M8 1.8 14.5 13.5h-13z"/><path d="M8 6.2v3.4M8 11.6v.2"/>'),
  unused: svg('<circle cx="8" cy="8" r="5.8"/><path d="M3.9 12.1l8.2-8.2"/>'),
  active: svg('<circle cx="8" cy="8" r="5.8"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>'),
  plus: svg('<path d="M8 3v10M3 8h10"/>'),
  trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.4 4.5l.7 8.6c0 .5.4.9.9.9h4c.5 0 .9-.4.9-.9l.7-8.6"/>'),
  open: svg('<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5"/><path d="M12 9.5v3c0 .6-.4 1-1 1H3.5c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1h3"/>'),
  refresh: svg('<path d="M13.2 6.5A5.5 5.5 0 0 0 3 5M2.8 9.5A5.5 5.5 0 0 0 13 11"/><path d="M3 2v3h3M13 14v-3h-3"/>'),
  search: svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/>'),
  local: svg('<path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z"/><path d="M6.5 13.5V10h3v3.5"/>'),
  use: svg('<path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4"/>'),
  update: svg('<path d="M8 2v8.5M4.8 7.3 8 10.5l3.2-3.2"/><path d="M2.5 13.5h11"/>'),
  eye: svg('<path d="M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="2"/>'),
};
export type IconName = keyof typeof ICONS;
