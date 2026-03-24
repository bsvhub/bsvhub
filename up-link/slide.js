/* ═══════════════════════════════════════════════════════════════════════════
 * PURPOSE  : Directional CSS slide transitions scoped to .main-area only.
 *            Titlebar (first row) and statusbar (last row) remain static.
 *            Single-file drop-in — injects its own styles, wraps window.goTo.
 *            Wireframe works identically without this file.
 * VERSION  : 5
 * INPUTS   : window.goTo(n) — wireframe navigation function (wrapped)
 *            .screen[id=screen-N], .main-area, .shell elements in the DOM
 * OUTPUTS  : Forward  (S1→S2→S3) : panels exit left,  enter from right
 *            Backward (S3→S2→S1) : panels exit right, enter from left
 *            Animation clipped to .main-area footprint — chrome never moves.
 * DEPENDS  : wireframe HTML — goTo() must exist before this script runs.
 *            Load after the wireframe's inline <script> block.
 * NOTES    :
 *   Clip strategy — two temporary overlay <div>s positioned at the measured
 *   .main-area rect (position:fixed, overflow:hidden). Both .main-area
 *   elements are reparented into these clips for the animation duration, then
 *   restored to their original shells on cleanup.
 *
 *   Spacer — a flex:1 placeholder is inserted into toShell while toMainArea
 *   is reparented out. Without it, toShell collapses to titlebar+statusbar
 *   and the statusbar jumps to the top for the animation duration.
 *
 *   _goTo() fires BEFORE reparenting so applyGeometry() sizes the incoming
 *   .main-area while it is still inside its shell.
 *
 *   `flipping` flag drops concurrent calls for the animation window.
 *   Fallback timer fires cleanup if animationend never triggers.
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {

  /* ── CONFIG ──────────────────────────────────────────────────────────── */
  const VERSION     = 6;
  const DURATION_MS = 360;                  /* animation duration (ms)       */
  const FALLBACK_MS = DURATION_MS + 140;    /* cleanup safety net            */

  /* Glass overlay appearance — applied to clip divs during the transition.
   * WHY transparent: main-area panels are near-transparent; the page
   * gradient shows through at rest and must continue to show through
   * during the slide. A solid fill would clash with the panel backgrounds. */
  const CLIP_BG   = 'rgba(255,255,255,0.05)';  /* subtle glass tint         */
  const CLIP_BLUR = '4px';                      /* matches titlebar blur     */

  /* ── Guard ───────────────────────────────────────────────────────────── */
  if (typeof goTo !== 'function') {
    console.warn('[flip.js v' + VERSION + '] goTo() not found — plugin inactive.');
    return;
  }

  /* ── Inject styles ───────────────────────────────────────────────────── */
  (function injectStyles() {
    const s = document.createElement('style');
    s.id = 'flip-plugin-styles';
    s.textContent = `
      .flip-to-left    { animation: flip-toLeft    ${DURATION_MS}ms ease-in-out both; }
      .flip-from-right { animation: flip-fromRight ${DURATION_MS}ms ease-in-out both; }
      .flip-to-right   { animation: flip-toRight   ${DURATION_MS}ms ease-in-out both; }
      .flip-from-left  { animation: flip-fromLeft  ${DURATION_MS}ms ease-in-out both; }

      @keyframes flip-toLeft    { from { transform:translateX(0);     } to { transform:translateX(-100%); } }
      @keyframes flip-fromRight { from { transform:translateX(100%);  } to { transform:translateX(0);     } }
      @keyframes flip-toRight   { from { transform:translateX(0);     } to { transform:translateX(100%);  } }
      @keyframes flip-fromLeft  { from { transform:translateX(-100%); } to { transform:translateX(0);     } }
    `;
    document.head.appendChild(s);
  }());

  /* ── Capture original goTo ───────────────────────────────────────────── */
  const _goTo = window.goTo;

  /* ── State ───────────────────────────────────────────────────────────── */
  let flipping = false;

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function screenNum(el) {
    return parseInt(el.id.replace('screen-', ''), 10);
  }

  /* Create a fixed clip overlay at the given rect.
   * Glass background + blur mirror the main-area's own transparent aesthetic
   * rather than the opaque chrome colour of titlebar/statusbar.           */
  function makeClip(rect, zIndex) {
    const d = document.createElement('div');
    d.style.cssText =
      'position:fixed;' +
      'top:'              + rect.top    + 'px;' +
      'left:'             + rect.left   + 'px;' +
      'width:'            + rect.width  + 'px;' +
      'height:'           + rect.height + 'px;' +
      'overflow:hidden;' +
      'z-index:'          + zIndex      + ';' +
      'box-sizing:border-box;' +
      'background:'       + CLIP_BG     + ';' +
      'backdrop-filter:blur(' + CLIP_BLUR + ');' +
      'border-left:1px solid var(--border,#2e3f66);' +
      'border-right:1px solid var(--border,#2e3f66);';
    return d;
  }

  /* Lock .main-area to explicit px so flex resolves correctly outside shell */
  function lockSize(el, rect) {
    el.style.width  = rect.width  + 'px';
    el.style.height = rect.height + 'px';
    el.style.flex   = 'none';
  }

  function unlockSize(el) {
    el.style.width  = '';
    el.style.height = '';
    el.style.flex   = '';
  }

  /* ── Main transition function ────────────────────────────────────────── */
  function flipTo(toN) {
    if (flipping) return;

    const fromEl = document.querySelector('.screen.active');
    if (!fromEl) { _goTo(toN); return; }

    const fromN = screenNum(fromEl);
    if (fromN === toN) return;

    const toEl = document.getElementById('screen-' + toN);
    if (!toEl) { _goTo(toN); return; }

    const fromMainArea = fromEl.querySelector('.main-area');
    const fromShell    = fromEl.querySelector('.shell');
    if (!fromMainArea || !fromShell) { _goTo(toN); return; }

    /* Guard: don't fight a concurrent mode-switch fade */
    if (fromShell.style.opacity === '0') { _goTo(toN); return; }

    /* ── 1. Measure .main-area footprint before goTo alters geometry ──── */
    const rect = fromMainArea.getBoundingClientRect();

    /* ── 2. Create clip overlays ─────────────────────────────────────── */
    const clipOut = makeClip(rect, 1000);
    const clipIn  = makeClip(rect, 1001);

    flipping = true;

    /* ── 3. Fire _goTo — sizes incoming shell before reparenting ─────── */
    _goTo(toN);

    /* ── 4. Resolve incoming elements after geometry is applied ─────── */
    const toMainArea = toEl.querySelector('.main-area');
    const toShell    = toEl.querySelector('.shell');
    if (!toMainArea || !toShell) {
      clipOut.remove(); clipIn.remove();
      flipping = false;
      return;
    }

    /* ── 5. Store restore anchors ────────────────────────────────────── */
    const fromAnchor = fromShell.querySelector('.statusbar');
    const toAnchor   = toShell.querySelector('.statusbar');

    /* ── 6. Spacer — holds toShell's height while toMainArea is away ─── */
    /* WHY: without this, toShell collapses to titlebar+statusbar height
     * and the statusbar snaps to just below the titlebar for the full
     * animation duration, then jumps back on restore.
     * WHY two spacer modes:
     *   2-col — shell has a fixed px height, so flex:1 fills the gap ✓
     *   1-col — shell height is `auto` (content-driven); flex:1 resolves
     *           to zero and the statusbar still jumps. An explicit px
     *           height matching the measured rect is required instead.  */
    const spacer  = document.createElement('div');
    const is1col  = window.ShellState && window.ShellState.mode === '1col';
    spacer.style.cssText = is1col
      ? 'height:' + rect.height + 'px;flex:none;'
      : 'flex:1;min-height:0;';
    toShell.insertBefore(spacer, toAnchor);

    /* ── 7. Lock sizes then reparent both .main-area elements ────────── */
    lockSize(fromMainArea, rect);
    lockSize(toMainArea,   rect);

    clipOut.appendChild(fromShell.removeChild(fromMainArea));
    clipIn.appendChild(toShell.removeChild(toMainArea));

    document.body.appendChild(clipOut);
    document.body.appendChild(clipIn);

    /* ── 8. Apply directional animation classes ───────────────────────── */
    const forward  = toN > fromN;
    const outClass = forward ? 'flip-to-left'    : 'flip-to-right';
    const inClass  = forward ? 'flip-from-right' : 'flip-from-left';

    fromMainArea.classList.add(outClass);
    toMainArea.classList.add(inClass);

    /* ── 9. Cleanup on completion ─────────────────────────────────────── */
    let done = false;

    function cleanup() {
      if (done) return;
      done = true;

      fromMainArea.removeEventListener('animationend', onEnd);
      clearTimeout(fallback);

      fromMainArea.classList.remove(outClass);
      toMainArea.classList.remove(inClass);

      /* Restore toMainArea — remove spacer now that real content is back */
      unlockSize(toMainArea);
      toShell.insertBefore(toMainArea, toAnchor);
      spacer.remove();

      /* Restore fromMainArea — keeps DOM intact for future back-navigation */
      unlockSize(fromMainArea);
      fromShell.insertBefore(fromMainArea, fromAnchor);

      clipIn.remove();
      clipOut.remove();

      flipping = false;
    }

    /* Guard against bubbled animationend from child elements */
    function onEnd(e) { if (e.target === fromMainArea) cleanup(); }

    fromMainArea.addEventListener('animationend', onEnd);
    const fallback = setTimeout(cleanup, FALLBACK_MS);
  }

  /* ── Patch window.goTo ───────────────────────────────────────────────── */
  window.goTo = flipTo;

  console.info(
    `%c[flip.js v${VERSION}]%c main-area slide loaded — ` +
    `forward: ←  |  backward: →  |  ${DURATION_MS}ms  |  chrome excluded`,
    'color:#EAB300;font-weight:bold', 'color:#8899aa'
  );

}());
