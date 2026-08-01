/**
 * Widget stylesheet.
 *
 * Injected into a shadow root, so these rules cannot leak into the host page
 * and the host page's rules cannot reach in. That isolation is why the widget
 * can be dropped into any site without a reset or a specificity war.
 *
 * Colours are driven by custom properties set at runtime (`--fx-accent` and
 * its two alpha tints) plus a `data-scheme` attribute on the host, so theming
 * never requires regenerating this string.
 */
export const styles = /* css */ `
:host {
  --fx-accent: #B58BF9;
  /* Alpha tints of the accent, computed at runtime so the widget does not
     depend on color-mix(), which lands too late in Safari for our baseline. */
  --fx-accent-soft: rgba(181, 139, 249, 0.14);
  --fx-accent-ring: rgba(181, 139, 249, 0.22);
  /* Plum, for text sitting on a filled accent surface. */
  --fx-on-accent: #17101F;
  --fx-radius: 10px;
  --fx-radius-sm: 6px;
  /*
   * Space Grotesk if the host page already serves it, otherwise the platform UI
   * font. The widget never injects a webfont: a third-party script has no
   * business adding a network request or a font swap to someone else's page.
   */
  --fx-font: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

  --fx-bg: #F4F1EA;
  --fx-bg-subtle: #EAE6DC;
  --fx-fg: #17101F;
  --fx-fg-muted: #8D8778;
  --fx-border: #E3DED2;
  --fx-shadow: 0 12px 32px rgba(23, 16, 31, 0.14), 0 2px 8px rgba(23, 16, 31, 0.08);

  all: initial;
  font-family: var(--fx-font);
  line-height: 1.5;
}

:host([data-scheme='dark']) {
  --fx-bg: #1E1529;
  --fx-bg-subtle: #17101F;
  --fx-fg: #F6F2F8;
  --fx-fg-muted: #8B7F99;
  --fx-border: rgba(255, 255, 255, 0.1);
  --fx-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.45);
}

*, *::before, *::after { box-sizing: border-box; }

.fx-root {
  position: fixed;
  z-index: 2147483000;
  bottom: 20px;
  font-family: var(--fx-font);
}

.fx-root[data-position='bottom-right'] { right: 20px; }
.fx-root[data-position='bottom-left'] { left: 20px; }

/* ------------------------------- launcher ------------------------------- */

.fx-launcher {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  background: var(--fx-accent);
  color: var(--fx-on-accent);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--fx-shadow);
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), filter 0.18s ease;
}

.fx-launcher:hover { transform: translateY(-2px); filter: brightness(1.08); }
.fx-launcher:active { transform: translateY(0); }
.fx-launcher:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: 3px; }
.fx-launcher svg { width: 16px; height: 16px; }

/* -------------------------------- panel --------------------------------- */

.fx-panel {
  position: absolute;
  bottom: 56px;
  width: 360px;
  max-width: calc(100vw - 40px);
  background: var(--fx-bg);
  color: var(--fx-fg);
  border: 1px solid var(--fx-border);
  border-radius: var(--fx-radius);
  box-shadow: var(--fx-shadow);
  overflow: hidden;
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.fx-root[data-position='bottom-right'] .fx-panel { right: 0; }
.fx-root[data-position='bottom-left'] .fx-panel { left: 0; }

.fx-panel[data-open='true'] {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.fx-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 0;
}

.fx-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fx-fg); }
.fx-subtitle { margin: 4px 0 0; font-size: 13px; color: var(--fx-fg-muted); }

.fx-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--fx-radius-sm);
  background: transparent;
  color: var(--fx-fg-muted);
  cursor: pointer;
  transition: background 0.15s ease;
}

.fx-close:hover { background: var(--fx-bg-subtle); color: var(--fx-fg); }
.fx-close:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: 2px; }
.fx-close svg { width: 14px; height: 14px; }

.fx-form { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; }

.fx-field { display: flex; flex-direction: column; gap: 6px; }

.fx-label { font-size: 12px; font-weight: 600; color: var(--fx-fg); }

/* Category chips: a radio group styled as buttons, so keyboard semantics and
   screen-reader announcements stay correct. */
.fx-categories { display: flex; flex-wrap: wrap; gap: 6px; border: 0; padding: 0; margin: 0; }
.fx-categories legend { font-size: 12px; font-weight: 600; color: var(--fx-fg); padding: 0 0 6px; }

.fx-chip { position: relative; }
.fx-chip input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}

.fx-chip span {
  display: inline-block;
  padding: 5px 11px;
  border: 1px solid var(--fx-border);
  border-radius: 999px;
  font-size: 12.5px;
  color: var(--fx-fg-muted);
  background: var(--fx-bg);
  transition: all 0.15s ease;
  pointer-events: none;
}

.fx-chip input:checked + span {
  border-color: var(--fx-accent);
  background: var(--fx-accent-soft);
  color: var(--fx-accent);
  font-weight: 600;
}

.fx-chip input:focus-visible + span { outline: 2px solid var(--fx-accent); outline-offset: 2px; }

.fx-input, .fx-textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--fx-border);
  border-radius: var(--fx-radius-sm);
  background: var(--fx-bg);
  color: var(--fx-fg);
  font: inherit;
  font-size: 13.5px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.fx-textarea { min-height: 90px; resize: vertical; line-height: 1.55; }

.fx-input::placeholder, .fx-textarea::placeholder { color: var(--fx-fg-muted); opacity: 0.75; }

.fx-input:focus, .fx-textarea:focus {
  outline: none;
  border-color: var(--fx-accent);
  box-shadow: 0 0 0 3px var(--fx-accent-ring);
}

.fx-submit {
  width: 100%;
  height: 38px;
  border: none;
  border-radius: var(--fx-radius-sm);
  background: var(--fx-accent);
  color: var(--fx-on-accent);
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.fx-submit:hover:not(:disabled) { filter: brightness(1.08); }
.fx-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.fx-submit:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: 2px; }

.fx-error {
  margin: 0;
  font-size: 12.5px;
  color: #dc2626;
}

:host([data-scheme='dark']) .fx-error { color: #f87171; }

.fx-footer {
  margin: 0;
  padding-top: 2px;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fx-fg-muted);
  text-align: center;
}

.fx-footer a { color: var(--fx-fg-muted); text-decoration: none; font-weight: 600; }
.fx-footer a:hover { color: var(--fx-accent); text-decoration: underline; }

/* -------------------------------- success -------------------------------- */

.fx-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 34px 22px 30px;
  text-align: center;
}

.fx-success-icon {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--fx-accent-soft);
  color: var(--fx-accent);
}

.fx-success-icon svg { width: 22px; height: 22px; }
.fx-success p { margin: 0; font-size: 13.5px; color: var(--fx-fg-muted); }
.fx-success strong { font-size: 14.5px; color: var(--fx-fg); font-weight: 600; }

.fx-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 480px) {
  .fx-root { bottom: 16px; }
  .fx-root[data-position='bottom-right'] { right: 16px; }
  .fx-root[data-position='bottom-left'] { left: 16px; }
  .fx-panel { width: calc(100vw - 32px); }
}

@media (prefers-reduced-motion: reduce) {
  .fx-launcher, .fx-panel { transition: none; }
}
`;
