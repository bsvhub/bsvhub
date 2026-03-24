/* ═══════════════════════════════════════════════════════════════
   s1-desc.js — Description Panel (Screen 1, #p1-desc) (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Self-contained panel: HTML template + character gauge
             wiring. Everything for #p1-desc in one file.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.Gauge, App.WordGuard (from app-core.js).

   OUTPUTS:  App.Panels.S1.desc — { render(), mount(), init() }

   DEPENDS:  settings.js, app-core.js.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S1 = App.Panels.S1 || {};

App.Panels.S1.desc = {
  render: function() {
    var S = SETTINGS;
    return '' +
      '<div class="section-head">' +
        '<span class="plabel" id="lbl-desc">' + App.Utils.esc(S.LABEL_DESC) + '</span>' +
        '<span class="ccount" id="desc-c"></span>' +
      '</div>' +
      '<div class="gtrack"><div class="gfill" id="desc-g" style="width:0%"></div></div>' +
      '<textarea id="desc" placeholder="Short description shown on the app card and on hover..." style="flex:1;min-height:0;"></textarea>';
  },

  mount: function() {
    // Gauge + WordGuard wiring deferred to init()
  },

  _getDescLimit: function() {
    var bsvhub = document.getElementById('bsvhub-cb');
    var isAppIdea = bsvhub && bsvhub.checked && App.Subcat &&
      App.Subcat._selected && App.Subcat._selected.indexOf('app idea') !== -1;
    return isAppIdea ? 1024 : SETTINGS.MAX_DESC_CHARS;
  },

  init: function() {
    var $ = App.Utils.$;
    var self = this;
    var desc = $('desc');

    /* Take initial snapshot */
    App.WordGuard.snapshot(desc);

    /* Snapshot before each keypress so enforce can revert */
    desc.addEventListener('keydown', function() {
      App.WordGuard.snapshot(desc);
    });

    /* Handle paste — snapshot before, enforce after */
    desc.addEventListener('paste', function() {
      App.WordGuard.snapshot(desc);
      setTimeout(function() {
        App.WordGuard.enforce(desc);
        App.Gauge.update(desc.value.length, self._getDescLimit(), $('desc-c'), $('desc-g'));
      }, 0);
    });

    desc.addEventListener('input', function() {
      App.WordGuard.enforce(desc);
      App.Gauge.update(desc.value.length, self._getDescLimit(), $('desc-c'), $('desc-g'));
    });
  }
};
