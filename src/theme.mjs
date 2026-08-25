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
