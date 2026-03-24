/* ═══════════════════════════════════════════════════════════════
   txid-in.js — S3 TXID Input Bar (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Renders the TXID input bar for Screen 3 (#p3-txid).
             Provides a text input for transaction IDs and a LOAD
             button that triggers App.Viewer.loadTx().

   INPUTS:   App.Utils (from app-core.js).
             App.Viewer (from map-down.js).

   OUTPUTS:  App.Panels.S3.txid — { render(), mount() }

   DEPENDS:  app-core.js, map-down.js.

   NOTES:    Absorbed from app-panels-s3.js (App.Panels.S3.txid).
             "txid-in" because it takes a TXID IN from the user
             (contrast with in-tx.js which handles transaction
             output display). Enter key is wired in App.Viewer.init().
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S3 = App.Panels.S3 || {};


/* ── Inject panel CSS once ─────────────────────────────────── */
(function() {
  var style = document.createElement('style');
  style.textContent =
    '.txid-bar {' +
      'background: var(--panel); border: 1px solid var(--border-blue);' +
      'display: flex; align-items: center; gap: 6px; padding: 4px 8px; flex-shrink: 0;' +
    '}' +
    '.txid-bar lbl {' +
      'font-size: 12px; color: var(--amber-dim); letter-spacing: 2px;' +
      'white-space: nowrap; flex-shrink: 0;' +
    '}' +
    '.txid-bar input {' +
      'flex: 1; font-family: var(--font); font-size: 14px; letter-spacing: 0.5px;' +
      'background: var(--input-bg); color: var(--white); border: 1px solid var(--border-blue);' +
      'padding: 3px 7px; outline: none; min-width: 0;' +
    '}' +
    '.txid-bar input:focus { border-color: var(--amber); }' +
    '.txid-bar button {' +
      'font-family: var(--font); font-size: 13px; letter-spacing: 2px; font-weight: 700;' +
      'background: var(--accent); color: #fff; border: 1px solid var(--accent);' +
      'padding: 3px 12px; cursor: pointer; text-transform: uppercase; white-space: nowrap;' +
      'flex-shrink: 0; width: auto;' +
    '}' +
    '.txid-bar button:hover { background: #ff7a5a; }';
  document.head.appendChild(style);
})();


/* ─────────────────────────────────────────────────────────────
   P3-TXID — TXID input bar (label + input + LOAD button)
   ───────────────────────────────────────────────────────────── */
App.Panels.S3.txid = {
  render: function() {
    return '' +
      '<div class="txid-bar">' +
        '<lbl>TXID</lbl>' +
        '<input type="text" id="txid-input" placeholder="Enter transaction ID..." spellcheck="false">' +
        '<button class="file-btn" id="load-btn">&#9658; LOAD</button>' +
      '</div>';
  },

  mount: function() {
    var $ = App.Utils.$;
    var loadBtn = $('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function() {
        App.Viewer.loadTx();
      });
    }
    /* Enter key is wired in App.Viewer.init() */
  }
};
