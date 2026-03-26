/* ═══════════════════════════════════════════════════════════════
   s1-details.js — App Details Panel (Screen 1, #p1-det) (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Self-contained panel: HTML template, language selector,
             subcategory dropdown, release date input, version guard.
             Everything for #p1-det in one file.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.State, App.StatusBar, App.SettingsApplier
             (from app-core.js).

   OUTPUTS:  App.Panels.S1.det  — { render(), mount() }
             App.Lang           — multi-language selector with pills
             App.Subcat         — subcategory dropdown (max 3)
             App.ReleaseDate    — TODAY checkbox + DD/MM/YYYY input
             App.VersionGuard   — numbers+dots only in version field

   DEPENDS:  settings.js, app-core.js.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S1 = App.Panels.S1 || {};


/* ─────────────────────────────────────────────────────────────
   Panel render + mount
   ───────────────────────────────────────────────────────────── */
App.Panels.S1.det = {
  render: function() {
    var S = SETTINGS;
    return '' +
      '<div class="plabel plabel-details" id="lbl-details">' + App.Utils.esc(S.LABEL_DETAILS) + '</div>' +
      '<div class="row row-multi"><lbl id="lbl-name">NAME</lbl><input type="text" id="app-name" placeholder="My BSV App" style="flex:2 1 0;width:0;min-width:0;"><lbl>ABBR</lbl><input type="text" id="app-abbr" placeholder="MBA" style="flex:1 1 0;width:0;min-width:0;"></div>' +
      '<div class="row"><lbl id="lbl-url">URL</lbl><input type="url" id="app-url" placeholder="https://myapp.io"></div>' +
      '<div class="row"><lbl>TOR</lbl><input type="text" id="app-tor" placeholder="http://example.onion" spellcheck="false"></div>' +
      '<div class="row"><lbl>B://</lbl><input type="text" id="app-bsv" placeholder="txid" spellcheck="false"></div>' +
      '<div class="row"><lbl>TAGS</lbl><input type="text" id="app-tags" placeholder="wallet, nft, payments"></div>' +
      '<div style="width:100%;flex-shrink:0;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">' +
          '<lbl class="cat-lbl" style="min-width:auto;padding-top:0;">CAT</lbl>' +
          '<span style="color:var(--dim);letter-spacing:0.5px;">\u2014 PICK ONE \u00b7 BEST FIT</span>' +
        '</div>' +
        '<div class="cat-grid-new" id="cat-grid-new"></div>' +
      '</div>' +
      '<div class="row subcat-row">' +
        '<lbl id="lbl-sub">SUB</lbl>' +
        '<div class="subcat-wrap">' +
          '<button class="file-btn subcat-btn-el" id="subcat-btn" type="button">\u25be SUBCAT</button>' +
          '<div class="subcat-dd" id="subcat-dd"></div>' +
        '</div>' +
        '<div class="subcat-pills" id="subcat-pills"></div>' +
      '</div>' +
      '<div class="row"><lbl>LANG</lbl><div class="lang-wrap" id="lang-wrap"><div class="lang-dd-wrap"><button class="file-btn lang-dd-btn" id="lang-btn" type="button">\u25be SELECT</button><div class="lang-dd" id="lang-dd" style="display:none;"></div></div><div class="lang-pills" id="lang-pills"></div></div></div>' +
      '<div class="row row-multi row-rel"><lbl>REL</lbl><label class="clr-toggle" style="gap:4px;"><input type="checkbox" id="rel-today"><div class="tbox"></div></label><lbl>TODAY</lbl><input type="text" id="app-rel" placeholder="DD/MM/YYYY" style="flex:0 0 auto;width:14ch;" maxlength="10"><lbl>VER</lbl><input type="text" id="app-ver" placeholder="0.0.0" style="flex:0 0 auto;width:11ch;" maxlength="11"><lbl style="margin-left:10px;" id="lbl-status">STATUS</lbl><select id="app-status"></select></div>' +
      '<div class="bsv-flags-row">' +
        '<label class="bsv-flag"><input type="checkbox" id="flag-bsv-content"><div class="tbox bsv-tbox"></div><span class="bflag-lbl">BSV CONTENT</span></label>' +
        '<label class="bsv-flag"><input type="checkbox" id="brc100-on"><div class="tbox bsv-tbox"></div><span class="bflag-lbl">BRC-100</span></label>' +
        '<label class="bsv-flag"><input type="checkbox" id="flag-on-chain"><div class="tbox bsv-tbox"></div><span class="bflag-lbl">ON-CHAIN</span></label>' +
        '<label class="bsv-flag"><input type="checkbox" id="flag-accepts-bsv"><div class="tbox bsv-tbox"></div><span class="bflag-lbl">\u20bfPAY</span></label>' +
        '<label class="bsv-flag"><input type="checkbox" id="flag-open-source"><div class="tbox bsv-tbox"></div><span class="bflag-lbl">OPEN-SOURCE</span></label>' +
      '</div>';
  },

  mount: function() {
    App.SettingsApplier._buildCatGrid();
    App.SettingsApplier._buildSelect('app-status', SETTINGS.STATUSES);
    App.SettingsApplier._buildLangDropdown();
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Lang — Multi-language selector with dropdown checkboxes
   ───────────────────────────────────────────────────────────── */
App.Lang = {
  _dropdownOpen: false,

  toggle: function() {
    this._dropdownOpen = !this._dropdownOpen;
    App.Utils.$('lang-dd').style.display = this._dropdownOpen ? 'block' : 'none';
  },

  close: function() {
    this._dropdownOpen = false;
    App.Utils.$('lang-dd').style.display = 'none';
  },

  getSelected: function() {
    var checked = Array.prototype.slice.call(document.querySelectorAll('#lang-dd input[type=checkbox]:checked'));
    var vals = [];
    for (var i = 0; i < checked.length; i++) { vals.push(checked[i].value); }
    return vals;
  },

  getSelectedLabels: function() {
    var checked = Array.prototype.slice.call(document.querySelectorAll('#lang-dd input[type=checkbox]:checked'));
    var labels = [];
    for (var i = 0; i < checked.length; i++) {
      labels.push({ value: checked[i].value, label: checked[i].dataset.label });
    }
    return labels;
  },

  updatePills: function() {
    var self = this;
    var pills = App.Utils.$('lang-pills');
    pills.innerHTML = '';
    var labels = this.getSelectedLabels();
    for (var i = 0; i < labels.length; i++) {
      (function(lang) {
        var pill = document.createElement('span');
        pill.className = 'lang-pill';
        pill.innerHTML = lang.value.toUpperCase() + '<span class="lang-x">\u2715</span>';
        pill.addEventListener('click', function() {
          var cb = document.querySelector('#lang-dd input[value="' + lang.value + '"]');
          if (cb) { cb.checked = false; }
          self.updatePills();
        });
        pills.appendChild(pill);
      })(labels[i]);
    }
    var count = this.getSelected().length;
    App.Utils.$('lang-btn').textContent = count >= SETTINGS.MAX_LANGUAGES
      ? '\u25BE MAX ' + SETTINGS.MAX_LANGUAGES
      : '\u25BE SELECT';
  },

  handleCheck: function(cb) {
    var selected = this.getSelected();
    if (cb.checked && selected.length > SETTINGS.MAX_LANGUAGES) {
      cb.checked = false;
      App.StatusBar.set('MAX ' + SETTINGS.MAX_LANGUAGES + ' LANGUAGES ALLOWED', 'warn');
      return;
    }
    this.updatePills();
  },

  getValue: function() {
    var sel = this.getSelected();
    return sel.length ? sel.join(';') : 'en';
  },

  init: function() {
    var self = this;
    App.Utils.$('lang-btn').addEventListener('click', function() { self.toggle(); });

    document.addEventListener('click', function(e) {
      if (self._dropdownOpen && !App.Utils.$('lang-wrap').contains(e.target)) {
        self.close();
      }
    });

    var cbs = Array.prototype.slice.call(document.querySelectorAll('#lang-dd input[type=checkbox]'));
    for (var i = 0; i < cbs.length; i++) {
      (function(cb) {
        cb.addEventListener('change', function() { self.handleCheck(cb); });
      })(cbs[i]);
    }

    this.updatePills();
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Subcat — Subcategory dropdown (max 3, optional)
   ───────────────────────────────────────────────────────────── */
App.Subcat = {
  _open: false,
  _selected: [],

  updateForCategory: function(catVal) {
    var self = this;
    this._selected = [];
    this._catVal = catVal;

    /* Read colour/subcategories from unified CATEGORIES config */
    var catDef = App.Category ? App.Category.getConfig() : null;
    if (!catDef) catDef = {};
    this._catColor  = catDef.color  || 'var(--amber)';
    this._catBorder = catDef.border || 'rgba(234,179,0,0.4)';
    this._catBg     = catDef.bg     || 'rgba(234,179,0,0.07)';

    var btn = App.Utils.$('subcat-btn');
    if (btn) {
      btn.style.color       = this._catColor;
      btn.style.borderColor = this._catBorder;
    }

    var checked = Array.prototype.slice.call(document.querySelectorAll('#subcat-dd input[type=checkbox]'));
    for (var i = 0; i < checked.length; i++) { checked[i].checked = false; }
    this._renderPills();
    var dd = App.Utils.$('subcat-dd');
    if (!dd) return;
    dd.style.borderColor = this._catBorder;

    /* Read subcategories from category config (strings or objects with overrides) */
    var opts = catDef.subcategories || [];
    dd.innerHTML = '';
    if (!opts.length) {
      var item = document.createElement('div');
      item.className = 'subcat-dd-item'; item.style.color = 'var(--dim)'; item.textContent = 'no subcategories';
      dd.appendChild(item); return;
    }
    for (var oi = 0; oi < opts.length; oi++) {
      (function(opt) {
        /* Subcategory can be a string or an object { value, mandatory, overrides } */
        var val = typeof opt === 'object' ? opt.value : opt;
        var item = document.createElement('label');
        item.className = 'subcat-dd-item';
        item.innerHTML = '<input type="checkbox" value="' + val + '"><div class="tbox"></div><span>' + val + '</span>';
        var tbox = item.querySelector('.tbox');
        tbox.style.borderColor = self._catBorder;
        var cb = item.querySelector('input');
        cb.addEventListener('change', function() {
          tbox.style.borderColor = cb.checked ? self._catColor : self._catBorder;
          tbox.style.background  = cb.checked ? self._catBg    : '';
          self._handleCheck(cb);
        });
        item.addEventListener('mouseenter', function() { item.style.color = self._catColor; item.style.background = self._catBg; });
        item.addEventListener('mouseleave', function() { item.style.color = ''; item.style.background = ''; });
        dd.appendChild(item);
      })(opts[oi]);
    }
  },

  _handleCheck: function(cb) {
    if (cb.checked) {
      if (this._selected.length >= SETTINGS.MAX_SUBCATEGORIES) {
        cb.checked = false;
        App.StatusBar.set('MAX ' + SETTINGS.MAX_SUBCATEGORIES + ' SUBCATEGORIES ALLOWED', 'warn'); return;
      }
      if (!this._selected.includes(cb.value)) this._selected.push(cb.value);
    } else {
      this._selected = this._selected.filter(function(v) { return v !== cb.value; });
    }
    this._renderPills(); this._updateBtnLabel();
    /* Notify form of subcat change (for desc char limit + mandatory update) */
    if (App.Form && App.Form._updateDescLimit) App.Form._updateDescLimit();
    if (App.Form && App.Form._setMandatory) App.Form._setMandatory();
  },

  _renderPills: function() {
    var self = this;
    var c = App.Utils.$('subcat-pills'); if (!c) return;
    c.innerHTML = '';
    var color  = this._catColor  || 'rgba(0,229,255,0.85)';
    var border = this._catBorder || 'rgba(0,229,255,0.3)';
    var bg     = this._catBg     || 'rgba(0,229,255,0.07)';
    for (var i = 0; i < this._selected.length; i++) {
      (function(val) {
        var pill = document.createElement('span');
        pill.className = 'subcat-pill';
        pill.style.color       = color;
        pill.style.borderColor = border;
        pill.style.background  = bg;
        pill.innerHTML = val + '<span class="subcat-x">\u2715</span>';
        pill.addEventListener('mouseenter', function() { pill.style.borderColor = 'var(--accent)'; pill.style.color = 'var(--accent)'; });
        pill.addEventListener('mouseleave', function() { pill.style.borderColor = border; pill.style.color = color; });
        pill.addEventListener('click', function() {
          self._selected = self._selected.filter(function(v) { return v !== val; });
          var cb = document.querySelector('#subcat-dd input[value="' + val + '"]');
          if (cb) {
            cb.checked = false;
            var tbox = cb.nextElementSibling;
            if (tbox) { tbox.style.borderColor = border; tbox.style.background = ''; }
          }
          self._renderPills(); self._updateBtnLabel();
          if (App.Form && App.Form._updateDescLimit) App.Form._updateDescLimit();
          if (App.Form && App.Form._setMandatory) App.Form._setMandatory();
        });
        c.appendChild(pill);
      })(this._selected[i]);
    }
  },

  _updateBtnLabel: function() {
    var btn = App.Utils.$('subcat-btn'); if (!btn) return;
    btn.textContent = this._selected.length >= SETTINGS.MAX_SUBCATEGORIES
      ? ('\u25BE MAX ' + SETTINGS.MAX_SUBCATEGORIES) : '\u25BE SUBCAT';
  },

  toggle: function() {
    this._open = !this._open;
    var dd = App.Utils.$('subcat-dd'); if (dd) dd.classList.toggle('open', this._open);
  },

  close: function() {
    this._open = false;
    var dd = App.Utils.$('subcat-dd'); if (dd) dd.classList.remove('open');
  },

  getValue: function() { return this._selected.join(';'); },

  init: function() {
    var self = this;
    var btn = App.Utils.$('subcat-btn');
    if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); self.toggle(); });
    document.addEventListener('click', function(e) {
      var wrap = document.querySelector('.subcat-wrap');
      if (self._open && wrap && !wrap.contains(e.target)) self.close();
    });
  }
};


/* ─────────────────────────────────────────────────────────────
   App.VersionGuard — Enforces numbers and dots only in version
   ───────────────────────────────────────────────────────────── */
App.VersionGuard = {
  enforce: function(el) {
    var cleaned = el.value.replace(/[^0-9.]/g, '');
    if (cleaned !== el.value) {
      el.value = cleaned;
      App.StatusBar.set('VERSION \u2014 NUMBERS AND DOTS ONLY', 'warn');
    }
  },

  init: function() {
    var self = this;
    var el = App.Utils.$('app-ver');
    el.addEventListener('input', function() { self.enforce(el); });
  }
};


/* ─────────────────────────────────────────────────────────────
   App.ReleaseDate — TODAY checkbox + DD/MM/YYYY date input
   ───────────────────────────────────────────────────────────── */
App.ReleaseDate = {
  formatToday: function() {
    var d = new Date();
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  },

  toISO: function(val) {
    var parts = val.split('/');
    if (parts.length !== 3) return val;
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  },

  enforce: function(el) {
    var cleaned = el.value.replace(/[^0-9/]/g, '');
    if (cleaned !== el.value) {
      el.value = cleaned;
      App.StatusBar.set('RELEASE DATE \u2014 USE DD/MM/YYYY FORMAT', 'warn');
    }
  },

  init: function() {
    var self = this;
    var $ = App.Utils.$;
    var cb = $('rel-today'), inp = $('app-rel');
    cb.addEventListener('change', function() {
      if (cb.checked) {
        inp.value = self.formatToday();
        inp.disabled = true;
      } else {
        inp.value = '';
        inp.disabled = false;
        inp.focus();
      }
    });
    inp.addEventListener('input', function() { self.enforce(inp); });
  }
};
