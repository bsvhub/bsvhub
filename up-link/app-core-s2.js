/* ═══════════════════════════════════════════════════════════════
   app-core-s2.js — Screen 2 Orchestrator (v7.1)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Assembles Screen 2 (Chain Preview) on demand. Called via
             _onScreenMount[2] when the user navigates to Screen 2.
             Validates form → collects data → distributes to map-up.js
             (MAP table), card.js (card preview), in-tx.js (TX summary
             + sign button). Re-renders every time S2 is entered.

   INPUTS:   App.Form (validate, collectData) from app-form.js.
             App.Panels.S2.map (from map-up.js).
             App.Panels.S2.card (from card.js — S2 wrapper).
             App.Panels.S2.tx, App.Panels.S2.txBtn (from in-tx.js).
             App.Utils, App.State, App.StatusBar, App.Shell (from app-core.js).

   OUTPUTS:  App.CoreS2 — { mount() }

   DEPENDS:  app-core.js, app-form.js, map-up.js, card.js, in-tx.js.

   NOTES:    Registered as window._onScreenMount[2] by app-init.js.
             If form validation fails, bounces user back to Screen 1.
   ═══════════════════════════════════════════════════════════════ */

App.CoreS2 = {

  /**
   * mount() — Validate, collect, render, mount all S2 panels.
   * Called each time Screen 2 activates.
   */
  mount: function() {
    var $ = App.Utils.$;

    /* 1. Validation already done in app-core-s1.js before goTo(2) */

    /* 2. Collect form data */
    var data = App.Form.collectData();
    var loadedRecord = App.State.loadedRecord || null;

    /* 3. Snapshot shell geometry */
    App.Shell.snapshot();

    /* 4. Render all S2 panels */
    var mapPanel    = $('p2-map');
    var cardPanel   = $('p2-card');
    var txPanel     = $('p2-tx');
    var txBtnPanel  = $('p2-tx-btn');

    if (mapPanel)    mapPanel.innerHTML    = App.Panels.S2.map.render(data, loadedRecord);
    if (cardPanel)   cardPanel.innerHTML   = App.Panels.S2.card.render();
    if (txPanel)     txPanel.innerHTML     = App.Panels.S2.tx.render(data);
    if (txBtnPanel)  txBtnPanel.innerHTML  = App.Panels.S2.txBtn.render();

    /* 5. Mount the BSVCard (build + initTabs + scaleCard) */
    App.Panels.S2.card.mount(data);

    /* 6. Mount the sign button (wire click → App.Transmit.sign) */
    App.Panels.S2.txBtn.mount();

    /* 7. Update preview badge text */
    var badge = $('preview-badge');
    if (badge) {
      badge.textContent = App.State.mode === 'update' ? 'UPDATE PREVIEW' : 'NOT YET ON CHAIN';
    }

    /* 8. Disable S2 CLEAR button — nothing to clear on the preview screen */
    var s2 = document.getElementById('screen-2');
    if (s2) {
      var clearBtn = s2.querySelector('.clear-btn');
      if (clearBtn) clearBtn.disabled = true;
    }

    App.StatusBar.set('PREVIEW LOADED', 'ok');
  }
};
