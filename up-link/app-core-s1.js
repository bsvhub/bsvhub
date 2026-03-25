/* ═══════════════════════════════════════════════════════════════
   app-core-s1.js — Screen 1 Orchestrator (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Assembles Screen 1 (Submit Form). Renders all S1 panel
             HTML into wireframe slots, adds CSS classes, calls mount()
             on panels that need it, and initialises all S1-specific
             modules in dependency order.

   INPUTS:   App.Panels.S1.* (from s1-icon.js, s1-details.js, s1-desc.js,
             s1-dev.js, s1-feat.js, in-tx.js).
             App.Utils, App.SettingsApplier (from app-core.js).
             SETTINGS (from settings.js).

   OUTPUTS:  App.CoreS1 — { init() }

   DEPENDS:  app-core.js, s1-*.js, in-tx.js.

   NOTES:    Called once by app-init.js during bootstrap.
             Screen 1 is rendered at boot (always visible).
             Panel render() populates DOM, then mount()/init() wire
             event listeners and dynamic builders.
   ═══════════════════════════════════════════════════════════════ */

App.CoreS1 = {

  /**
   * init() — Render all S1 panels, apply CSS classes, mount, init modules.
   * Called once at boot by App.Init().
   */
  init: function() {
    var $ = App.Utils.$;
    var s1 = App.Panels.S1;

    /* 1. Render panel HTML into wireframe slots */
    $('p1-icon').innerHTML    = s1.icon.render();
    $('p1-det').innerHTML     = s1.det.render();
    $('p1-desc').innerHTML    = s1.desc.render();
    $('p1-dev').innerHTML     = s1.dev.render();
    $('p1-feat').innerHTML    = s1.feat.render();
    $('p1-tx').innerHTML      = s1.tx.render();
    $('p1-tx-btn').innerHTML  = s1.txBtn.render();

    /* 2. Add panel-specific CSS classes for styling hooks */
    $('p1-icon').classList.add('panel-icon');
    $('p1-feat').classList.add('panel-feat');
    $('p1-tx').classList.add('panel-tx');

    /* 3. Apply field limits, maxlengths, slider defaults from SETTINGS */
    App.SettingsApplier.applyFieldLimits();

    /* 4. Mount panels that need dynamic builders (cat grid, status select, lang, tips) */
    s1.det.mount();
    s1.icon.mount();
    s1.tx.mount();
    s1.txBtn.mount();

    /* 5. Set statusbar label */
    var sbVersion = $('sb-version');
    if (sbVersion) sbVersion.textContent = SETTINGS.STATUSBAR_LABEL_S1;

    /* 6. Initialize all S1 panel-specific modules */
    App.Panels.S1.desc.init();    /* desc gauge + wordguard */
    App.Panels.S1.dev.init();     /* bio gauge + wordguard */
    App.Features.init();          /* s1-feat.js */
    App.Tips.init();              /* in-tx.js */
    App.Icon.init();              /* s1-icon.js */
    App.Screenshots.init();       /* s1-icon.js */
    App.Subcat.init();            /* s1-details.js */
    App.Lang.init();              /* s1-details.js */
    App.VersionGuard.init();      /* s1-details.js */
    App.ReleaseDate.init();       /* s1-details.js */
    App.Form.init();              /* app-form.js */

    /* 7. Initialize label alignment for S1 panels */
    App.LabelAlign.init();

    /* 8. Final UI sync */
    App.Icon.updatePreviewStyles();

    /* 9. Wire submit button — validate on S1 BEFORE navigating to S2 */
    var subBtn = $('sub-btn');
    if (subBtn) {
      subBtn.addEventListener('click', function() {
        if (!App.Form.validate()) return;   /* Stay on S1, show errors here */
        goTo(2);
      });
      /* Update tooltip on hover so it's always fresh */
      var subWrap = $('sub-btn-wrap');
      if (subWrap) {
        subWrap.addEventListener('mouseenter', function() {
          if (App.Panels.S1.txBtn.updateTooltip) App.Panels.S1.txBtn.updateTooltip();
        });
      }
    }

    /* 10. Wire mode-viewer link to navigate to Screen 3 */
    var viewerLink = $('mode-viewer');
    if (viewerLink) {
      viewerLink.addEventListener('click', function(e) {
        e.preventDefault();
        App.Mode.set('submit', true);
        goTo(3);
      });
    }

    /* 11. Wire CLEAR button — wipe all form data and images */
    var clearBtn = $('clear-form-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        App.Form.clearAll();
      });
    }
  }
};
