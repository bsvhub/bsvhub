/* ============================================================
   CRT COLOUR MODES PLUGIN — crt-modes.js  v1.0
   ============================================================
   Injects a row of colour-mode swatches into the header.
   Clicking a swatch applies a CRT colour theme + scanlines.
   The default swatch removes all effects.
   Selection is saved to localStorage and restored on return.

   To activate, add TWO lines to <head> in index.html:
     <link rel="stylesheet" href="crt-plugin/crt-modes.css">
     <script defer src="crt-plugin/crt-modes.js"></script>

   Remove those two lines (or delete the files) to fully
   disable — zero side effects on the rest of the site.

   NOTE: if crt-effect.css is still linked in <head>, remove
   it — crt-modes.css includes the scanlines internally and
   controls them per-mode. Having both will double the effect.
   ============================================================ */


/* ============================================================
   ⚙️  MODES CONFIG
   ============================================================
   Each entry defines one swatch.

   id      — used as  html[data-crt-mode="X"]  in the CSS
             and stored in localStorage.
             Use 'default' for the no-effect option.

   label   — tooltip on hover

   color   — the swatch square colour.
             Use a CSS gradient string for multi-colour swatches
             e.g. 'linear-gradient(135deg,#555,#999)'
   ============================================================ */
const CRT_MODES = [
    {
        id:    'default',
        label: 'Default — no effect',
        color: 'linear-gradient(135deg, #444 0%, #888 50%, #444 100%)',
    },
    {
        id:    'amber',
        label: 'Amber — classic phosphor',
        color: '#FFB000',
    },
    {
        id:    'green',
        label: 'Green — terminal',
        color: '#00CC44',
    },
    {
        id:    'white',
        label: 'White — cool phosphor',
        color: '#C8D8EE',
    },
    {
        id:    'blue',
        label: 'Blue — IBM style',
        color: '#5599FF',
    },
    {
        id:    'cyan',
        label: 'Cyan — Commodore style',
        color: '#00CCDD',
    },
];

/* ============================================================
   STORAGE KEY — change this if you need to namespace it
   ============================================================ */
const CRT_STORAGE_KEY = 'crt-colour-mode';


/* ============================================================
   APPLY MODE
   Sets / removes  data-crt-mode  on <html> and marks the
   matching swatch as active.
   ============================================================ */
function applyMode(modeId) {
    const id = modeId || 'default';

    if (id === 'default') {
        document.documentElement.removeAttribute('data-crt-mode');
    } else {
        document.documentElement.setAttribute('data-crt-mode', id);
    }

    // Update active indicator on all swatches
    document.querySelectorAll('.crt-swatch').forEach(function (s) {
        s.classList.toggle('crt-swatch--active', s.dataset.crtMode === id);
    });

    try { localStorage.setItem(CRT_STORAGE_KEY, id); } catch (e) { /* private browsing */ }
}


/* ============================================================
   BUILD SWATCH BAR
   Creates and returns the #crt-mode-bar element.
   ============================================================ */
function buildSwatchBar() {
    var bar = document.createElement('div');
    bar.id = 'crt-mode-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Display colour mode');

    CRT_MODES.forEach(function (mode) {
        var btn                    = document.createElement('button');
        btn.className              = 'crt-swatch';
        btn.dataset.crtMode        = mode.id;
        btn.title                  = mode.label;
        btn.setAttribute('aria-label', mode.label);
        btn.style.background       = mode.color;
        bar.appendChild(btn);
    });

    bar.addEventListener('click', function (e) {
        var swatch = e.target.closest('.crt-swatch');
        if (!swatch) return;
        applyMode(swatch.dataset.crtMode);

        // Let positionContent re-measure #top-ui if it exists
        if (typeof positionContent === 'function') {
            requestAnimationFrame(positionContent);
        }
    });

    return bar;
}


/* ============================================================
   INIT
   Injects the bar and restores the saved mode.
   Bails out silently if the expected DOM isn't present
   (keeps the site working if the plugin files are missing
   or the HTML structure changes).
   ============================================================ */
function crtModesInit() {
    var topUi  = document.getElementById('top-ui');
    var header = topUi && topUi.querySelector('header.header-container');
    if (!topUi || !header) return;   // host page not found — exit silently

    var bar = buildSwatchBar();

    // Insert after <header>, before <nav.tab-bar>
    header.insertAdjacentElement('afterend', bar);

    // Restore saved preference (default if nothing stored)
    var saved = 'default';
    try { saved = localStorage.getItem(CRT_STORAGE_KEY) || 'default'; } catch (e) {}
    applyMode(saved);
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crtModesInit);
} else {
    crtModesInit();
}
