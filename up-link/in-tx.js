/* ═══════════════════════════════════════════════════════════════
   in-tx.js — Transmit & Transaction Panels (v7.2)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Cross-screen panel card feeding 4 wireframe slots:
               S1: #p1-tx    (transmit info — network, protocol, tips, fee)
                   #p1-tx-btn (PREVIEW & SUBMIT button — large, white/red)
               S2: #p2-tx    (TX summary — fee, tip, total)
                   #p2-tx-btn (SIGN & BROADCAST button — large, white/red)
             Also contains App.Tips (tip selection) and App.Transmit
             (sign/broadcast dispatch).

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.State, App.StatusBar, App.SettingsApplier,
             App.Capabilities, App.Form (from app-core.js, app-form.js).
             Optional: WalletManager (onchain.js), App.MAPExport
             (onchain.js / offline.js).

   OUTPUTS:  App.Panels.S1.tx      — { render(), mount() }
             App.Panels.S1.txBtn   — { render(), mount() }
             App.Panels.S2.tx      — { render(data) }
             App.Panels.S2.txBtn   — { render() }
             App.Tips              — tip selection, updateFeeDisplay()
             App.Transmit          — sign & broadcast dispatch

   DEPENDS:  settings.js, app-core.js.
             Optional: onchain.js (WalletManager for real fee estimate).

   NOTES:    Absorbs panel-tx.js + TX parts of app-panels-s2.js.
             Both button panels are identical in style: large, white text
             on red background, full-width.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S1 = App.Panels.S1 || {};
App.Panels.S2 = App.Panels.S2 || {};


/* ─────────────────────────────────────────────────────────────
   S1 Transmit info panel — #p1-tx
   ───────────────────────────────────────────────────────────── */
App.Panels.S1.tx = {
  render: function() {
    return '' +
      '<div class="plabel" id="lbl-transmit">' + App.Utils.esc(SETTINGS.LABEL_TRANSMIT) + '</div>' +
      '<div class="tx-body">' +
        '<div class="tx-row"><span class="status">NETWORK</span><span class="status" id="tx-network"></span></div>' +
        '<div class="tx-row"><span class="status">PROTOCOL</span><span class="status" id="tx-protocol"></span></div>' +
        '<div class="tx-row tx-row-tip">' +
          '<span class="status" style="color:var(--amber-dim);white-space:nowrap;flex-shrink:0;">tip BSVhub.io</span>' +
          '<div class="tip-row" id="tip-group" style="flex:1;margin:0;"></div>' +
        '</div>' +
        '<div class="tx-row"><span class="status">FEE EST.</span><span class="status" id="fee-est" style="color:var(--gold);">\u2014 BSV</span></div>' +
        '<div class="status" id="sub-st">WALLET NOT CONNECTED</div>' +
      '</div>';
  },

  mount: function() {
    var $ = App.Utils.$;
    if ($('tx-network')) {
      $('tx-network').textContent = SETTINGS.NETWORK_LABEL;
      $('tx-network').style.color = 'var(--gold)';
    }
    if ($('tx-protocol')) {
      $('tx-protocol').textContent = SETTINGS.PROTOCOL_LABEL;
      $('tx-protocol').style.color = 'var(--amber)';
    }
    App.SettingsApplier._buildTips();
  }
};


/* ─────────────────────────────────────────────────────────────
   S1 Submit button panel — #p1-tx-btn
   Large white text on red background, full-width.
   ───────────────────────────────────────────────────────────── */
App.Panels.S1.txBtn = {
  render: function() {
    return '<span class="btn-submit-wrap" id="sub-btn-wrap"><button class="btn-submit" id="sub-btn" disabled>\u25b8 PREVIEW &amp; SUBMIT</button></span>';
  },

  mount: function() {
    /* Click wiring done in app-init.js (navigates to Screen 2) */
  },

  /* Update hover tooltip on submit button based on current state */
  updateTooltip: function() {
    var wrap = App.Utils.$('sub-btn-wrap');
    if (!wrap) return;
    var btn = App.Utils.$('sub-btn');
    if (btn && !btn.disabled) { wrap.title = ''; return; }
    var reasons = [];
    if (!App.State.walletConnected) reasons.push('CONNECT WALLET');
    var isBsvhub = App.Form.getCategory() === 'bsvhub';
    if (isBsvhub) {
      var $ = App.Utils.$;
      var missing = [];
      var appIdea = App.Form._isAppIdea && App.Form._isAppIdea();
      if (appIdea) {
        if (!$('desc').value.trim()) missing.push('DESCRIPTION');
      } else {
        if (!$('app-name').value.trim()) missing.push('NAME');
        if (!$('app-url').value.trim()) missing.push('URL');
        if (!$('app-status').value) missing.push('STATUS');
        if (!$('desc').value.trim()) missing.push('DESCRIPTION');
        if (!App.Subcat || !App.Subcat.getValue()) missing.push('SUBCATEGORY');
      }
      if (missing.length) reasons.push('MANDATORY: ' + missing.join(', '));
    }
    wrap.title = reasons.length ? reasons.join(' + ') : '';
  }
};


/* ─────────────────────────────────────────────────────────────
   S2 TX Summary panel — #p2-tx
   ───────────────────────────────────────────────────────────── */
App.Panels.S2.tx = {

  /**
   * Calculate fee estimate from form data.
   * Returns { feeSats, tipSats, totalSats, totalBSV }
   */
  _estimateFee: function(data) {
    var d = data;
    var tipSats = Math.round((d.tip_bsv || 0) * 1e8);
    var feeSats = SETTINGS.BASE_FEE_SATS;

    /* Attempt real fee estimate via WalletManager (only in on-chain mode) */
    if (App.Capabilities.onchain && App.State.onChain && App.MAPExport && App.MAPExport._buildMAPFields) {
      try {
        var fields = App.MAPExport._buildMAPFields(d);
        var iconBytes = (d.icon_source === 'upload' && d.icon_data_b64 && typeof WalletManager !== 'undefined' && WalletManager._base64ToBytes)
          ? WalletManager._base64ToBytes(d.icon_data_b64)
          : null;
        var ssSlots = d.screenshots || [null, null, null, null];
        if (typeof WalletManager !== 'undefined' && WalletManager.estimateSubmitFee) {
          var est = WalletManager.estimateSubmitFee(fields, iconBytes, tipSats, ssSlots);
          feeSats = est.mapFeeSats + est.iconFeeSats;
        }
      } catch (e) {
        /* Use fallback BASE_FEE_SATS */
      }
    }

    var totalSats = feeSats + tipSats;
    var totalBSV = (totalSats / 1e8).toFixed(totalSats < 100000 ? 5 : 4);

    return {
      feeSats:  feeSats,
      tipSats:  tipSats,
      totalSats: totalSats,
      totalBSV: totalBSV
    };
  },

  /**
   * Render the TX summary panel HTML.
   * @param {Object} data — collected form data
   * @returns {string} HTML string
   */
  render: function(data) {
    var est = this._estimateFee(data);
    var esc = App.Utils.esc;

    /* Fee display string */
    var feeStr;
    if (est.tipSats > 0) {
      feeStr = '~' + est.totalBSV + ' BSV  (' + est.feeSats.toLocaleString() + ' fee + ' + est.tipSats.toLocaleString() + ' tip)';
    } else {
      feeStr = '~' + est.totalBSV + ' BSV  (~' + est.feeSats.toLocaleString() + ' sats)';
    }

    /* Tip line (only if tip > 0) */
    var tipLine = '';
    if (data.tip_bsv > 0) {
      tipLine = '<div class="meta-row">' +
        '<span class="mk">TIP</span>' +
        '<span class="mv" style="color:var(--green);">\u20bf' + esc(String(data.tip_bsv)) + ' BSV</span>' +
        '</div>';
    }

    /* Total line */
    var totalStr = '~' + est.totalBSV + ' BSV  (~' + est.totalSats.toLocaleString() + ' sats)';

    return '<div class="plabel">TX SUMMARY</div>' +
      '<div class="meta-row">' +
        '<span class="mk">FEE EST.</span>' +
        '<span class="mv" style="color:var(--gold);">' + esc(feeStr) + '</span>' +
      '</div>' +
      tipLine +
      '<div class="meta-row">' +
        '<span class="mk">TOTAL</span>' +
        '<span class="mv" style="color:var(--gold);">' + esc(totalStr) + '</span>' +
      '</div>';
  }
};


/* ─────────────────────────────────────────────────────────────
   S2 Sign & Broadcast button panel — #p2-tx-btn
   Large white text on red background, full-width.
   ───────────────────────────────────────────────────────────── */
App.Panels.S2.txBtn = {
  render: function() {
    return '<button class="btn-submit" id="s2-sign-btn" type="button">\u25b8 SIGN &amp; BROADCAST</button>';
  },

  mount: function() {
    var signBtn = App.Utils.$('s2-sign-btn');
    if (signBtn) {
      /* Sync label: offline → SAVE TO FILE, on-chain → SIGN & BROADCAST */
      signBtn.textContent = App.State.onChain ? '\u25b8 SIGN & BROADCAST' : '\u25b8 SAVE TO FILE';
      signBtn.addEventListener('click', function() {
        App.Transmit.sign();
      });
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Tips — Tip selection (mutually exclusive checkboxes)
   ───────────────────────────────────────────────────────────── */
App.Tips = {
  handleChange: function(checkbox) {
    var all = Array.prototype.slice.call(document.querySelectorAll('input[name=tip]'));
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c !== checkbox) { c.checked = false; c.closest('.tip-opt').classList.remove('active'); }
    }
    if (checkbox.checked) { checkbox.closest('.tip-opt').classList.add('active'); App.State.selectedTip = parseFloat(checkbox.value); }
    else { checkbox.closest('.tip-opt').classList.remove('active'); App.State.selectedTip = 0; }
    this.updateFeeDisplay();
  },

  updateFeeDisplay: function() {
    var el = App.Utils.$('fee-est');
    if (!App.State.walletConnected) { el.textContent = '\u2014 BSV'; return; }

    var tipSats = Math.round(App.State.selectedTip * 1e8);
    var feeSats = SETTINGS.BASE_FEE_SATS;

    try {
      var d = App.Form.collectData();
      if (App.Capabilities.onchain && App.State.onChain && App.MAPExport && App.MAPExport._buildMAPFields
          && typeof WalletManager !== 'undefined' && WalletManager.estimateSubmitFee) {
        var fields = App.MAPExport._buildMAPFields(d);
        var iconBytes = (d.icon_source === 'upload' && d.icon_data_b64 && WalletManager._base64ToBytes)
          ? WalletManager._base64ToBytes(d.icon_data_b64) : null;
        var ssSlots = d.screenshots || [null, null, null, null];
        var est = WalletManager.estimateSubmitFee(fields, iconBytes, tipSats, ssSlots);
        feeSats = est.mapFeeSats + est.iconFeeSats;
      }

      var totalSats = feeSats + tipSats;
      var totalBSV = (totalSats / 1e8).toFixed(totalSats < 100000 ? 5 : 4);

      if (tipSats > 0) {
        el.textContent = '~' + totalBSV + ' BSV  (' + feeSats.toLocaleString() + ' fee + ' + tipSats.toLocaleString() + ' tip)';
      } else {
        el.textContent = '~' + totalBSV + ' BSV  (~' + feeSats.toLocaleString() + ' sats)';
      }
    } catch (e) {
      var totalSats2 = feeSats + tipSats;
      var totalBSV2 = (totalSats2 / 1e8).toFixed(5);
      el.textContent = '~' + totalBSV2 + ' BSV  (~' + feeSats.toLocaleString() + ' sats)';
    }
  },

  init: function() {
    var self = this;
    var cbs = Array.prototype.slice.call(document.querySelectorAll('input[name=tip]'));
    for (var i = 0; i < cbs.length; i++) {
      (function(cb) {
        cb.addEventListener('change', function() { self.handleChange(cb); });
      })(cbs[i]);
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Transmit — Sign & Broadcast Dispatch
   ───────────────────────────────────────────────────────────── */
App.Transmit = {

  /**
   * Dispatch sign/broadcast.
   * Prefers App.MAPExport.saveOnChain() (on-chain wallet),
   * falls back to App.MAPExport.save() (offline export),
   * shows error if neither is available.
   */
  sign: function() {
    /* On-chain path — only if capability exists AND user is in on-chain mode */
    if (App.Capabilities.onchain && App.State.onChain && App.MAPExport && App.MAPExport.saveOnChain) {
      App.StatusBar.set('SIGNING TRANSACTION...', 'ok');
      App.MAPExport.saveOnChain(function(msg) {
        App.StatusBar.set(msg, 'ok');
      }).then(function(txid) {
        App.StatusBar.set('BROADCAST SUCCESS // TXID: ' + txid, 'ok');
      })['catch'](function(err) {
        App.StatusBar.set('BROADCAST FAILED: ' + (err.message || String(err)), 'err');
      });
      return;
    }

    /* Offline fallback */
    if (App.Capabilities.offline && App.MAPExport && App.MAPExport.save) {
      try {
        App.MAPExport.save();
        App.StatusBar.set('FILE SAVED (OFFLINE MODE)', 'ok');
      } catch (err) {
        App.StatusBar.set('SAVE FAILED: ' + (err.message || String(err)), 'err');
      }
      return;
    }

    /* No save method available */
    App.StatusBar.set('NO WALLET OR EXPORT MODULE AVAILABLE', 'err');
  }
};
