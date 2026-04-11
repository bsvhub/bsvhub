/* ============================================================
   tile-render.js — Shared tile visual rendering utilities
   ------------------------------------------------------------
   Single source of truth for the two functions used by both
   json.js (icon grid) and ideas-render.js (accordion ico slot).

   Globals (on window, no module system):
     setTileColour(a, colour1, colour2, opacity)
     buildSlotOverlay(wrap, info, clickStats, href)
   ============================================================ */

/* ── setTileColour ───────────────────────────────────────────
   Sets --tile-bg and --tile-opacity CSS custom properties on
   the given element. Read by the ::before colour layer in
   unified.css. Named colours, hex, rgb, rgba all work natively.

   Rules:
     colour1 + colour2  → linear-gradient(135deg, c1, c2)
     colour1 only       → solid colour
     neither            → no-op (CSS default transparent applies)
     opacity            → --tile-opacity (0.0–1.0)
============================================================ */
function setTileColour(a, colour1, colour2, opacity) {
    var hasC1 = colour1 && colour1.trim();
    var hasC2 = colour2 && colour2.trim();

    if (!hasC1 && !hasC2) return;

    var bg = hasC1 && hasC2
        ? 'linear-gradient(135deg, ' + colour1.trim() + ', ' + colour2.trim() + ')'
        : colour1.trim();

    a.style.setProperty('--tile-bg', bg);

    if (opacity !== undefined && opacity !== null && opacity !== '') {
        a.style.setProperty('--tile-opacity', opacity);
    }
}

/* ── buildSlotOverlay ────────────────────────────────────────
   Builds the 6-slot text overlay grid on a .icon-wrapper div
   and appends leftCol + rightCol to it.

   Slot layout:
     LEFT  [slot 0, slot 1, slot 2]
     RIGHT [click count, slot 3, slot 4]

   Parameters:
     wrap       — the .icon-wrapper element
     info       — semicolon-separated string "s0;s1;s2;s3;s4"
     clickStats — { url: count } map (pass {} for no counters)
     href       — item URL used to look up click count (pass '' to skip)
============================================================ */
function buildSlotOverlay(wrap, info, clickStats, href) {
    var slots = (info || '').split(';');
    while (slots.length < 5) slots.push('');

    var leftCol       = document.createElement('div');
    leftCol.className = 'tile-overlay-left';
    var rightCol       = document.createElement('div');
    rightCol.className = 'tile-overlay-right';

    /* Click counter — always first in right column */
    var clickCount       = (href && clickStats) ? (clickStats[href] || 0) : 0;
    var counterDiv       = document.createElement('div');
    counterDiv.className = 'tile-label tile-label-clicks';
    counterDiv.textContent = clickCount || '0';
    counterDiv.dataset.slot = 'clicks';
    rightCol.appendChild(counterDiv);

    /* Left slots: 0, 1, 2 — only render non-empty so labels stack from top */
    [0, 1, 2].forEach(function (i) {
        var val = (slots[i] || '').trim();
        if (!val) return;
        var d       = document.createElement('div');
        d.className = 'tile-label tile-label-s' + i;
        d.textContent = val;
        d.dataset.slot = String(i);
        leftCol.appendChild(d);
    });

    /* Right slots: 3, 4 — only render non-empty so labels stack from top */
    [3, 4].forEach(function (i) {
        var val = (slots[i] || '').trim();
        if (!val) return;
        var d       = document.createElement('div');
        d.className = 'tile-label tile-label-s' + i;
        d.textContent = val;
        d.dataset.slot = String(i);
        rightCol.appendChild(d);
    });

    wrap.appendChild(leftCol);
    wrap.appendChild(rightCol);
}
