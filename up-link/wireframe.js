/* ═══════════════════════════════════════════════════════════════
   wireframe.js — Fixed-Pixel Geometry Engine + Screen Navigation (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Manages the 3-screen wireframe shell. Fixed-pixel canvas
             where one base unit (U px) drives ALL dimensions. Handles
             screen switching (goTo), auto 2col↔1col mode switching with
             hysteresis dead band, unit +/- controls, panel sizing.

   INPUTS:   DOM elements from index.html (screens, shells, panels).
             window.innerWidth for breakpoint detection.
             User unit-btn clicks for scale adjustment.

   OUTPUTS:  window.ShellState  — { unit, mode } geometry state
             window.goTo(n)     — navigate to screen 1/2/3
             window._onScreenMount[n] — hook registry for panel controllers

   DEPENDS:  index.html (DOM structure with col-wrap layout).

   NOTES:    Rewritten from wireframe_v3.html v9 engine.
             Shell never scales to fit viewport — it overflows and the
             page scrolls (browser zoom = zoom).
             Mode switches are geometry-driven:
               collapse → 1col when innerWidth < 26U
               expand   → 2col when innerWidth ≥ 26U × 1.1
             Dead band between thresholds prevents jitter.
             _onScreenMount hook system preserved from v6.0 so panel
             controllers can register render callbacks.
   ═══════════════════════════════════════════════════════════════ */

/* ── CONFIG ────────────────────────────────────────────────────── */
var VERSION       = 9;

var UNIT_DEFAULT  = 55;    /* px — starting base unit size                */
var UNIT_MIN      = 20;    /* px — minimum (smaller = more compact shell) */
var UNIT_MAX      = 100;   /* px — maximum (larger  = more spacious)      */
var UNIT_STEP     = 5;     /* px — +/- button increment                   */

var GAP_PX        = 2;     /* px — gap between all flex siblings          */

/*
 * WHY 1.1: creates a dead band between the collapse point (26U) and
 * the expand point (26U × 1.1 = 28.6U). At U=50 that's 1300–1430px.
 * A viewport sitting anywhere in that band stays in its current mode.
 */
var EXPAND_MULT   = 1.1;

var TRANSITION_MS = 220;   /* ms — one leg of the opacity fade            */

/* Wireframe unit counts (from spec wireframe.txt) */
var W_2COL   = 26;   /* shell width  — 2-col */
var H_2COL   = 16;   /* shell height — 2-col */
var W_1COL   = 13;   /* shell width  — 1-col */
var H_TITLE  = 1;    /* titlebar height       */
var H_STATUS = 1;    /* statusbar height      */

/*
 * LAYOUTS — per-screen panel definitions.
 *
 *   h : height in wireframe units — canonical for BOTH modes.
 *       2-col → applied as flex:h (proportional within the column).
 *       1-col → applied as explicit height h × unit px.
 *   o : CSS `order` for 1-col stacking sequence (spec-defined).
 *
 *   full[]  : full-width panels (direct child of main-area, not in a col).
 *   left[]  : panels inside .col-left.
 *   right[] : panels inside .col-right.
 *
 * Column height verification (both cols must total the same):
 *   S1 : left  7+3+4=14,    right 6+4+3+1=14  ✓
 *   S2 : left  14,          right 10+3+1=14    ✓
 *   S3 : full  2 (txid),    left 12, right 12  (2+12 = 14 each side) ✓
 */
var LAYOUTS = {
  1: {
    full:  [],
    left:  [
      { id: 'p1-det',    h: 7, o: 1 },
      { id: 'p1-desc',   h: 3, o: 3 },
      { id: 'p1-feat',   h: 4, o: 5 },
    ],
    right: [
      { id: 'p1-icon',   h: 6, o: 2 },
      { id: 'p1-dev',    h: 4, o: 4 },
      { id: 'p1-tx',     h: 3, o: 6 },
      { id: 'p1-tx-btn', h: 1, o: 7 },
    ],
  },
  2: {
    full:  [],
    left:  [
      { id: 'p2-map',    h: 14, o: 1 },
    ],
    right: [
      { id: 'p2-card',   h: 11, o: 2 },
      { id: 'p2-tx',     h:  2, o: 3 },
      { id: 'p2-tx-btn', h:  1, o: 4 },
    ],
  },
  3: {
    /* TXID sits above col-wrap in main-area — same position in both modes.
     * Gets an explicit height (not proportioned in a column). */
    full:  [ { id: 'p3-txid',  h:  2, o: 1 } ],
    left:  [ { id: 'p3-table', h: 12, o: 2 } ],
    right: [ { id: 'p3-card',  h: 12, o: 3 } ],
  },
};

/* Flatten full + left + right panels for a given screen */
function allPanels(n) {
  var L = LAYOUTS[n];
  return [].concat(L.full, L.left, L.right);
}

/* ── State ─────────────────────────────────────────────────────── */
var unit          = UNIT_DEFAULT;
var mode          = '2col';    /* '2col' | '1col'                  */
var _wfResizeTimer = null;
var transitioning = false;     /* guard: no concurrent mode fades  */

/* Shared geometry readable by all modules */
window.ShellState = { unit: unit, mode: mode };

/* Screen mount hooks — external modules register callbacks here.
 * When goTo(n) activates a screen, _onScreenMount[n]() fires
 * so panel controllers can render/refresh content lazily. */
window._onScreenMount = {};

/* ── DOM helpers ───────────────────────────────────────────────── */
function _wfById(id) { return document.getElementById(id); }

function currentScreenNumber() {
  var a = document.querySelector('.screen.active');
  return a ? parseInt(a.id.replace('screen-', ''), 10) : 1;
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

/* ── Navigation ────────────────────────────────────────────────── */
function goTo(n) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  var target = _wfById('screen-' + n);
  if (!target) return;
  target.classList.add('active');
  syncNav(n);
  applyGeometry();

  /* Fire registered mount hook for this screen */
  if (window._onScreenMount && window._onScreenMount[n]) {
    window._onScreenMount[n]();
  }
}

function syncNav(n) {
  var btns = document.querySelectorAll('.nav-btn');
  for (var i = 0; i < btns.length; i++) {
    var screen = btns[i].getAttribute('data-screen');
    if (String(screen) === String(n)) {
      btns[i].classList.add('active');
    } else {
      btns[i].classList.remove('active');
    }
  }
  /* Sync mode-toggle underlines: VIEW active on S3, SUBMIT active on S1/S2 */
  var toggles = document.querySelectorAll('.mode-toggle');
  for (var j = 0; j < toggles.length; j++) {
    var t = toggles[j];
    var id = t.id;
    if (n === 3 && id === 'mode-viewer') {
      t.classList.add('active');
    } else if (n !== 3 && id === 'mode-submit') {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  }
}

/* ── Geometry engine ───────────────────────────────────────────── */

/*
 * applyGeometry — single source of truth for all inline dimension styles.
 *
 * 2-col mode:
 *   Shell      → W_2COL×unit wide, H_2COL×unit tall (fixed canvas).
 *   Titlebar   → H_TITLE×unit.  Statusbar → H_STATUS×unit.
 *   col-wrap   → flex:1 (fills main-area below any full-width panel).
 *   col panels → flex:h (proportional height within their column).
 *   full panels→ explicit h×unit px (not inside a column).
 *
 * 1-col mode:
 *   Shell      → W_1COL×unit wide, height auto (content-driven, scrollable).
 *   Chrome     → same explicit unit heights.
 *   col-wrap   → flex:none, height auto.
 *   All panels → explicit h×unit px + CSS order for stacking sequence.
 *   .col       → display:contents (CSS rule via .mode-1col on shell).
 */
function applyGeometry() {
  var active  = document.querySelector('.screen.active');
  if (!active) return;

  var screenN = currentScreenNumber();
  var layout  = LAYOUTS[screenN];
  var shell   = active.querySelector('.shell');
  var tb      = active.querySelector('.titlebar');
  var sb      = active.querySelector('.statusbar');
  var colWrap = active.querySelector('.col-wrap');
  var is1col  = mode === '1col';

  /* Shell dimensions — the fixed-pixel canvas */
  shell.style.width  = (is1col ? W_1COL : W_2COL) * unit + 'px';
  shell.style.height = is1col ? 'auto' : H_2COL * unit + 'px';

  /* Toggle mode class — activates CSS overrides for .col and .col-wrap */
  shell.classList.toggle('mode-1col', is1col);

  /* Fixed-height chrome */
  if (tb) tb.style.height = H_TITLE  * unit + 'px';
  if (sb) sb.style.height = H_STATUS * unit + 'px';

  /* Full-width panels — always explicit height (not proportioned in a col) */
  layout.full.forEach(function(p) {
    var el = _wfById(p.id);
    if (!el) return;
    el.style.height = p.h * unit + 'px';
    el.style.flex   = '';
    el.style.order  = is1col ? String(p.o) : '';
  });

  /* Column panels */
  var colPanels = [].concat(layout.left, layout.right);

  if (is1col) {
    /* Explicit heights + CSS order drives the vertical stacking sequence */
    colPanels.forEach(function(p) {
      var el = _wfById(p.id);
      if (!el) return;
      el.style.height = p.h * unit + 'px';
      el.style.flex   = '';
      el.style.order  = String(p.o);
    });
    if (colWrap) { colWrap.style.flex = ''; colWrap.style.height = 'auto'; }

  } else {
    /* Proportional flex within each column; shell's fixed height governs totals */
    colPanels.forEach(function(p) {
      var el = _wfById(p.id);
      if (!el) return;
      el.style.flex   = String(p.h);
      el.style.height = '';
      el.style.order  = '';
    });
    /* flex:1 fills main-area space below any full-width panel (e.g. S3 TXID) */
    if (colWrap) { colWrap.style.flex = '1'; colWrap.style.height = ''; }
  }

  window.ShellState = { unit: unit, mode: mode };
  updateDebugBadge(screenN);
  updateFootprint(screenN);
  updateUnitLabels();
}

/* ── Display helpers ───────────────────────────────────────────── */

/*
 * updateDebugBadge — shows BOTH thresholds live so the auto-switching
 * logic is always transparent. Format:
 *   v9 2COL U:50 SHELL:1300×800 ▼COLLAPSE:<1300px ▲EXPAND:≥1430px VP:1440×900 SCR:1
 */
function updateDebugBadge(screenN) {
  var badge = _wfById('dim-badge');
  if (!badge) return;
  var twoColW    = W_2COL * unit;
  var collapseAt = twoColW;
  var expandAt   = Math.round(twoColW * EXPAND_MULT);
  var active     = document.querySelector('.screen.active');
  var shell      = active ? active.querySelector('.shell') : null;
  var sw         = shell ? Math.round(shell.offsetWidth)  : 0;
  var sh         = shell ? Math.round(shell.offsetHeight) : 0;
  badge.textContent =
    'v' + VERSION + ' ' + mode.toUpperCase() + ' U:' + unit + ' ' +
    'SHELL:' + sw + '\u00d7' + sh + ' ' +
    '\u25bcCOLLAPSE:<' + collapseAt + 'px ' +
    '\u25b2EXPAND:\u2265' + expandAt + 'px ' +
    'VP:' + window.innerWidth + '\u00d7' + window.innerHeight + ' ' +
    'SCR:' + screenN;
}

function updateFootprint(screenN) {
  var active = document.querySelector('.screen.active');
  if (!active) return;
  var shell = active.querySelector('.shell');
  var fp    = active.querySelector('[data-footprint]');
  if (!shell || !fp) return;
  fp.textContent =
    'screen-' + screenN + ' \u2014 ' + Math.round(shell.offsetWidth) + 'x' + Math.round(shell.offsetHeight);
}

/* Sync U:xx label across every status bar (all 3 screens) */
function updateUnitLabels() {
  var labels = document.querySelectorAll('[data-unit-lbl]');
  for (var i = 0; i < labels.length; i++) {
    labels[i].textContent = 'U:' + unit;
  }
}

/* ── Mode switching ────────────────────────────────────────────── */

/*
 * switchMode — animated: fade out → apply new geometry → fade in.
 * `transitioning` flag blocks any concurrent switch during the fade.
 * After the transition, checkBreakpoint runs once more in case the
 * viewport moved further while the fade was in progress.
 */
function switchMode(newMode) {
  if (mode === newMode || transitioning) return;
  transitioning = true;

  var active = document.querySelector('.screen.active');
  var shell  = active ? active.querySelector('.shell') : null;
  if (!shell) { transitioning = false; return; }

  shell.style.opacity = '0';
  setTimeout(function() {
    mode = newMode;
    applyGeometry();

    shell.style.opacity = '1';
    setTimeout(function() {
      transitioning = false;
      /* One final check — viewport may have moved during the 440ms window */
      checkBreakpoint();
    }, TRANSITION_MS);
  }, TRANSITION_MS);
}

/*
 * checkBreakpoint — compare current innerWidth against the two thresholds.
 * Hysteresis means only one branch can fire at a time:
 *   - In 2-col: only collapses (expand branch can never fire)
 *   - In 1-col: only expands  (collapse branch can never fire)
 */
function checkBreakpoint() {
  if (transitioning) return;
  var w       = window.innerWidth;
  var twoColW = W_2COL * unit;
  if (mode === '2col' && w < twoColW) {
    switchMode('1col');
  } else if (mode === '1col' && w >= twoColW * EXPAND_MULT) {
    switchMode('2col');
  }
}

/* ── Unit control ──────────────────────────────────────────────── */

/*
 * adjustUnit — user clicked +/-. Apply instantly (no fade) since the
 * user intentionally changed the design scale. Re-evaluate mode
 * thresholds with the new unit: thresholds shift proportionally.
 */
function adjustUnit(delta) {
  unit = Math.max(UNIT_MIN, Math.min(UNIT_MAX, unit + delta));
  /* Recalculate thresholds and snap mode instantly if now out of range */
  var twoColW = W_2COL * unit;
  if (mode === '2col' && window.innerWidth < twoColW) {
    mode = '1col';
  } else if (mode === '1col' && window.innerWidth >= twoColW * EXPAND_MULT) {
    mode = '2col';
  }
  applyGeometry();
}

/* ── Init ──────────────────────────────────────────────────────── */

/*
 * initMode — set starting mode from current viewport width without
 * animation. Only resize/zoom events trigger the fade transition.
 */
function initMode() {
  mode = window.innerWidth < W_2COL * unit ? '1col' : '2col';
}

/* Single delegated click handler for nav and unit buttons */
document.addEventListener('click', function(e) {
  var unitBtn = e.target.closest('[data-delta]');
  if (unitBtn) {
    var delta = parseInt(unitBtn.getAttribute('data-delta'), 10);
    if (!isNaN(delta)) adjustUnit(delta);
    return;
  }
  var navBtn = e.target.closest('.nav-btn');
  if (navBtn) {
    var n = parseInt(navBtn.getAttribute('data-screen'), 10);
    if (!isNaN(n)) goTo(n);
    return;
  }
  var modeBtn = e.target.closest('.mode-toggle[data-screen]');
  if (modeBtn) {
    var n2 = parseInt(modeBtn.getAttribute('data-screen'), 10);
    if (!isNaN(n2)) goTo(n2);
  }
});

/* Debounced resize — prevents layout thrashing during drag-resize */
window.addEventListener('resize', function() {
  clearTimeout(_wfResizeTimer);
  _wfResizeTimer = setTimeout(checkBreakpoint, 100);
});

/* Boot */
syncNav(1);
initMode();
applyGeometry();
