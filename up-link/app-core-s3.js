/* ═══════════════════════════════════════════════════════════════
   app-core-s3.js — Screen 3 Orchestrator (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Assembles Screen 3 (On-Chain Viewer). Renders S3 panel
             HTML into wireframe slots at boot, mounts panels, and
             initialises App.Viewer. S3 panels are always available
             (no form data dependency).

   INPUTS:   App.Panels.S3.* (from txid-in.js, map-down.js, card.js).
             App.Viewer (from map-down.js).
             App.Utils (from app-core.js).

   OUTPUTS:  App.CoreS3 — { init() }

   DEPENDS:  app-core.js, txid-in.js, map-down.js, card.js.

   NOTES:    Called once by app-init.js during bootstrap.
             S3 content is populated dynamically by App.Viewer.loadTx()
             when the user enters a TXID — the panels start with
             placeholder content.
   ═══════════════════════════════════════════════════════════════ */

App.CoreS3 = {

  /**
   * init() — Render S3 panels, mount, init viewer.
   * Called once at boot by App.Init().
   */
  init: function() {
    var $ = App.Utils.$;
    var s3 = App.Panels.S3;

    /* 1. Render panel HTML into wireframe slots */
    $('p3-txid').innerHTML   = s3.txid.render();
    $('p3-table').innerHTML  = s3.table.render();
    $('p3-card').innerHTML   = s3.card.render();

    /* 2. Mount panels (wire load button, etc.) */
    s3.txid.mount();
    s3.table.mount();
    s3.card.mount();

    /* 3. Initialize the viewer (Enter key, ?tx= URL param, resize handler) */
    App.Viewer.init();
  }
};
