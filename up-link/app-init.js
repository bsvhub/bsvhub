/* ═══════════════════════════════════════════════════════════════
   app-init.js — Bootstrap Orchestrator (v7.1)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Master initialisation sequence. Delegates screen assembly
             to per-screen orchestrators (app-core-s1/s2/s3.js), injects
             titlebars via header-footer.js, registers screen mount hooks,
             and handles global init tasks.

   INPUTS:   All App.* modules (must be defined before this runs).
             DOM panel containers from index.html.
             App.HeaderFooter, App.CoreS1, App.CoreS2, App.CoreS3.

   OUTPUTS:  App.Init()        — called once on DOMContentLoaded
             window.saveMAP    — legacy bridge → App.Transmit.sign()

   DEPENDS:  Every other app-*.js file, settings.js, wireframe.js,
             card.js, onchain.js (opt), offline.js (opt),
             header-footer.js, app-core-s1.js, app-core-s2.js, app-core-s3.js.

   NOTES:    This file MUST load last. Screen orchestrators handle their
             own panel render/mount/init. This file only coordinates
             the boot sequence and global concerns.
   ═══════════════════════════════════════════════════════════════ */

App.Init = function() {
  /* 1. Inject CSS custom properties from SETTINGS */
  App.SettingsApplier.init();

  /* 2. Populate titlebars and statusbars for all 3 screens */
  App.HeaderFooter.init();

  /* 3. Set App.State.onChain based on detected capabilities */
  App.State.onChain = App.Capabilities.onchain;

  /* 4. Assemble Screen 1 (render, mount, init all S1 panels) */
  App.CoreS1.init();

  /* 5. Assemble Screen 3 (render, mount, init viewer — always available) */
  App.CoreS3.init();

  /* 6. Initialize wallet module (needs titlebar HTML from step 2) */
  App.Wallet.init();

  /* 7. Initialize mode toggle (submit/update) */
  App.Mode.init();

  /* 8. Initialize optional modules (onchain.js / offline.js) */
  if (App.MAPExport && App.MAPExport.init) App.MAPExport.init();
  if (App.MAPImport && App.MAPImport.init) App.MAPImport.init();

  /* 9. Inject BSVCard CSS once for the main document */
  if (typeof BSVCard !== 'undefined' && BSVCard.injectCSS) {
    BSVCard.injectCSS();
  }

  /* 10a. Register Screen 1 mount hook — re-enable S1 CLEAR button only */
  window._onScreenMount[1] = function() {
    var s1 = document.getElementById('screen-1');
    if (s1) {
      var clearBtn = s1.querySelector('.clear-btn');
      if (clearBtn) clearBtn.disabled = false;
    }
  };

  /* 10b. Register Screen 2 mount hook (lazy — renders on navigate) */
  window._onScreenMount[2] = function() {
    App.CoreS2.mount();
    var sv2 = document.getElementById('sb-version-2');
    if (sv2) sv2.textContent = SETTINGS.STATUSBAR_LABEL_S2;
  };

  /* 10c. Register Screen 3 mount hook — wire CLEAR to txid field, set version label.
     S3 clear button clears only #txid-input (and resets viewer state).
     It is enabled only when the txid field has content, grayed out otherwise. */
  window._onScreenMount[3] = function() {
    var sv3 = document.getElementById('sb-version-3');
    if (sv3) sv3.textContent = SETTINGS.STATUSBAR_LABEL_S3;

    var s3 = document.getElementById('screen-3');
    if (!s3) return;
    var clearBtn  = s3.querySelector('.clear-btn');
    var txidInput = document.getElementById('txid-input');
    if (!clearBtn || !txidInput) return;

    /* Helper: enable/disable based on whether the txid field has content */
    function _syncClearBtn() {
      clearBtn.disabled = !txidInput.value.trim();
    }

    /* Wire the clear action — wipe txid field + reset viewer panels */
    clearBtn.onclick = function() {
      txidInput.value = '';
      var tableEl = document.getElementById('p3-table');
      var cardEl  = document.getElementById('p3-card');
      var badge   = document.getElementById('viewer-badge');
      if (tableEl) tableEl.innerHTML = App.Panels.S3.table.render();
      if (cardEl)  cardEl.innerHTML  = App.Panels.S3.card.render();
      if (badge)   { badge.textContent = ''; badge.className = 'badge'; }
      App.StatusBar.set('VIEWER CLEARED', 'ok');
      _syncClearBtn();
      /* Remove ?tx= param from URL so a refresh doesn't auto-reload */
      if (history.replaceState) history.replaceState(null, '', window.location.pathname);
    };

    /* Keep button state in sync as user types in the txid field */
    txidInput.addEventListener('input', _syncClearBtn);

    /* Set initial state for this mount */
    _syncClearBtn();
  };

  /* 11. Legacy bridge — window.saveMAP dispatches to onchain or offline */
  window.saveMAP = function() {
    if (App.Capabilities.onchain && App.State.onChain && App.MAPExport && App.MAPExport.saveOnChain) {
      return App.MAPExport.saveOnChain();
    }
    if (App.Capabilities.offline && App.MAPExport && App.MAPExport.save) {
      return App.MAPExport.save();
    }
    App.StatusBar.set('NO SAVE METHOD AVAILABLE \u2014 LOAD ONCHAIN.JS OR OFFLINE.JS', 'err');
  };

  /* 12. Set initial status bar message */
  App.StatusBar.set(SETTINGS.STATUSBAR_DEFAULT_MSG, '');

  /* 13. Refresh wireframe geometry after all content is rendered */
  if (typeof applyGeometry === 'function') {
    applyGeometry();
  }
};

/* Boot on DOMContentLoaded */
document.addEventListener('DOMContentLoaded', App.Init);
