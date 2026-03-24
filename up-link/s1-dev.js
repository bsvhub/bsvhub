/* ═══════════════════════════════════════════════════════════════
   s1-dev.js — Developer Panel (Screen 1, #p1-dev) (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Self-contained panel: HTML template + bio gauge wiring.
             Everything for #p1-dev in one file.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.Gauge, App.WordGuard (from app-core.js).

   OUTPUTS:  App.Panels.S1.dev — { render(), mount(), init() }

   DEPENDS:  settings.js, app-core.js.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S1 = App.Panels.S1 || {};

App.Panels.S1.dev = {
  render: function() {
    var S = SETTINGS;
    return '' +
      '<div class="plabel" id="lbl-dev">' + App.Utils.esc(S.LABEL_DEV) + '</div>' +
      '<div class="dev-field"><lbl>PAYMAIL</lbl><input type="text" id="dev-paymail" placeholder="auto from wallet" readonly></div>' +
      '<div class="dev-field"><lbl>TWITTER</lbl><input type="text" id="dev-tw" placeholder="@handle"></div>' +
      '<div class="dev-field"><lbl>GITHUB</lbl><input type="text" id="dev-gh" placeholder="https://github.com/..."></div>' +
      '<div class="section-head" style="flex-shrink:0;margin-top:2px;">' +
        '<span class="plabel">BIO</span>' +
        '<span class="ccount" id="bio-c"></span>' +
      '</div>' +
      '<div class="gtrack"><div class="gfill" id="bio-g" style="width:0%"></div></div>' +
      '<textarea id="dev-bio" placeholder="A few lines about you or your project..." class="bio-textarea"></textarea>';
  },

  mount: function() {
    // Gauge + WordGuard wiring deferred to init()
  },

  init: function() {
    var $ = App.Utils.$;
    var bio = $('dev-bio');
    App.WordGuard.snapshot(bio);
    bio.addEventListener('keydown', function() { App.WordGuard.snapshot(bio); });
    bio.addEventListener('paste', function() {
      App.WordGuard.snapshot(bio);
      setTimeout(function() {
        App.WordGuard.enforce(bio);
        App.Gauge.update(bio.value.length, SETTINGS.MAX_BIO_CHARS, $('bio-c'), $('bio-g'));
      }, 0);
    });
    bio.addEventListener('input', function() {
      App.WordGuard.enforce(bio);
      App.Gauge.update(bio.value.length, SETTINGS.MAX_BIO_CHARS, $('bio-c'), $('bio-g'));
    });
  }
};
