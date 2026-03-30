/* ═══════════════════════════════════════════════════════════════
   header-footer.js — Titlebar & Statusbar Renderer (v7.4)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Cross-screen panel card that populates the titlebar and
             statusbar HTML for all 3 screens at boot time. Titlebars
             and statusbars are empty containers in index.html — this
             file injects their content once during init. In 1-column
             mode, titlebars and statusbars switch to 2-line layout:
             line 1 left-justified, line 2 right-justified, with ~20%
             font reduction on titlebars.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils (from app-core.js).
             DOM: #titlebar-1..3, #sb-1..3.

   OUTPUTS:  App.HeaderFooter — { init() }
             Titlebar HTML for all 3 screens.
             Statusbar content stays in index.html (simple enough).

   DEPENDS:  settings.js, app-core.js, wireframe.js (nav button wiring).

   NOTES:    Wallet bar, offline toggle, mode toggles, badges, nav groups
             are all injected here. app-wallet.js and app-init.js wire
             the interactive behaviour after header-footer.js populates
             the DOM. 1-col wrapping is driven purely by the .mode-1col
             class that wireframe.js applies to .shell elements.
   ═══════════════════════════════════════════════════════════════ */

App.HeaderFooter = {

  /* ─────────────────────────────────────────────────────────────
     _injectCSS() — One-time CSS for 1-column 2-line layout.
     Triggered by .mode-1col on the parent .shell element.
     Line 1 (.tb-left / .sb-l) stays left-justified.
     Line 2 (.wallet-bar / .badge / .sb-r) right-justified.
     Titlebar font reduced ~20% in 1-col mode.
     ───────────────────────────────────────────────────────────── */
  _injectCSS: function() {
    if (document.getElementById('hf-css')) return;
    var s = document.createElement('style');
    s.id = 'hf-css';
    s.textContent =

      /* ── LINK colour: always blood orange ── */
      '.logo span.logo-link{color:var(--mandatory);}' +

      /* ── CLEAR button: uses .mode-toggle for sizing, only overrides colour ── */
      '.clear-btn{font-family:var(--font);font-size:0.72em;font-weight:700;letter-spacing:2px;color:var(--red);border:1px solid var(--red);margin:0 0 0 6px;background:transparent;padding:0 2px;cursor:pointer;text-transform:uppercase;line-height:1;appearance:none;-webkit-appearance:none;box-sizing:border-box;}' +
      '.clear-btn:hover{color:#fff;background:var(--red);border-color:var(--red);}' +
      '.clear-btn:disabled{color:var(--dim);border-color:rgba(200,200,200,0.15);opacity:0.4;cursor:default;pointer-events:none;}' +

      /* ── TITLEBAR: 1-col → 2-line, ~20% font reduction ──────── */
      '.mode-1col > .titlebar {' +
        'flex-wrap:wrap;' +
        'overflow:visible;' +
        'align-items:center;' +
        'padding-top:3px;padding-bottom:3px;' +
        'gap:1px;' +                    /* tighter than wireframe 8px */
        'font-size:11.2px;' +           /* ~20% down from 14px base */
      '}' +
      /* Line 1: left group takes full width, left-justified (default) */
      '.mode-1col > .titlebar > .tb-left {' +
        'flex:1 0 100%;' +
      '}' +
      /* Line 2: right group takes full width, right-justified */
      '.mode-1col > .titlebar > .wallet-bar,' +
      '.mode-1col > .titlebar > .badge {' +
        'flex:1 0 100%;' +
        'justify-content:flex-end;' +
        'text-align:right;' +
      '}' +
      /* CONNECT btn height matches TEST OFFLINE toggle height */
      '.mode-1col > .titlebar .btn {' +
        'padding:3px 10px;' +
        'font-size:1em;' +
      '}' +

      /* ── STATUSBAR: 1-col → 2-line ──────────────────────────── */
      '.mode-1col > .statusbar {' +
        'flex-wrap:wrap;' +
        'overflow:visible;' +
        'gap:1px;' +                    /* tighter than wireframe 6px */
      '}' +
      /* Line 1: .sb-l takes full width, left-justified (default) */
      '.mode-1col > .statusbar > .sb-l {' +
        'flex:1 0 100%;' +
      '}' +
      /* Line 2: .sb-r takes full width, right-justified */
      '.mode-1col > .statusbar > .sb-r {' +
        'flex:1 0 100%;' +
        'justify-content:flex-end;' +
      '}';

    document.head.appendChild(s);
  },

  /* ─────────────────────────────────────────────────────────────
     _logoGroup() — Shared logo + mode nav + unit control
     ───────────────────────────────────────────────────────────── */
  _logoGroup: function(activeMode) {
    var s = (activeMode === 'submit') ? ' active' : '';
    var u = (activeMode === 'update') ? ' active' : '';
    var v = (activeMode === 'view')   ? ' active' : '';
    return '' +
      '<div class="tb-left">' +
        '<div class="unit-ctrl">' +
          '<button class="unit-btn" data-delta="-5">&minus;</button>' +
          '<span data-unit-lbl>U:55</span>' +
          '<button class="unit-btn" data-delta="5">+</button>' +
        '</div>' +
        '<div class="logo">Up-<span class="logo-link">LINK</span> // ' +
          '<a class="mode-toggle' + s + '" id="mode-submit" data-screen="1">SUBMIT</a> ' +
          '<span style="color:var(--dim);font-size:0.7em;">|</span> ' +
          '<a class="mode-toggle' + u + '" id="mode-update" data-screen="1">UPDATE</a> ' +
          '<span style="color:var(--dim);font-size:0.7em;">|</span> ' +
          '<a class="mode-toggle' + v + '" id="mode-viewer" data-screen="3">VIEW</a>' +
          ' <button class="mode-toggle clear-btn" id="clear-form-btn" title="Clear all form data and images">CLEAR</button>' +
        '</div>' +
      '</div>';
  },

  _renderS1Titlebar: function() {
    return '' +
      this._logoGroup('submit') +
      '<div class="wallet-bar">' +
        '<label class="onchain-toggle" id="offline-toggle" title="When checked, runs local simulation without wallet. Uncheck to use real BRC-100 wallet.">' +
          '<input type="checkbox" id="offline-cb">' +
          '<div class="onchain-box"></div>' +
          '<span class="onchain-label">TEST OFF-CHAIN</span>' +
        '</label>' +
        '<div class="led" id="led"></div>' +
        '<span class="wallet-label" id="wallet-label">NOT CONNECTED</span>' +
        '<button class="btn" id="wallet-btn">CONNECT</button>' +
      '</div>';
  },

  /* ─────────────────────────────────────────────────────────────
     _renderS2Titlebar() — Screen 2: logo + mode nav + preview badge
     ───────────────────────────────────────────────────────────── */
  _renderS2Titlebar: function() {
    return '' +
      this._logoGroup('submit') +
      '<span class="badge" id="preview-badge">NOT YET ON CHAIN</span>';
  },

  /* ─────────────────────────────────────────────────────────────
     _renderS3Titlebar() — Screen 3: logo + mode nav + viewer badge
     ───────────────────────────────────────────────────────────── */
  _renderS3Titlebar: function() {
    return '' +
      this._logoGroup('view') +
      '<div class="wallet-bar">' +
        '<label class="onchain-toggle" id="testnet-toggle" title="Toggle between mainnet and testnet for transaction lookups.">' +
          '<input type="checkbox" id="testnet-cb">' +
          '<div class="onchain-box"></div>' +
          '<span class="onchain-label">TESTNET</span>' +
        '</label>' +
        '<span class="badge" id="viewer-badge"></span>' +
      '</div>';
  },

  /* ─────────────────────────────────────────────────────────────
     init() — Inject titlebar HTML into empty containers
     Called once at boot by app-init.js before any module wiring.
     ───────────────────────────────────────────────────────────── */
  init: function() {
    var $ = App.Utils.$;
    var tb1 = $('titlebar-1');
    var tb2 = $('titlebar-2');
    var tb3 = $('titlebar-3');

    if (tb1) tb1.innerHTML = this._renderS1Titlebar();
    if (tb2) tb2.innerHTML = this._renderS2Titlebar();
    if (tb3) tb3.innerHTML = this._renderS3Titlebar();

    /* Inject 1-col wrapping CSS — driven by .mode-1col from wireframe.js */
    this._injectCSS();
  }
};
