/* ═══════════════════════════════════════════════════════════════
   s1-feat.js — Features Panel (Screen 1, #p1-feat) (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Self-contained panel: HTML template + sequential
             feature input logic. Everything for #p1-feat in
             one file.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.Gauge, App.WordGuard (from app-core.js).

   OUTPUTS:  App.Panels.S1.feat — { render(), mount() }
             App.Features       — buildRows, handleInput, getValues

   DEPENDS:  settings.js, app-core.js.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S1 = App.Panels.S1 || {};


/* ─────────────────────────────────────────────────────────────
   Panel render + mount
   ───────────────────────────────────────────────────────────── */
App.Panels.S1.feat = {
  render: function() {
    var S = SETTINGS;
    return '' +
      '<div class="section-head">' +
        '<span class="plabel" id="lbl-feat">' + App.Utils.esc(S.LABEL_FEATURES) +
          '<span class="feat-hint" id="feat-hint"></span>' +
        '</span>' +
        '<span class="ccount" id="feat-total-c"></span>' +
      '</div>' +
      '<div class="gtrack"><div class="gfill" id="feat-total-g" style="width:0%"></div></div>' +
      '<div class="feat-list" id="feat-rows"></div>';
  },

  mount: function() {
    // Features row building deferred to App.Features.init()
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Features — Sequential feature inputs with combined limit
   ───────────────────────────────────────────────────────────── */
App.Features = {
  buildRows: function() {
    var container = App.Utils.$('feat-rows');
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) {
      var row = document.createElement('div');
      row.className = 'feat-row';
      row.innerHTML =
        '<span class="feat-num">' + i + '</span>' +
        '<input type="text" id="f' + i + '" maxlength="' + SETTINGS.MAX_FEATURE_CHARS + '" ' + (i > 1 ? 'disabled ' : '') + 'placeholder="Feature ' + i + '...">' +
        '<span class="feat-count" id="fc' + i + '">\u2014</span>';
      container.appendChild(row);
    }
  },

  updateAccess: function() {
    for (var i = 2; i <= SETTINGS.MAX_FEATURES; i++) {
      var prev = App.Utils.$('f' + (i - 1)), cur = App.Utils.$('f' + i), cEl = App.Utils.$('fc' + i);
      if (prev.value.trim().length > 0) { cur.disabled = false; }
      else { cur.disabled = true; cur.value = ''; cEl.textContent = '\u2014'; cEl.style.color = 'var(--dim)'; cur.style.borderColor = ''; }
    }
  },

  handleInput: function(index, el) {
    App.WordGuard.enforce(el);

    var MAX_EACH = SETTINGS.MAX_FEATURE_CHARS, MAX_ALL = SETTINGS.MAX_FEATURES_COMBINED;
    if (el.value.length > MAX_EACH) el.value = el.value.slice(0, MAX_EACH);

    var total = 0;
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) { var e = App.Utils.$('f' + i); if (e) total += e.value.length; }
    if (total > MAX_ALL) { el.value = el.value.slice(0, Math.max(0, el.value.length - (total - MAX_ALL))); total = MAX_ALL; }

    var cEl = App.Utils.$('fc' + index), len = el.value.length, rem = MAX_EACH - len;
    if (!len) { cEl.textContent = '\u2014'; cEl.style.color = 'var(--dim)'; el.style.borderColor = ''; }
    else {
      cEl.textContent = rem < 20 ? rem : len;
      cEl.style.color = rem === 0 ? 'var(--accent)' : rem < 20 ? 'var(--gold)' : 'var(--dim)';
      el.style.borderColor = rem === 0 ? 'var(--accent)' : rem < 20 ? 'rgba(255,204,102,0.5)' : '';
    }
    App.Gauge.update(total, MAX_ALL, App.Utils.$('feat-total-c'), App.Utils.$('feat-total-g'));
    this.updateAccess();
  },

  getValues: function() {
    var feats = [];
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) { var v = App.Utils.$('f' + i).value.trim(); if (v) feats.push(v); }
    return feats;
  },

  init: function() {
    var self = this;
    this.buildRows();
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) {
      (function(idx) {
        var el = App.Utils.$('f' + idx);
        App.WordGuard.snapshot(el);
        el.addEventListener('keydown', function() { App.WordGuard.snapshot(el); });
        el.addEventListener('paste', function() {
          App.WordGuard.snapshot(el);
          setTimeout(function() { self.handleInput(idx, el); }, 0);
        });
        el.addEventListener('input', function() { self.handleInput(idx, el); });
      })(i);
    }
  }
};
