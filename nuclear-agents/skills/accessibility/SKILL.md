---
name: accessibility
description: Make Synapsis screens accessible on mobile and web: labels and semantics for screen readers, contrast, focus order, keyboard use, touch target size, text scaling and reduced motion. Use when building or reviewing any screen, form or custom widget.
title: Accessibility
title_es: Accesibilidad
description_es: Hacer accesibles las pantallas Synapsis en móvil y web: etiquetas y semántica para lectores de pantalla, contraste, foco, teclado, tamaño táctil, escalado del texto y movimiento reducido. Úsalo al construir o revisar cualquier pantalla, formulario o widget propio.
kind: domain
tags: [accessibility, a11y, screen reader, contrast, focus, text scaling, wcag, semantics]
---
# Accessibility

## When to use

Every screen, form and custom widget, on both UI platforms. The target is WCAG 2.2 level AA.

## What the platform has

- **Mobile**: views are the UI toolkit's widgets written in Nuclear (`nuclear help flutter`, §5); the toolkit's
  standard widgets carry semantics for TalkBack and VoiceOver, and its semantics widget labels a custom one. Forms
  (`form`, `FormTextField(..., label = ...)`) give each field a label and its errors.
- **Web**: views are HTML element functions with the attributes as named arguments (`img(src = ..., alt = ...)`,
  `button(onClick = ..., children = ...)`; `nuclear help web`, §3.1): native elements bring their roles and
  keyboard behaviour.
- **Not yet**: an accessibility check in the platform's tests (the framework's roadmap mentions `meetsGuideline`);
  check by hand and with the OS's tools until then.

## Steps

1. **Use the native element or standard widget** for its job: a button is a `button` (web) or a toolkit button
   (mobile), not a tappable `div` or a gesture on a text. You get the role, focus and keyboard for free.
2. **Every meaningful image and icon has a label**: `alt` on web, a semantics label on mobile; decorative ones are
   hidden from screen readers (`alt = ""`). Icon-only buttons need a label ("Delete order", not "trash").
3. **Labels come from translations** (`"orders.delete.label".tr()`): screen-reader text is user-facing text
   (`i18n`).
4. **Forms**: each field has a visible label (not only a placeholder), errors are text next to the field and
   announced, required fields say so, and the submit error moves focus to the first invalid field.
5. **Contrast**: text 4.5:1 against its background (3:1 for large text and for icons, borders of inputs and focus
   rings); never color alone to say a state (add an icon or text to "error" red).
6. **Touch and click targets** at least 48x48 dp on mobile (24x24 CSS px minimum on web, 44 recommended), with
   space between them.
7. **Text scaling**: the layout survives the OS text size at 200 %: no fixed heights on text, wrap instead of
   clip, scroll when needed. Never disable scaling.
8. **Focus and keyboard** (web, and mobile with a keyboard or switch access): logical focus order following the
   reading order, a visible focus ring, every action reachable by keyboard, Escape closes dialogs, focus returns to
   the opener when a dialog closes, no keyboard trap.
9. **Announce changes**: a toast, a loading result or a new chat message is announced to screen readers (a live
   region on web, a semantics announcement on mobile); a spinner has a label ("Loading orders").
10. **Motion and time**: respect the OS "reduce motion" setting (no parallax, short fades), no flashing above 3 per
    second, no time limit without a way to extend it (session timeouts warn first: `SessionManager(timeout)`).
11. **Headings and structure** on web: one `h1` per screen, ordered headings, landmarks (`main`, `nav`), lists as
    lists, and a page title per route.
12. **Test it**: TalkBack (Android) and VoiceOver (iOS, macOS) through one full task; keyboard only on web; the OS
    text size at maximum; a contrast checker on the theme colors. Write what you checked in the work log.

## The platform's tools

- `nuclear make screen <component> <screen>` (mobile) and `nuclear make stateless <component> <Name>` (web) for views;
  `nuclear make widget <name>` for a shared accessible widget used everywhere.
- `nuclear device <device>` to try text scaling and orientation; `nuclear run` on a phone with the screen reader on.
- `nuclear test`: `@widget` tests can find widgets by their label text, so a missing label fails a test.
- `nuclear check .` before handing over.

## Pitfalls

- Tappable containers with no role or label; icon buttons read as "button".
- Placeholder-only fields; errors shown only in red.
- Fixed-height rows that clip text at large sizes.
- Custom dropdowns, tabs and dialogs on web without keyboard support or focus management.
- Labels that repeat the role ("button submit") or are in another language than the UI.
- Disabling zoom on web.

## Checklist

- [ ] Every interactive element is a native element or standard widget, or has a role and label.
- [ ] Every non-decorative image and icon button has a translated label.
- [ ] Text and essential icons meet the contrast ratios; state is never color alone.
- [ ] Targets are at least 48 dp (mobile) / 24 px (web).
- [ ] The main task works at 200 % text size, with a screen reader, and by keyboard on web.
- [ ] Reduce-motion is respected; dialogs return focus; `nuclear check .` reports 0 errors; `nuclear test` is green.
