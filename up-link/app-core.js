/* ═══════════════════════════════════════════════════════════════
   app-core.js — Foundation Layer
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  App namespace and all foundation modules with zero
             panel-specific dependencies. Provides the shared
             utilities, state management, status bar, gauges,
             input guards, settings-to-CSS bridge, and shell
             geometry reader used by every other module.

   INPUTS:   SETTINGS (from settings.js).
             DOM: <style id="dynamic-vars">.
             window.ShellState (from wireframe.js).

   OUTPUTS:  App                 — global namespace
             App.Capabilities    — { offline, onchain } feature flags
             App.Utils           — $(), esc(), hexToRgba(), buildGradient(), isValidTxid()
             App.Config          — getStatusColour(), getAllCdnUrls()
             App.Category        — single source of truth for category selection
             App.State           — mutable app state (mode, wallet, icon data, etc)
             App.StatusBar       — set(msg, cls) per-screen status messages
             App.Gauge           — update(), init() for character counters
             App.WordGuard       — check(), enforce() word length limits
             App.SettingsApplier — applyCSS(), applyFieldLimits(), builder helpers
             App.LabelAlign      — align() input label widths per panel
             App.Shell           — snapshot() shell geometry for layout

   DEPENDS:  settings.js, wireframe.js (ShellState).

   NOTES:    Extracted from up-link.html. StatusBar modified to write
             to the active screen's .sb-l element (multi-screen support).
             SettingsApplier split: applyCSS() injects CSS vars,
             applyFieldLimits() sets maxlengths/defaults after panels mount,
             builder helpers callable by panel controllers.
   ═══════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   App namespace + capability flags
   ───────────────────────────────────────────────────────────── */
// App namespace and Capabilities bootstrapped in settings.js
// (must exist before onchain.js / offline.js set their flags)
App = App || {};
App.Capabilities = App.Capabilities || { offline: false, onchain: false };


/* ─────────────────────────────────────────────────────────────
   App.Config — Reads from SETTINGS, provides computed helpers
   ───────────────────────────────────────────────────────────── */
App.Config = {
  get: function(key) { return SETTINGS[key]; },

  getAllCdnUrls: function(txid) {
    var cb = document.getElementById('testnet-cb');
    var isTestnet = cb && cb.checked;
    var urls = isTestnet
      ? (SETTINGS.CDN_URLS_TESTNET || []).concat(SETTINGS.CDN_URLS)
      : SETTINGS.CDN_URLS;
    return urls.map(function(u) { return u.replace('{txid}', txid); });
  },

  getStatusColour: function(statusValue) {
    var match = null;
    for (var i = 0; i < SETTINGS.STATUSES.length; i++) {
      if (SETTINGS.STATUSES[i].value === statusValue) { match = SETTINGS.STATUSES[i]; break; }
    }
    return match ? match.colour : SETTINGS.AMBER;
  }
};


/* ─────────────────────────────────────────────────────────────
   App.State — All mutable application state
   ───────────────────────────────────────────────────────────── */
App.State = {
  mode:            'submit',  // 'submit' or 'update'
  onChain:         false,     // set in app-init.js after capabilities detected
  walletConnected: false,
  selectedTip:     0,
  loadedRecord:    null       // Stores the original loaded MAP data for diff comparison
  // Icon image data now stored in App.Screenshots._slots[0] (single source of truth)
};


/* ─────────────────────────────────────────────────────────────
   App.Category — Single source of truth for category selection
   ───────────────────────────────────────────────────────────── */
App.Category = {
  _active: '',  // current category value

  /* Returns active category value (string) */
  get: function() { return this._active; },

  /* Returns SETTINGS.CATEGORIES entry for active category, or null */
  getConfig: function() {
    if (!this._active) return null;
    for (var i = 0; i < SETTINGS.CATEGORIES.length; i++) {
      if (SETTINGS.CATEGORIES[i].value === this._active) return SETTINGS.CATEGORIES[i];
    }
    return null;
  },

  /* Returns the default category value (the one with default:true) */
  getDefault: function() {
    for (var i = 0; i < SETTINGS.CATEGORIES.length; i++) {
      if (SETTINGS.CATEGORIES[i]['default']) return SETTINGS.CATEGORIES[i].value;
    }
    return '';
  },

  /* Set active category — updates UI, triggers subcategory/mandatory/logo/desc refresh */
  set: function(val) {
    var prev = this._active;
    this._active = val || '';

    /* Update button UI — deselect all, select matching */
    var btns = document.querySelectorAll('.cat-btn-new');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-val') === this._active);
    }

    /* Update subcategories */
    if (App.Subcat) App.Subcat.updateForCategory(this._active);

    /* Update mandatory field labels */
    if (App.Form && App.Form._setMandatory)  App.Form._setMandatory();

    /* Update description limit */
    if (App.Form && App.Form._updateDescLimit) App.Form._updateDescLimit();

    /* Gray-out fields not applicable to active subcategory */
    if (App.Form && App.Form._applyDisabled) App.Form._applyDisabled();

    /* Enable/disable subcategory row */
    if (App.Form && App.Form._setSubcatEnabled) {
      App.Form._setSubcatEnabled(!!this._active);
    }
  },

  /* Returns mandatory field names for the active category, considering subcategory overrides */
  getMandatoryFields: function() {
    var cfg = this.getConfig();
    if (!cfg || !cfg.mandatory) return [];

    /* Check if active subcategory has its own mandatory override */
    if (App.Subcat && cfg.subcategories) {
      var selected = App.Subcat._selected || [];
      for (var i = 0; i < selected.length; i++) {
        var subVal = selected[i];
        for (var j = 0; j < cfg.subcategories.length; j++) {
          var sub = cfg.subcategories[j];
          if (typeof sub === 'object' && sub.value === subVal && sub.mandatory) {
            return sub.mandatory; // subcategory override replaces parent mandatory
          }
        }
      }
    }
    return cfg.mandatory;
  },

  /* Returns description char limit — subcategory override or SETTINGS default */
  getDescLimit: function() {
    var cfg = this.getConfig();
    if (cfg && cfg.subcategories && App.Subcat) {
      var selected = App.Subcat._selected || [];
      for (var i = 0; i < selected.length; i++) {
        var subVal = selected[i];
        for (var j = 0; j < cfg.subcategories.length; j++) {
          var sub = cfg.subcategories[j];
          if (typeof sub === 'object' && sub.value === subVal && sub.overrides && sub.overrides.MAX_DESC_CHARS) {
            return sub.overrides.MAX_DESC_CHARS;
          }
        }
      }
    }
    return SETTINGS.MAX_DESC_CHARS;
  },

  /* Restore category + subcategories from loaded record (update mode) */
  restore: function(catVal, subcatVal) {
    /* Set the category (triggers subcategory population) */
    this.set(catVal || '');

    /* Restore subcategory selections */
    if (subcatVal && App.Subcat) {
      var subs = subcatVal.split(';').map(function(s) { return s.trim(); }).filter(Boolean);
      App.Subcat._selected = [];
      /* Check the matching checkboxes in the dropdown */
      var checkboxes = document.querySelectorAll('#subcat-dd input[type=checkbox]');
      for (var ci = 0; ci < checkboxes.length; ci++) {
        var match = false;
        for (var si = 0; si < subs.length; si++) {
          if (checkboxes[ci].value === subs[si]) { match = true; break; }
        }
        checkboxes[ci].checked = match;
        if (match) App.Subcat._selected.push(checkboxes[ci].value);
      }
      App.Subcat._renderPills();
      App.Subcat._updateBtnLabel();

      /* Re-trigger mandatory in case subcategory has overrides */
      if (App.Form && App.Form._setMandatory)    App.Form._setMandatory();
      if (App.Form && App.Form._updateDescLimit) App.Form._updateDescLimit();
      if (App.Form && App.Form._applyDisabled)   App.Form._applyDisabled();
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Utils — Pure helper functions
   ───────────────────────────────────────────────────────────── */
App.Utils = {
  $: function(id) { return document.getElementById(id); },

  esc: function(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // Escape HTML then insert <wbr> after underscores so the browser
  // can line-break at underscores to prevent tooltip overflow
  escBreakable: function(s) {
    return this.esc(s).replace(/_/g, '_<wbr>');
  },

  hexToRgba: function(hex, alpha) {
    var h = hex.replace('#', '');
    return 'rgba(' + parseInt(h.slice(0,2),16) + ',' + parseInt(h.slice(2,4),16) + ',' + parseInt(h.slice(4,6),16) + ',' + alpha + ')';
  },

  buildGradient: function(bg, fg, alpha) {
    return 'linear-gradient(' + SETTINGS.BG_GRADIENT_ANGLE + 'deg,' + this.hexToRgba(bg,alpha) + ',' + this.hexToRgba(fg,alpha) + ')';
  },

  /* Accepts bare 64-hex txid or txid_suffix (e.g. abc...def_0) */
  isValidTxid: function(str) {
    return /^[0-9a-fA-F]{64}(_[0-9a-zA-Z]+)?$/.test(str);
  },

  /* Normalize txid: bare 64-hex gets _0 appended, already-suffixed stays as-is */
  parseTxid: function(str) {
    str = (str || '').trim();
    if (/^[0-9a-fA-F]{64}$/.test(str)) return str + '_0';
    return str;
  },

  /* Returns the 64-hex prefix of a txid or txid_suffix string. Used for
     CDN endpoints (like bico.media) that expect a bare hash, while
     keeping the _suffix form as the canonical stored value. */
  bareTxid: function(str) {
    str = (str || '').trim();
    var m = str.match(/^([0-9a-fA-F]{64})(?:_.*)?$/);
    return m ? m[1] : str;
  }
};


/* ─────────────────────────────────────────────────────────────
   App.StatusBar — Per-screen status bar messages
   Modified: writes to active screen's .sb-l element
   ───────────────────────────────────────────────────────────── */
App.StatusBar = {
  set: function(msg, cls) {
    var active = document.querySelector('.screen.active');
    var el = active ? active.querySelector('.sb-l') : null;
    if (el) {
      el.textContent = msg;
      el.className = 'sb-l' + (cls ? ' ' + cls : '');
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Gauge — Character counter + progress bar
   ───────────────────────────────────────────────────────────── */
App.Gauge = {
  update: function(len, max, countEl, fillEl) {
    var pct = (len / max) * 100;
    var rem = max - len;
    fillEl.style.width = Math.min(pct, 100) + '%';
    var cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
    fillEl.className = 'gfill' + (cls ? ' ' + cls : '');
    countEl.className = 'ccount' + (cls ? ' ' + cls : '');
    if (pct >= 100)     countEl.textContent = 'MAX';
    else if (pct >= 80) countEl.textContent = rem + ' LEFT';
    else                countEl.textContent = String(len).padStart(3,'0') + '/' + max;
  },

  // No init() — desc and bio gauge wiring now handled by
  // panel-desc.js and panel-dev.js respectively.
  init: function() { }
};


/* ─────────────────────────────────────────────────────────────
   App.WordGuard — Enforces max word length in text fields.

   RULE 1: No single word (unbroken run of non-space chars)
           may exceed SETTINGS.MAX_WORD_LENGTH characters.
   RULE 2: Underscores count as spaces — they split a word
           into segments, each checked independently.

   This module is applied to: description, bio, and features.
   It can be applied to any field by calling enforce(element).

   The preview tooltip also uses CSS word-break at underscores
   to prevent overflow (handled in preview CSS via word-break
   and a text replacement that inserts zero-width spaces).
   ───────────────────────────────────────────────────────────── */
App.WordGuard = {

  // Check a single text value. Returns { valid, badWord } where
  // badWord is the first offending word (for status messages).
  check: function(text) {
    var max = SETTINGS.MAX_WORD_LENGTH;
    // Split on real spaces/newlines first
    var chunks = text.split(/[\s]+/);
    for (var i = 0; i < chunks.length; i++) {
      // Split on underscores — each segment is an independent "word"
      var segments = chunks[i].split('_');
      for (var j = 0; j < segments.length; j++) {
        if (segments[j].length > max) {
          return { valid: false, badWord: segments[j].slice(0, 20) + '...' };
        }
      }
    }
    return { valid: true, badWord: null };
  },

  // Enforce on a textarea/input — show status bar error, revert to snapshot
  _snapshots: {},

  snapshot: function(el) {
    if (el && el.id) this._snapshots[el.id] = el.value;
  },

  enforce: function(el) {
    var result = this.check(el.value);
    if (!result.valid) {
      var prev = this._snapshots[el.id];
      if (prev !== undefined && this.check(prev).valid) {
        el.value = prev;
      } else {
        // Fallback: trim last char repeatedly until valid
        while (el.value.length && !this.check(el.value).valid) {
          el.value = el.value.slice(0, -1);
        }
      }
      App.StatusBar.set('WORD TOO LONG — MAX ' + SETTINGS.MAX_WORD_LENGTH + ' CHARS PER WORD (use spaces or underscores)', 'err');
    } else {
      this.snapshot(el);
    }
  },

  // No init() — desc and bio WordGuard wiring now handled by
  // panel-desc.js and panel-dev.js respectively.
  // Features are wired in App.Features.init (panel-feat.js).
  init: function() { }
};


/* ─────────────────────────────────────────────────────────────
   App.SettingsApplier — Bridges SETTINGS → CSS vars + HTML

   Split into:
   - applyCSS()         : injects CSS custom properties (call first)
   - applyFieldLimits() : sets maxlengths, defaults, dynamic text
                          (call after panel controllers have rendered)
   - Builder helpers    : _buildCatGrid, _buildSelect, _buildLangDropdown,
                          _buildTips, _buildPills — called by panel mount()
   ───────────────────────────────────────────────────────────── */
App.SettingsApplier = {
  applyCSS: function() {
    var S = SETTINGS;
    var grad = 'linear-gradient(' + S.BG_GRADIENT_ANGLE + 'deg, ' + S.BG_GRADIENT_COLOURS + ')';
    App.Utils.$('dynamic-vars').textContent =
      ':root {\n' +
      '  --bg:' + S.BG_COLOUR + '; --bg-grad:' + grad + '; --panel:' + S.PANEL_BG + ';\n' +
      '  --amber:' + S.AMBER + '; --amber-dim:' + S.AMBER_DIM + '; --accent:' + S.ACCENT_COLOUR + ';\n' +
      '  --gold:' + S.GOLD + '; --fada:' + S.HIGHLIGHT + '; --white:' + S.TEXT_COLOUR + '; --dim:' + S.TEXT_DIM + ';\n' +
      '  --green:' + S.GREEN + '; --blue-soft:' + S.BLUE_SOFT + '; --mandatory:' + S.MANDATORY + '; --border:' + S.BORDER_FAINT + ';\n' +
      '  --border-blue:' + S.BORDER + '; --input-bg:' + S.INPUT_BG + '; --font:' + S.FONT_FAMILY + ';\n' +
      '  --font-size-base:' + S.FONT_SIZE_BASE + 'px; --letter-spacing:' + S.LETTER_SPACING + 'px;\n' +
      '  --gap:' + S.GRID_GAP + 'px; --shell-aspect:' + S.SHELL_ASPECT_W + '/' + S.SHELL_ASPECT_H + ';\n' +
      '  --grid-cols:' + S.GRID_COLUMNS + '; --grid-rows:' + S.GRID_ROWS + ';\n' +
      '  --panel-blur:' + S.PANEL_BLUR + 'px; --logo-font-size:' + S.LOGO_FONT_SIZE + 'px;\n' +
      '  --logo-letter-spacing:' + S.LOGO_LETTER_SPACING + 'px;\n' +
      '}\n' +
      '@media(min-width:' + S.SCALE_BP1_WIDTH + 'px){html{font-size:' + S.SCALE_BP1_FONT + 'px;}}\n' +
      '@media(min-width:' + S.SCALE_BP2_WIDTH + 'px){html{font-size:' + S.SCALE_BP2_FONT + 'px;}}\n' +
      '@media(min-width:' + S.SCALE_BP3_WIDTH + 'px){html{font-size:' + S.SCALE_BP3_FONT + 'px;}}\n' +
      '@media(max-width:' + S.MOBILE_BREAKPOINT + 'px){\n' +
      '  html,body{overflow:auto;}.shell{width:100%;height:auto;min-height:100vh;overflow:auto;aspect-ratio:unset;}\n' +
      '  .main-area{flex:none;grid-template-columns:1fr;grid-template-rows:auto;}\n' +
      '  .panel{min-height:160px;}#preview-well{min-height:100px;min-width:100px;}\n' +
      '}';
  },

  applyFieldLimits: function() {
    var S = SETTINGS;
    var $ = App.Utils.$;

    // Field maxlengths
    if ($('app-name'))  $('app-name').maxLength = S.MAX_NAME_CHARS;
    if ($('app-abbr'))  $('app-abbr').maxLength = S.MAX_ABBR_CHARS;
    if ($('app-url'))   $('app-url').maxLength  = S.MAX_URL_CHARS;
    if ($('app-tor'))   $('app-tor').maxLength  = S.MAX_TOR_CHARS;
    if ($('app-bsv'))   $('app-bsv').maxLength  = S.MAX_BSV_CHARS;
    if ($('app-tags'))  $('app-tags').maxLength = S.MAX_TAGS_CHARS;
    if ($('desc'))      $('desc').maxLength     = S.MAX_DESC_CHARS;
    if ($('dev-bio'))   $('dev-bio').maxLength  = S.MAX_BIO_CHARS;
    if ($('app-ver'))   $('app-ver').maxLength  = S.MAX_VERSION_CHARS;
    if ($('dev-tw'))    $('dev-tw').maxLength   = S.MAX_TWITTER_CHARS;
    if ($('dev-gh'))    $('dev-gh').maxLength   = S.MAX_GITHUB_CHARS;
    if ($('icon-alt'))  $('icon-alt').maxLength = S.MAX_ALT_CHARS;

    // File input accept
    if ($('icon-file-input')) $('icon-file-input').accept = S.ICON_ACCEPT;
    if ($('ss-file-input'))   $('ss-file-input').accept   = S.SS_ACCEPT;

    // Colour defaults
    if ($('cbg'))   $('cbg').value   = S.ICON_DEFAULT_BG;
    if ($('cbg-h')) $('cbg-h').value = S.ICON_DEFAULT_BG;
    if ($('cfg'))   $('cfg').value   = S.ICON_DEFAULT_FG;
    if ($('cfg-h')) $('cfg-h').value = S.ICON_DEFAULT_FG;

    // Slider defaults
    if ($('opc')) {
      $('opc').min = S.ICON_ALPHA_MIN; $('opc').max = S.ICON_ALPHA_MAX;
      $('opc').step = S.ICON_ALPHA_STEP; $('opc').value = S.ICON_DEFAULT_ALPHA;
    }
    if ($('opc-v')) $('opc-v').textContent = Number(S.ICON_DEFAULT_ALPHA).toFixed(2);

    if ($('zom')) {
      $('zom').min = S.ICON_ZOOM_MIN; $('zom').max = S.ICON_ZOOM_MAX;
      $('zom').step = S.ICON_ZOOM_STEP; $('zom').value = S.ICON_DEFAULT_ZOOM;
    }
    if ($('zom-v')) $('zom-v').textContent = Number(S.ICON_DEFAULT_ZOOM).toFixed(2);

    // Dynamic text
    if ($('feat-hint'))    $('feat-hint').textContent    = ' \u2014 ' + S.MAX_FEATURES + ' MAX \u00b7 ' + S.MAX_FEATURE_CHARS + ' CHARS EACH \u00b7 ' + S.MAX_FEATURES_COMBINED + ' COMBINED';
    if ($('fsize'))        $('fsize').textContent        = 'MAX ' + Math.round(S.MAX_ICON_BYTES/1024) + 'kb';
    if ($('desc-c'))       $('desc-c').textContent       = '000/' + S.MAX_DESC_CHARS;
    if ($('bio-c'))        $('bio-c').textContent        = '000/' + S.MAX_BIO_CHARS;
    if ($('feat-total-c')) $('feat-total-c').textContent = '000/' + S.MAX_FEATURES_COMBINED;

    // BG/FG checkbox defaults
    if ($('cbg-on')) $('cbg-on').checked = S.ICON_BG_ENABLED;
    if ($('cfg-on')) $('cfg-on').checked = S.ICON_FG_ENABLED;
  },

  _buildCatGrid: function() {
    var grid = App.Utils.$('cat-grid-new');
    if (!grid) return;
    grid.innerHTML = '';
    var cats = SETTINGS.CATEGORIES;
    var total = cats.length;
    var topCount = Math.ceil(total / 2);
    var bottomCount = Math.floor(total / 2);
    var gap = 2; // matches CSS gap in px
    var defaultVal = App.Category.getDefault();

    for (var i = 0; i < total; i++) {
      var cat = cats[i];
      var isTopRow = i < topCount;
      var rowCount = isTopRow ? topCount : bottomCount;
      var btn = document.createElement('div');
      btn.className = 'cat-btn-new';
      if (cat.value === defaultVal) btn.classList.add('active');
      btn.setAttribute('data-val', cat.value);
      btn.textContent = cat.label;
      btn.style.color = cat.color;
      btn.style.background = cat.bg;
      btn.style.borderColor = cat.border;
      btn.style.width = 'calc((100% - ' + ((rowCount - 1) * gap) + 'px) / ' + rowCount + ')';
      grid.appendChild(btn);
    }
  },

  _buildPills: function(containerId, items, className) {
    var el = App.Utils.$(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var btn = document.createElement('div');
      btn.className = className + (item['default'] ? ' active' : '');
      btn.setAttribute('data-val', item.value);
      btn.textContent = item.label;
      el.appendChild(btn);
    }
  },

  _buildSelect: function(id, options) {
    var sel = App.Utils.$(id);
    if (!sel) return;
    sel.innerHTML = '';
    /* Empty placeholder — forces user to make an active choice */
    var ph = document.createElement('option');
    ph.value = ''; ph.textContent = '\u2014'; ph.selected = true;
    sel.appendChild(ph);
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var o = document.createElement('option');
      o.value = opt.value; o.textContent = opt.label;
      if (opt['default']) o.selected = true;
      sel.appendChild(o);
    }
  },

  _buildLangDropdown: function() {
    var dd = App.Utils.$('lang-dd');
    if (!dd) return;
    dd.innerHTML = '';
    for (var i = 0; i < SETTINGS.LANGUAGES.length; i++) {
      var lang = SETTINGS.LANGUAGES[i];
      var item = document.createElement('label');
      item.className = 'lang-dd-item';
      item.innerHTML =
        '<input type="checkbox" value="' + lang.value + '" data-label="' + lang.label + '"' + (lang['default'] ? ' checked' : '') + '>' +
        '<div class="tbox"></div><span>' + lang.label + '</span>';
      dd.appendChild(item);
    }
  },

  _buildTips: function() {
    var group = App.Utils.$('tip-group');
    if (!group) return;
    group.innerHTML = '';
    for (var i = 0; i < SETTINGS.TIP_AMOUNTS.length; i++) {
      var amount = SETTINGS.TIP_AMOUNTS[i];
      var label = document.createElement('label');
      label.className = 'tip-opt';
      label.id = 'tip-opt-' + (i + 1);
      label.innerHTML =
        '<input type="checkbox" name="tip" value="' + amount + '"><div class="tbox"></div>' +
        '<span class="tip-label"><span class="bsv-sym">\u20bf</span>' + amount + '</span>';
      group.appendChild(label);
    }
  },

  init: function() { this.applyCSS(); }
};


/* ─────────────────────────────────────────────────────────────
   App.LabelAlign — Aligns input fields within each panel.
   Scans all <lbl> elements per panel, finds the widest,
   and sets all labels to that width so inputs line up neatly.
   Also aligns .status labels in the Transmit panel.
   ───────────────────────────────────────────────────────────── */
App.LabelAlign = {
  align: function() {
    // For each panel, find all lbl elements and align to the widest
    var panels = document.querySelectorAll('.panel');
    for (var p = 0; p < panels.length; p++) {
      var panel = panels[p];
      var labels = panel.querySelectorAll('lbl');
      if (labels.length < 2) continue;

      // Split labels: column labels (first-child or not in row-multi)
      // vs inner labels (non-first in row-multi, sized to text + 4px)
      var colLabels = [];
      var innerLabels = [];
      for (var i = 0; i < labels.length; i++) {
        var l = labels[i];
        var row = l.closest('.row-multi');
        if (row && l !== row.querySelector('lbl')) {
          innerLabels.push(l);
        } else {
          colLabels.push(l);
        }
      }

      // Reset to auto first so we measure natural width
      for (var a = 0; a < colLabels.length; a++) colLabels[a].style.minWidth = '';
      for (var b = 0; b < innerLabels.length; b++) innerLabels[b].style.minWidth = '';

      // Column labels: align to widest + 4px
      var maxW = 0;
      for (var c = 0; c < colLabels.length; c++) maxW = Math.max(maxW, colLabels[c].offsetWidth);
      if (maxW > 0) {
        for (var d = 0; d < colLabels.length; d++) colLabels[d].style.minWidth = (maxW + 4) + 'px';
      }

      // Inner labels: each sized to own text + 4px
      for (var e = 0; e < innerLabels.length; e++) {
        innerLabels[e].style.minWidth = (innerLabels[e].offsetWidth + 4) + 'px';
      }
    }

    // Also align the .status labels in the Transmit tx-row items
    var txPanel = App.Utils.$('p1-tx');
    if (txPanel) {
      var statusLabels = txPanel.querySelectorAll('.tx-row > .status:first-child');
      for (var f = 0; f < statusLabels.length; f++) statusLabels[f].style.minWidth = '';
      var maxTx = 0;
      for (var g = 0; g < statusLabels.length; g++) maxTx = Math.max(maxTx, statusLabels[g].offsetWidth);
      if (maxTx > 0) {
        for (var k = 0; k < statusLabels.length; k++) statusLabels[k].style.minWidth = maxTx + 'px';
      }
    }
  },

  init: function() {
    var self = this;
    // Run after DOM is fully laid out
    requestAnimationFrame(function() {
      self.align();
      // Re-run once more after fonts load
      setTimeout(function() { self.align(); }, 300);
    });
    // Re-align on resize (font size may change at breakpoints)
    window.addEventListener('resize', function() { self.align(); });
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Shell — Stores geometry snapshot for sub-screens.
   Modified: reads from window.ShellState (wireframe.js) and
   falls back to DOM measurement for backwards compatibility.
   ───────────────────────────────────────────────────────────── */
App.Shell = {
  w: 0, h: 0, row1H: 0, lastH: 0, gap: SETTINGS.GRID_GAP,

  snapshot: function() {
    // Read from wireframe.js ShellState if available
    if (window.ShellState) {
      this.row1H = ShellState.row1H;
    }
    var shell = document.querySelector('.screen.active .shell');
    var titlebar = document.querySelector('.screen.active .titlebar');
    var statusbar = document.querySelector('.screen.active .statusbar');
    if (shell)     { this.w = shell.offsetWidth;   this.h = shell.offsetHeight; }
    if (titlebar)  { this.row1H = titlebar.offsetHeight; }
    if (statusbar) { this.lastH = statusbar.offsetHeight; }
  }
};
