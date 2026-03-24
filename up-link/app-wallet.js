/* ═══════════════════════════════════════════════════════════════
   app-wallet.js — Wallet UI + Mode Toggle + Record Picker
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Session management layer — controls what mode the app
             is in (submit vs update), whether a wallet is connected,
             and how previous records are loaded for editing.

   INPUTS:   DOM elements in Screen 1 titlebar (LED, wallet button,
             offline toggle, mode toggles).
             WalletManager / BRC100Provider from onchain.js (optional).
             App.MAPImport._populateForm() from offline.js (optional).

   OUTPUTS:  App.Wallet       — connect/disconnect UI, mock toggle, heartbeat
             App.Mode         — SUBMIT/UPDATE mode toggle, set(mode)
             App.RecordPicker — modal for loading previous on-chain or local records

   DEPENDS:  app-core.js (Utils, State, StatusBar, Config, Capabilities).
             app-form.js (Tips.updateFeeDisplay, MAPImport).
             onchain.js (WalletManager, BRC100Provider — optional).
             offline.js (App._offlineScanLocal — optional). SETTINGS.

   NOTES:    Grouped in one file because these modules call each other
             directly: Mode.set('update') triggers RecordPicker flow,
             Wallet._updateUI() calls Tips.updateFeeDisplay(),
             RecordPicker.open() calls Wallet.toggle(). Separating
             them would create circular cross-file references.
   ═══════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   App.Wallet — Connect/disconnect UI
   [BSV-HOOK] Replace with BRC-100 / HandCash SDK
   ───────────────────────────────────────────────────────────── */
App.Wallet = {

  // Update all wallet-related UI elements to reflect connection state.
  _updateUI: function(on, displayName) {
    var $ = App.Utils.$;
    $('led').classList.toggle('on', on);
    var wl = $('wallet-label');
    wl.textContent = on ? displayName : 'NOT CONNECTED';
    wl.classList.toggle('on', on);
    var wb = $('wallet-btn');
    wb.textContent = on ? 'DISCONNECT' : 'CONNECT';
    wb.disabled = false;

    var pm = $('dev-paymail');
    pm.value = on ? ((App.Capabilities.onchain && typeof WalletManager !== 'undefined' && WalletManager.paymail) || displayName) : '';
    pm.style.color = on ? '' : 'var(--dim)';
    $('sub-btn').disabled = !on;

    var sst = $('sub-st');
    sst.textContent = on ? 'READY \u2014 PREVIEW BEFORE SIGNING' : 'WALLET NOT CONNECTED';
    sst.className = 'status' + (on ? ' ok' : '');

    App.StatusBar.set(
      on ? 'WALLET CONNECTED // ' + displayName : SETTINGS.STATUSBAR_DEFAULT_MSG,
      on ? 'ok' : ''
    );
    if (App.Tips && App.Tips.updateFeeDisplay) {
      App.Tips.updateFeeDisplay();
    }
  },

  // Mock connect — instant toggle with fake paymail (existing behaviour)
  _mockToggle: function() {
    var st = App.State;
    st.walletConnected = !st.walletConnected;
    this._updateUI(st.walletConnected, SETTINGS.MOCK_PAYMAIL_DISPLAY);
  },

  // Heartbeat interval ID (for periodic wallet reachability checks)
  _heartbeatId: null,

  // Start periodic heartbeat to detect wallet going away
  _startHeartbeat: function() {
    var self = this;
    this._stopHeartbeat();
    this._heartbeatId = setInterval(function() {
      if (!App.State.walletConnected || !App.State.onChain || !App.Capabilities.onchain) {
        self._stopHeartbeat();
        return;
      }
      BRC100Provider.isAuthenticated()
        .catch(function() {
          // Wallet is no longer reachable
          WalletManager.disconnect();
          App.State.walletConnected = false;
          self._updateUI(false, '');
          self._stopHeartbeat();
          App.StatusBar.set('WALLET DISCONNECTED \u2014 CONNECTION LOST', 'err');
        });
    }, 5000);
  },

  _stopHeartbeat: function() {
    if (this._heartbeatId) {
      clearInterval(this._heartbeatId);
      this._heartbeatId = null;
    }
  },

  // Real BRC-100 connect — async, talks to localhost:2121
  _realToggle: function() {
    var self = this;
    var st = App.State;
    var $ = App.Utils.$;

    if (st.walletConnected) {
      // Disconnect
      WalletManager.disconnect();
      st.walletConnected = false;
      this._updateUI(false, '');
      this._stopHeartbeat();
      return;
    }

    // Connect — show connecting state
    $('wallet-btn').textContent = '\u27F3 ...';
    $('wallet-btn').disabled = true;
    App.StatusBar.set('CONNECTING TO BRC-100 WALLET...', '');

    WalletManager.connect()
      .then(function(info) {
        st.walletConnected = true;
        var display = WalletManager.getDisplayNameUpper();
        self._updateUI(true, display);
        if (info.network) {
          $('tx-network').textContent = info.network.toUpperCase();
        }
        self._startHeartbeat();
      })
      .catch(function(err) {
        st.walletConnected = false;
        $('wallet-btn').textContent = 'CONNECT';
        $('wallet-btn').disabled = false;
        if (err.message === 'WALLET_NOT_RUNNING') {
          App.StatusBar.set('WALLET NOT FOUND \u2014 START BSV DESKTOP AND TRY AGAIN', 'err');
        } else {
          App.StatusBar.set('WALLET ERROR \u2014 ' + (err.message || 'UNKNOWN').toUpperCase(), 'err');
        }
      });
  },

  toggle: function() {
    if (App.Capabilities.onchain && App.State.onChain) {
      this._realToggle();
    } else {
      this._mockToggle();
    }
  },

  init: function() {
    var self = this;
    var $ = App.Utils.$;
    $('wallet-btn').addEventListener('click', function() { self.toggle(); });

    // Set initial status bar message based on available capabilities
    if (!App.Capabilities.onchain) {
      App.StatusBar.set('LOCAL SIMULATION MODE \u2014 OFFLINE TESTING', '');
    }

    // Offline toggle checkbox — checked = offline mode, unchecked = real wallet
    var cb = $('offline-cb');
    var cbWrap = $('offline-toggle') || (cb ? cb.parentElement : null);
    if (!App.Capabilities.onchain || !App.Capabilities.offline) {
      // Only one mode available — hide the toggle
      if (cbWrap) cbWrap.style.display = 'none';
    }
    // Sync checkbox to current onChain state (checked = offline = !onChain)
    if (cb) cb.checked = !App.State.onChain;
    if (cb) {
      cb.addEventListener('change', function(e) {
        App.State.onChain = !e.target.checked;
        // Disconnect if switching modes while connected
        if (App.State.walletConnected) {
          if (App.Capabilities.onchain && typeof WalletManager !== 'undefined' && WalletManager.connected) {
            WalletManager.disconnect();
          }
          App.State.walletConnected = false;
          self._updateUI(false, '');
          self._stopHeartbeat();
        }
        App.StatusBar.set(
          App.State.onChain ? 'ON-CHAIN MODE \u2014 REAL BRC-100 WALLET' : 'LOCAL SIMULATION MODE',
          App.State.onChain ? 'ok' : ''
        );
      });
    }
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Mode — SUBMIT / UPDATE toggle in title bar
   ───────────────────────────────────────────────────────────── */
App.Mode = {
  set: function(mode, skipPicker) {
    var $ = App.Utils.$;
    App.State.mode = mode;
    $('mode-submit').classList.toggle('active', mode === 'submit');
    $('mode-update').classList.toggle('active', mode === 'update');
    if ($('mode-viewer')) $('mode-viewer').classList.remove('active');
    $('sub-btn').textContent = mode === 'update' ? '\u25B8 PREVIEW & UPDATE' : '\u25B8 PREVIEW & SUBMIT';
    if (!skipPicker && mode === 'update') {
      App.RecordPicker.open();
    } else if (mode === 'submit') {
      App.StatusBar.set('SUBMIT MODE \u2014 NEW RECORD', 'ok');
    }
  },

  init: function() {
    var self = this;
    var $ = App.Utils.$;
    $('mode-submit').addEventListener('click', function() { self.set('submit'); });
    $('mode-update').addEventListener('click', function() { self.set('update'); });
  }
};


/* ─────────────────────────────────────────────────────────────
   App.RecordPicker — Dispatches to on-chain or offline scan
   depending on which modules are loaded and current mode.
   ───────────────────────────────────────────────────────────── */
App.RecordPicker = {

  _records: [],

  // Dispatch scan to the appropriate module
  _scanWallet: async function() {
    this._records = [];
    var statusEl = document.querySelector('.picker-status');
    if (statusEl) statusEl.textContent = '\u27F3 SCANNING WALLET FOR RECORDS...';

    try {
      if (App.Capabilities.onchain && App.State.onChain && App._onchainScanRecords) {
        this._records = await App._onchainScanRecords();
      } else if (App.Capabilities.offline && App._offlineScanLocal) {
        this._records = await App._offlineScanLocal();
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'SCAN ERROR \u2014 ' + (e.message || 'UNKNOWN').toUpperCase();
      return;
    }

    if (statusEl) {
      var count = this._records.length;
      statusEl.textContent = count
        ? count + ' RECORD' + (count > 1 ? 'S' : '') + ' FOUND'
        : 'NO RECORDS FOUND';
    }
  },

  _renderList: function() {
    var self = this;
    var list = document.querySelector('.picker-list');
    if (!list) return;
    list.innerHTML = '';

    if (!this._records.length) {
      list.innerHTML = '<div class="picker-empty">NO BSVDIRECTORY RECORDS FOUND</div>';
      return;
    }

    for (var i = 0; i < this._records.length; i++) {
      (function(idx) {
        var rec = self._records[idx];
        var statusColour = App.Config.getStatusColour(rec.status || '');
        var iconSrc = rec._icon_data_b64 || '';
        var txid = rec._txid || '';
        var shortTx = txid ? txid.substring(0, 8) + '\u2026' + txid.substring(56) : '';
        var item = document.createElement('div');
        item.className = 'picker-item';

        // Build icon cell
        var iconHtml = iconSrc
          ? '<img src="' + iconSrc + '" alt="' + App.Utils.esc(rec.name || '') + '">'
          : '<span style="color:var(--dim);font-size:10px;">\u2014</span>';

        // Build txid row
        var txidHtml = txid
          ? '<div class="picker-item-txid"><span class="txid-text">' + App.Utils.esc(shortTx) + '</span>' +
            '<span class="txid-copy" data-txid="' + App.Utils.esc(txid) + '" title="Copy TXID">\uD83D\uDCCB</span></div>'
          : '';

        // Build version fragment
        var versionHtml = rec.version ? ' \u00B7 v' + App.Utils.esc(rec.version) : '';

        item.innerHTML =
          '<div class="picker-item-icon">' + iconHtml + '</div>' +
          '<div class="picker-item-info">' +
            '<div class="picker-item-name">' + App.Utils.esc(rec.name || 'UNNAMED') + '</div>' +
            '<div class="picker-item-meta">' + App.Utils.esc(rec.url || '\u2014') + ' \u00B7 ' + App.Utils.esc(rec.category || '\u2014') + versionHtml + '</div>' +
            txidHtml +
          '</div>' +
          '<span class="picker-item-status" style="color:' + statusColour + ';border-color:' + statusColour + '50;background:rgba(0,0,0,0.3);">' +
            App.Utils.esc((rec.status || '\u2014').toUpperCase()) +
          '</span>';

        // Copy button click — stop propagation so it doesn't trigger record select
        var copyBtn = item.querySelector('.txid-copy');
        if (copyBtn) {
          copyBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var btn = this;
            var tid = btn.getAttribute('data-txid');
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(tid).then(function() {
                btn.textContent = '\u2713';
                btn.style.color = 'var(--green)';
                setTimeout(function() { btn.textContent = '\uD83D\uDCCB'; btn.style.color = ''; }, 1500);
              }).catch(function() {
                // Fallback for file:// protocol where clipboard API may not work
                _copyFallback(btn, tid);
              });
            } else {
              // Clipboard API not available — use fallback directly
              _copyFallback(btn, tid);
            }
          });
        }

        item.addEventListener('click', function() { self._select(idx); });
        list.appendChild(item);
      })(i);
    }

    // Fallback copy using execCommand for file:// protocol
    function _copyFallback(btn, tid) {
      var ta = document.createElement('textarea');
      ta.value = tid;
      ta.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = '\u2713';
      btn.style.color = 'var(--green)';
      setTimeout(function() { btn.textContent = '\uD83D\uDCCB'; btn.style.color = ''; }, 1500);
    }
  },

  _select: function(idx) {
    var rec = this._records[idx];
    if (!rec) return;
    if (App.MAPImport && App.MAPImport._populateForm) {
      App.MAPImport._populateForm(rec);
    }
    this.close();
    App.StatusBar.set('RECORD LOADED // ' + (rec.name || 'UNNAMED'), 'ok');
  },

  open: async function() {
    var self = this;
    // Ensure wallet is connected first
    if (!App.State.walletConnected) {
      App.Wallet.toggle();
      if (!App.State.walletConnected) return;
    }

    var overlay = App.Utils.$('picker-overlay');
    overlay.innerHTML =
      '<div class="picker-modal">' +
        '<div class="picker-header">' +
          '<span class="picker-title">SELECT RECORD</span>' +
          '<button class="picker-close" id="picker-close-btn">\u2715 CLOSE</button>' +
        '</div>' +
        '<div class="picker-status">SCANNING...</div>' +
        '<div class="picker-list"></div>' +
      '</div>';
    overlay.classList.add('active');
    document.getElementById('picker-close-btn').addEventListener('click', function() { self.close(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) self.close(); });

    await this._scanWallet();
    this._renderList();
  },

  close: function() {
    App.Utils.$('picker-overlay').classList.remove('active');
  },

  init: function() {}
};
