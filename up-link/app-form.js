/* ═══════════════════════════════════════════════════════════════
   app-form.js — Form Validation + Data Collection + Word Filter
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Cross-cutting form logic: category click handling,
             data collection from all fields, validation, and
             the (currently disabled) word filter module.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.State, App.StatusBar, App.WordGuard
             (from app-core.js).
             DOM elements rendered by panel-*.js controllers.

   OUTPUTS:  App.Form       — collectData(), validate(), getCategory()
             App.WordFilter — content moderation (DISABLED)

   DEPENDS:  settings.js, app-core.js, panel-*.js (DOM elements).
             App.Features, App.Tips, App.Lang, App.Subcat,
             App.ReleaseDate, App.Screenshots, App.Icon
             (from their respective panel-*.js files).

   NOTES:    All panel-specific modules (Features, Tips, Icon, Lang,
             Subcat, ReleaseDate, VersionGuard, Screenshots) now live
             in their own panel-*.js files. This file only contains
             the cross-cutting form logic that spans multiple panels.
   ═══════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   App.Form — Categories, validation, data collection
   ───────────────────────────────────────────────────────────── */
App.Form = {
  getCategory: function() {
    var bsvhub = document.getElementById('bsvhub-cb');
    if (bsvhub && bsvhub.checked) return 'bsvhub';
    var active = document.querySelector('.cat-btn-new.active');
    return active ? active.dataset.val : '';
  },

  collectData: function() {
    var $ = App.Utils.$, st = App.State;
    var iconMode = document.querySelector('input[name=isrc]:checked').value;
    var ssData = App.Screenshots ? App.Screenshots.getData() : { screenshots: [null, null, null, null] };
    // Build screenshot txid fields from slot data
    var ssFields = {};
    var ss = ssData.screenshots || [null, null, null, null];
    for (var si = 0; si < 4; si++) {
      var n = si + 1;
      var slot = ss[si];
      if (slot) {
        // If slot has a txid (from on-chain fetch), use it; otherwise pending (will be uploaded)
        ssFields['ss' + n + '_txid'] = slot.txid || '(pending)';
        ssFields['ss' + n + '_format'] = slot.mime || '';
        ssFields['ss' + n + '_size_kb'] = String(slot.kb || '');
        ssFields['ss' + n + '_zoom'] = $('zom') ? $('zom').value : '1';
      }
    }
    var base = {
      protocol: SETTINGS.PROTOCOL_PREFIX, protocol_version: SETTINGS.PROTOCOL_VERSION,
      name: $('app-name').value.trim(), abbreviation: $('app-abbr').value.trim(), url: $('app-url').value.trim(),
      tor_url: $('app-tor').value.trim(), bsv_address: $('app-bsv').value.trim(),
      tags: $('app-tags').value.trim(),
      category: this.getCategory(),
      subcategory: App.Subcat ? App.Subcat.getValue() : '',
      status: $('app-status').value, language: App.Lang.getValue(),
      bsv_content: $('flag-bsv-content').checked,
      brc100: $('brc100-on').checked,
      on_chain: $('flag-on-chain').checked,
      accepts_bsv: $('flag-accepts-bsv').checked,
      open_source: $('flag-open-source').checked,
      version: $('app-ver').value.trim(), release_date: App.ReleaseDate.toISO($('app-rel').value.trim()), description: $('desc').value.trim(), features: App.Features.getValues(),
      icon_source: iconMode, icon_txid: iconMode === 'txid' ? $('icon-txid').value.trim() : '(pending)',
      icon_format: st.iconMime || '\u2014', icon_filename: st.iconFilename || '\u2014', icon_size_kb: st.iconKb || '\u2014',
      icon_bg_enabled: $('cbg-on').checked, icon_fg_enabled: $('cfg-on').checked,
      icon_bg_colour: $('cbg').value, icon_fg_colour: $('cfg').value, icon_bg_alpha: $('opc').value,
      icon_zoom: $('zom').value, alt_text: $('icon-alt').value.trim(),
      developer_paymail: $('dev-paymail').value.trim(), developer_twitter: $('dev-tw').value.trim(),
      developer_github: $('dev-gh').value.trim(), developer_bio: $('dev-bio').value.trim(),
      icon_data_b64: st.iconDataB64, icon_chain_url: st.iconChainUrl, icon_width: null, icon_height: null,
      screenshots: ssData.screenshots,
      tip_bsv: st.selectedTip
    };
    return Object.assign(base, ssFields);
  },

  /* Flash a field and its label to draw attention on validation failure.
     Does NOT auto-focus — caller decides which field gets focus. */
  _flashField: function(fieldEl, labelEl) {
    if (fieldEl) {
      fieldEl.classList.remove('flash-field');
      void fieldEl.offsetWidth; // force reflow to restart animation
      fieldEl.classList.add('flash-field');
      fieldEl.addEventListener('animationend', function() { fieldEl.classList.remove('flash-field'); }, { once: true });
    }
    if (labelEl) {
      labelEl.classList.remove('flash-label');
      void labelEl.offsetWidth;
      labelEl.classList.add('flash-label');
      labelEl.addEventListener('animationend', function() { labelEl.classList.remove('flash-label'); }, { once: true });
    }
  },

  // Find the nearest <lbl> sibling for a given input element.
  _findLabel: function(fieldEl) {
    if (!fieldEl) return null;
    var row = fieldEl.closest('.row, .panel, .dev-field');
    if (row) {
      // Look for lbl.req first, then any lbl, then .plabel.req, then .plabel
      return row.querySelector('lbl.req') || row.querySelector('lbl') || row.querySelector('.plabel.req') || row.querySelector('.plabel');
    }
    return null;
  },

  /* Check if any data has been entered at all */
  _hasAnyData: function() {
    var $ = App.Utils.$;
    if ($('app-name').value.trim()) return true;
    if ($('app-url').value.trim()) return true;
    if ($('desc').value.trim()) return true;
    if ($('app-tags').value.trim()) return true;
    if ($('app-tor').value.trim()) return true;
    if ($('app-bsv').value.trim()) return true;
    if ($('app-abbr').value.trim()) return true;
    if ($('dev-bio').value.trim()) return true;
    if ($('dev-paymail').value.trim()) return true;
    if (this.getCategory()) return true;
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) {
      if ($('f' + i) && $('f' + i).value.trim()) return true;
    }
    return false;
  },

  validate: function() {
    var $ = App.Utils.$;
    var isBsvhub = this.getCategory() === 'bsvhub';

    /* Non-BSVhub: no mandatory fields, but must have some data */
    if (!isBsvhub) {
      if (!this._hasAnyData()) {
        App.StatusBar.set('NO DATA TO UPLOAD', 'err');
        this._flashField($('app-name'), document.getElementById('lbl-name'));
        return false;
      }
    } else if (this._isAppIdea()) {
      /* BSVhub "app idea" — only DESCRIPTION is mandatory */
      if (!$('desc').value.trim()) {
        App.StatusBar.set('DESCRIPTION IS REQUIRED FOR APP IDEA', 'err');
        this._flashField($('desc'), document.getElementById('lbl-desc'));
        return false;
      }
    } else {
      /* BSVhub (non-app-idea) — flash ALL missing mandatory fields at once */
      var missing = [];
      var checks = [
        { ok: !!$('app-name').value.trim(),       field: $('app-name'),                          label: 'lbl-name',   name: 'NAME' },
        { ok: !!$('app-url').value.trim(),         field: $('app-url'),                           label: 'lbl-url',    name: 'URL' },
        { ok: !!$('app-status').value,             field: $('app-status'),                        label: 'lbl-status', name: 'STATUS' },
        { ok: !!$('desc').value.trim(),            field: $('desc'),                              label: 'lbl-desc',   name: 'DESCRIPTION' },
        { ok: !!(App.Subcat && App.Subcat.getValue()), field: document.getElementById('subcat-btn'), label: 'lbl-sub',    name: 'SUBCATEGORY' }
      ];
      for (var ci = 0; ci < checks.length; ci++) {
        if (!checks[ci].ok) {
          missing.push(checks[ci].name);
          this._flashField(checks[ci].field, document.getElementById(checks[ci].label));
        }
      }
      if (missing.length) {
        App.StatusBar.set('MANDATORY FIELDS: ' + missing.join(', '), 'err');
        /* Focus the first missing field */
        for (var fi = 0; fi < checks.length; fi++) {
          if (!checks[fi].ok && checks[fi].field && checks[fi].field.focus) {
            checks[fi].field.focus(); break;
          }
        }
        return false;
      }
    }

    // Check all guarded fields for word length violations
    var descCheck = App.WordGuard.check($('desc').value);
    if (!descCheck.valid) { App.StatusBar.set('DESCRIPTION HAS WORD TOO LONG: ' + descCheck.badWord, 'err'); return false; }
    var bioCheck = App.WordGuard.check($('dev-bio').value);
    if (!bioCheck.valid) { App.StatusBar.set('BIO HAS WORD TOO LONG: ' + bioCheck.badWord, 'err'); return false; }
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) {
      var fVal = $('f' + i) ? $('f' + i).value : '';
      if (fVal) {
        var fCheck = App.WordGuard.check(fVal);
        if (!fCheck.valid) { App.StatusBar.set('FEATURE ' + i + ' HAS WORD TOO LONG: ' + fCheck.badWord, 'err'); return false; }
      }
    }
    return true;
  },

  /* Enable/disable the subcat row based on whether a category is active */
  _setSubcatEnabled: function(enabled) {
    var btn = document.getElementById('subcat-btn');
    var wrap = document.querySelector('.subcat-row');
    if (btn) {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '' : '0.3';
      btn.style.pointerEvents = enabled ? '' : 'none';
    }
    if (wrap) wrap.style.opacity = enabled ? '' : '0.3';
  },

  /* Enable/disable the cat grid (greyed out when BSVhub is active) */
  _setCatGridEnabled: function(enabled) {
    var grid = document.getElementById('cat-grid-new');
    if (grid) {
      grid.style.opacity = enabled ? '' : '0.3';
      grid.style.pointerEvents = enabled ? '' : 'none';
    }
  },

  /* Update description char limit — 2048 for "app idea", default otherwise */
  _updateDescLimit: function() {
    var $ = App.Utils.$;
    var desc = $('desc');
    if (!desc) return;
    var bsvhub = $('bsvhub-cb');
    var isAppIdea = bsvhub && bsvhub.checked && App.Subcat &&
      App.Subcat._selected && App.Subcat._selected.indexOf('app idea') !== -1;
    var limit = isAppIdea ? 1024 : SETTINGS.MAX_DESC_CHARS;
    desc.maxLength = limit;
    /* Update gauge with new limit */
    App.Gauge.update(desc.value.length, limit, $('desc-c'), $('desc-g'));
    /* Make desc panel scrollable when expanded */
    var descPanel = $('p1-desc');
    if (descPanel) descPanel.style.overflowY = isAppIdea ? 'auto' : '';
  },

  /* Check if "app idea" subcat is currently selected under BSVhub */
  _isAppIdea: function() {
    var bsvhub = document.getElementById('bsvhub-cb');
    return bsvhub && bsvhub.checked && App.Subcat &&
      App.Subcat._selected && App.Subcat._selected.indexOf('app idea') !== -1;
  },

  /* Toggle mandatory (req) class on BSVhub-required labels.
     "app idea" mode: only DESCRIPTION is mandatory. */
  _setMandatory: function(on) {
    var appIdea = on && this._isAppIdea();
    var fullIds = ['lbl-name', 'lbl-url', 'lbl-status', 'lbl-sub'];
    for (var i = 0; i < fullIds.length; i++) {
      var el = document.getElementById(fullIds[i]);
      if (el) {
        if (on && !appIdea) el.classList.add('req');
        else el.classList.remove('req');
      }
    }
    /* DESCRIPTION is always mandatory when BSVhub is on */
    var descLbl = document.getElementById('lbl-desc');
    if (descLbl) {
      if (on) descLbl.classList.add('req');
      else descLbl.classList.remove('req');
    }
    /* BSVhub flag — blood orange when mandatory */
    var flag = document.getElementById('bsvhub-flag');
    if (flag) {
      if (on) flag.classList.add('bsvhub-mandatory');
      else flag.classList.remove('bsvhub-mandatory');
    }
    /* Subcat button — blood orange when mandatory (not in app idea mode) */
    var subcatBtn = document.getElementById('subcat-btn');
    if (subcatBtn) {
      if (on && !appIdea) subcatBtn.classList.add('req');
      else subcatBtn.classList.remove('req');
    }
  },

  init: function() {
    var self = this;
    var $ = App.Utils.$;

    /* ── BSVhub.io checkbox — dominant category ── */
    var bsvhubCb = $('bsvhub-cb');
    if (bsvhubCb) {
      /* BSVhub is checked by default — set initial state */
      self._setCatGridEnabled(false);
      self._setMandatory(true);
      if (App.Subcat) App.Subcat.updateForCategory('bsvhub');

      bsvhubCb.addEventListener('change', function() {
        if (bsvhubCb.checked) {
          /* Deselect any active cat-btn */
          var allBtns = Array.prototype.slice.call(document.querySelectorAll('.cat-btn-new'));
          for (var j = 0; j < allBtns.length; j++) { allBtns[j].classList.remove('active'); }
          self._setCatGridEnabled(false);
          self._setSubcatEnabled(true);
          self._setMandatory(true);
          if (App.Subcat) App.Subcat.updateForCategory('bsvhub');
        } else {
          self._setCatGridEnabled(true);
          self._setMandatory(false);
          /* No category selected yet — disable subcat */
          self._setSubcatEnabled(false);
          if (App.Subcat) App.Subcat.updateForCategory('');
        }
        self._updateDescLimit();
      });
    }

    // 10-button category grid — mutually exclusive, optional
    var btns = Array.prototype.slice.call(document.querySelectorAll('.cat-btn-new'));
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          /* Uncheck BSVhub when selecting a regular category */
          if (bsvhubCb && bsvhubCb.checked) {
            bsvhubCb.checked = false;
            self._setCatGridEnabled(true);
            self._setMandatory(false);
          }
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            self._setSubcatEnabled(false);
            if (App.Subcat) App.Subcat.updateForCategory('');
            self._updateDescLimit();
            return;
          }
          var allBtns = Array.prototype.slice.call(document.querySelectorAll('.cat-btn-new'));
          for (var j = 0; j < allBtns.length; j++) { allBtns[j].classList.remove('active'); }
          btn.classList.add('active');
          self._setSubcatEnabled(true);
          if (App.Subcat) App.Subcat.updateForCategory(btn.dataset.val);
          self._updateDescLimit();
        });
      })(btns[i]);
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   App.WordFilter — Content moderation via blocked-word list.

   +==============================================================+
   |  STATUS: DISABLED (local/offline mode)                        |
   |                                                               |
   |  This module loads word_filter.json via fetch() and blocks    |
   |  entries containing disallowed words in all text fields.      |
   |                                                               |
   |  WHY IT IS DISABLED:                                          |
   |  fetch() of a local JSON file is blocked by browsers under    |
   |  the file:// protocol (CORS / same-origin policy).  The       |
   |  module must remain dormant (_loaded stays false) so it       |
   |  does not throw errors or hang the app when run from disk.    |
   |                                                               |
   |  HOW TO RE-ENABLE (three steps):                              |
   |  1. Serve the app from any HTTP server, e.g.:                 |
   |       python -m http.server 8080                              |
   |  2. Uncomment the body of load() below.                       |
   |  3. Uncomment App.WordFilter.init() in App.Init.              |
   |                                                               |
   |  Everything else (check, enforce, init wiring) is already     |
   |  intact -- only the fetch call needs restoring.               |
   +==============================================================+
   ───────────────────────────────────────────────────────────── */
App.WordFilter = {
  _blockedWords: [],
  _loaded: false,       // Stays false while disabled — all guards short-circuit safely.

  // ── load() — Fetch blocked-word list from word_filter.json ──────────────────
  // DISABLED: the fetch call below is commented out so the app works locally.
  // To re-enable, un-comment the try/catch block and follow the steps above.
  load: async function() {
    // ── RE-ENABLE START ──────────────────────────────────────────────────────
    // try {
    //   var resp = await fetch('word_filter.json');
    //   if (!resp.ok) { console.warn('word_filter.json not found — filter disabled'); return; }
    //   var data = await resp.json();
    //   this._blockedWords = (data.blocked_words || []).map(function(w) { return w.toLowerCase(); });
    //   this._loaded = true;
    // } catch (e) {
    //   console.warn('Failed to load word filter:', e);
    // }
    // ── RE-ENABLE END ────────────────────────────────────────────────────────
  },

  // Check text for blocked words. Returns { clean, word } where
  // word is the first blocked word found (or null if clean).
  // NOTE: returns clean:true unconditionally while _loaded === false.
  check: function(text) {
    if (!this._loaded || !text) return { clean: true, word: null };
    var lower = text.toLowerCase();
    for (var i = 0; i < this._blockedWords.length; i++) {
      var w = this._blockedWords[i];
      // Match whole word boundaries
      var re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(lower)) return { clean: false, word: w };
    }
    return { clean: true, word: null };
  },

  // Enforce on a text input/textarea — strip offending character and show error.
  // NOTE: no-ops while _loaded === false.
  enforce: function(el) {
    var result = this.check(el.value);
    if (!result.clean) {
      // Remove the last typed character that triggered the match
      el.value = el.value.slice(0, -1);
      App.StatusBar.set('BLOCKED WORD DETECTED \u2014 INPUT REJECTED', 'err');
    }
  },

  // Wire input listeners onto every text field.
  // Called only after load() resolves so _loaded is guaranteed true first.
  init: function() {
    var self = this;
    this.load().then(function() {
      var $ = App.Utils.$;
      var fields = ['app-name', 'app-abbr', 'app-url', 'app-tags', 'desc', 'dev-tw', 'dev-gh', 'dev-bio', 'app-ver', 'icon-alt'];
      for (var i = 0; i < fields.length; i++) {
        (function(id) {
          var el = $(id);
          if (el) el.addEventListener('input', function() { self.enforce(el); });
        })(fields[i]);
      }
      // Features are dynamic — wired in App.Features.handleInput
    });
  }
};
