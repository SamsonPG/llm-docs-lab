/**
 * src/theme.mjs
 *
 * WHAT: The colour tokens, shared by the live page and the published results page.
 * WHY:  These existed only inside ui.mjs, so the results page carried its own unrelated
 *       palette — cool greys and a blue accent — and read as a different product. Copying
 *       the values across would have created two lists that drift the moment one changes,
 *       which is the same failure this repository has already paid for twice.
 * WHEN: Imported wherever a page needs the theme.
 *
 * All three theme states are here, in the order that makes them resolve: the bare :root
 * carries the complete light palette, the media query redefines tokens for a dark system
 * preference while yielding to an explicit light choice, and [data-theme="dark"] redefines
 * them again so the toggle wins in both directions. A colour defined only inside one of the
 * latter two never applies in the un-stamped state most visitors are actually in.
 *
 * LAYER: Delivery (presentation).
 */

/** Every colour token, for all three theme states. Interpolate inside a <style> block. */
export const THEME_TOKENS = /* css */ `  :root {
    color-scheme: light;
    --x-glyph: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M2 2 14 14M14 2 2 14' stroke='%23000' stroke-width='2.2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E");
    --page-max: 52rem;
    --page-gutter: clamp(1.25rem, 4.5vw, 2rem);

    --ground: #EFEBE4;
    --ink: #14120E;
    --ink-2: #4A463C;
    --ink-3: #6B665A;
    --gold: #8A6612;
    --gold-lit: #6E5010;
    --on-gold: #FFFFFF;
    --glow: rgba(138, 102, 18, .18);
    --glow-2: rgba(138, 102, 18, .10);
    --warn: #8A4B12;
    --warn-bg: rgba(251, 243, 230, .72);
    --haven-a: rgba(180, 140, 50, .28);
    --haven-b: rgba(90, 120, 150, .18);
    --haven-c: rgba(200, 120, 80, .12);

    /* Apple-style glass — translucent enough that blur is visible */
    --glass: saturate(1.85) blur(28px);
    --glass-bg: rgba(255, 255, 255, .42);
    --glass-bg-strong: rgba(255, 255, 255, .55);
    --glass-edge: rgba(255, 255, 255, .72);
    --glass-edge-soft: rgba(255, 255, 255, .35);
    --glass-line: rgba(20, 18, 14, .08);
    --glass-inset: inset 0 1px 0 rgba(255, 255, 255, .75);
    --glass-shadow: 0 1px 1px rgba(20, 18, 14, .04), 0 12px 40px -16px rgba(20, 18, 14, .22);
    --pill: 0 1px 2px rgba(20, 20, 15, .12);
    --raise-solid: #FFFFFF;
    --sink: rgba(255, 255, 255, .28);
    --mark-hole: #0C0B10;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --ground: #07060A;
      --ink: #F2F0EA;
      --ink-2: #B0ACA2;
      --ink-3: #85827A;
      --gold: #E8B44A;
      --gold-lit: #F5C96B;
      --on-gold: #17130A;
      --glow: rgba(232, 180, 74, .20);
      --glow-2: rgba(232, 180, 74, .10);
      --warn: #E0A868;
      --warn-bg: rgba(34, 26, 14, .72);
      --haven-a: rgba(232, 180, 74, .55);
      --haven-b: rgba(150, 110, 210, .40);
      --haven-c: rgba(90, 170, 210, .34);
      --glass-bg: rgba(28, 26, 36, .42);
      --glass-bg-strong: rgba(36, 34, 46, .55);
      --glass-edge: rgba(255, 255, 255, .16);
      --glass-edge-soft: rgba(255, 255, 255, .08);
      --glass-line: rgba(242, 240, 234, .10);
      --glass-inset: inset 0 1px 0 rgba(255, 255, 255, .14);
      --glass-shadow: 0 1px 1px rgba(0, 0, 0, .35), 0 18px 48px -16px rgba(0, 0, 0, .65);
      --pill: 0 1px 2px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(255, 255, 255, .07);
      --raise-solid: #141219;
      --sink: rgba(255, 255, 255, .06);
      --mark-hole: #0C0B10;
    }
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
    --ground: #07060A;
    --ink: #F2F0EA;
    --ink-2: #B0ACA2;
    --ink-3: #85827A;
    --gold: #E8B44A;
    --gold-lit: #F5C96B;
    --on-gold: #17130A;
    --glow: rgba(232, 180, 74, .20);
    --glow-2: rgba(232, 180, 74, .10);
    --warn: #E0A868;
    --warn-bg: rgba(34, 26, 14, .72);
    --haven-a: rgba(232, 180, 74, .55);
    --haven-b: rgba(150, 110, 210, .40);
    --haven-c: rgba(90, 170, 210, .34);
    --glass-bg: rgba(28, 26, 36, .42);
    --glass-bg-strong: rgba(36, 34, 46, .55);
    --glass-edge: rgba(255, 255, 255, .16);
    --glass-edge-soft: rgba(255, 255, 255, .08);
    --glass-line: rgba(242, 240, 234, .10);
    --glass-inset: inset 0 1px 0 rgba(255, 255, 255, .14);
    --glass-shadow: 0 1px 1px rgba(0, 0, 0, .35), 0 18px 48px -16px rgba(0, 0, 0, .65);
    --pill: 0 1px 2px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(255, 255, 255, .07);
    --raise-solid: #141219;
    --sink: rgba(255, 255, 255, .06);
    --mark-hole: #0C0B10;
  }
`;


/**
 * The theme switch, shared the same way the tokens are.
 *
 * The control, its styling and its behaviour travel together on purpose: a page that took
 * the markup without the script would render three dead buttons, and one that took the
 * script without the styling would show an unstyled row. Keeping them in one place means a
 * page either has a working switch or does not have one at all.
 *
 * The storage key is deliberately `samsonpg-theme`, shared with the other sites, so one
 * choice follows a visitor across all of them rather than being made again on each.
 */
export const THEME_SWITCH_CSS = /* css */ `  .theme-switch {
    display: inline-flex; align-items: center; gap: 1px; padding: 3px;
    background: var(--sink); border: 1px solid var(--glass-edge-soft);
    border-radius: 999px; flex: 0 0 auto;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .theme-switch-btn {
    display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
    background: none; border: 0; border-radius: 999px; cursor: pointer; color: var(--ink-3);
    transition: color .15s ease, background .15s ease;
  }
  .theme-switch-btn:hover { color: var(--ink); }
  .theme-switch-btn .theme-switch-icon { width: 15px; height: 15px; }
  .theme-switch-btn[aria-pressed="true"] {
    background: var(--glass-bg-strong); color: var(--gold); box-shadow: var(--pill);
  }`;

export const THEME_SWITCH_HTML = /* html */ `    <div class="theme-switch theme-switch--compact" role="group" aria-label="Theme">
      <button type="button" class="theme-switch-btn" data-theme-pref="light" title="Light" aria-label="Use light theme" aria-pressed="false"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></button>
      <button type="button" class="theme-switch-btn" data-theme-pref="dark" title="Dark" aria-label="Use dark theme" aria-pressed="false"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 14.5A8.5 8.5 0 1111.5 4a6.5 6.5 0 109.5 10.5z"></path></svg></button>
      <button type="button" class="theme-switch-btn" data-theme-pref="system" title="System" aria-label="Use system theme" aria-pressed="true"><svg class="theme-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"></rect><path stroke-linecap="round" d="M8 19h8M12 17v2"></path></svg></button>
    </div>`;

export const THEME_SWITCH_JS = /* js */ `  const KEY = 'samsonpg-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const resolve = (pref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref);

  function applyTheme(pref) {
    const theme = resolve(pref);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-pref', pref);
    root.style.colorScheme = theme;
    document.querySelectorAll('.theme-switch-btn[data-theme-pref]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themePref === pref));
    });
  }

  let stored = 'system';
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark' || s === 'system') stored = s;
  } catch (e) { /* private mode; session-only */ }
  applyTheme(stored);

  document.querySelectorAll('.theme-switch-btn[data-theme-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themePref);
      try { localStorage.setItem(KEY, btn.dataset.themePref); } catch (e) { /* session-only */ }
    });
  });
  media.addEventListener('change', () => {
    if (root.getAttribute('data-theme-pref') === 'system') applyTheme('system');
  });

`;
