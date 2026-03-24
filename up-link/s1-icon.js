/* ═══════════════════════════════════════════════════════════════
   s1-icon.js — Icon Design Panel (Screen 1, #p1-icon) (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Self-contained panel: HTML template, icon upload/fetch,
             colour controls, zoom slider, preview square, and the
             5-slot screenshot strip. Everything for #p1-icon in
             one file.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.State, App.StatusBar, App.Config,
             App.Gauge, App.WordGuard (from app-core.js).

   OUTPUTS:  App.Panels.S1.icon — { render(), mount() }
             App.Icon           — upload, fetch, preview, colour sync
             App.Screenshots    — 5-slot strip (icon + ss1-ss4)

   DEPENDS:  settings.js, app-core.js.

   NOTES:    render() returns the HTML string for #p1-icon.
             mount() is a no-op — init is called from app-init.js
             after all panels are rendered.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S1 = App.Panels.S1 || {};


/* ─────────────────────────────────────────────────────────────
   Panel render — HTML template for #p1-icon
   ───────────────────────────────────────────────────────────── */
App.Panels.S1.icon = {
  render: function() {
    var S = SETTINGS;
    return '' +
      '<div class="icon-controls">' +
        '<div class="plabel" id="lbl-icon">' + App.Utils.esc(S.LABEL_ICON) + '</div>' +
        '<div>' +
          '<div class="radio-row">' +
            '<label class="radio-opt"><input type="radio" name="isrc" value="upload" checked><div class="rbox"></div><span>UPLOAD</span></label>' +
            '<label class="radio-opt"><input type="radio" name="isrc" value="txid"><div class="rbox"></div><span>ON-CHAIN</span></label>' +
          '</div>' +
        '</div>' +
        '<div id="mode-upload" class="mode-container">' +
          '<div class="row"><button class="file-btn" id="browse-btn">\u25b8 BROWSE</button></div>' +
          '<div class="file-info" id="fname">SVG \u00b7 PNG \u00b7 WEBP</div>' +
          '<div class="file-info file-size-gold" id="fsize"></div>' +
        '</div>' +
        '<div id="mode-txid" class="mode-container" style="display:none;">' +
          '<input type="text" id="icon-txid" placeholder="64-char txid" style="letter-spacing:0.3px;width:100%;">' +
          '<button class="file-btn" id="fetch-btn">\u25b8 FETCH FROM CHAIN</button>' +
          '<div id="txid-st" class="status txid-status"></div>' +
        '</div>' +
        '<div class="clr-row icon-only"><label class="clr-toggle"><input type="checkbox" id="cbg-on" checked><div class="tbox"></div></label><lbl>BG</lbl><input type="color" id="cbg"><input type="text" id="cbg-h" class="hex-in"></div>' +
        '<div class="clr-row icon-only"><label class="clr-toggle"><input type="checkbox" id="cfg-on"><div class="tbox"></div></label><lbl>FG</lbl><input type="color" id="cfg"><input type="text" id="cfg-h" class="hex-in"></div>' +
        '<div class="gradient-hint icon-only" id="gradient-hint">BG ONLY \u2014 SOLID COLOUR</div>' +
        '<div class="srow srow-compact icon-only"><lbl>ALPHA</lbl><input type="range" id="opc"><span class="sval" id="opc-v"></span></div>' +
        '<div class="srow srow-compact"><lbl>ZOOM</lbl><input type="range" id="zom"><span class="sval" id="zom-v"></span></div>' +
        '<div class="row srow-compact" style="flex-shrink:0;"><lbl>ALT</lbl><input type="text" id="icon-alt" placeholder="alt text"></div>' +
      '</div>' +
      '<div class="icon-well icon-well-col" id="preview-well">' +
        '<div class="icon-preview-sq" id="icon-preview">' +
          '<div class="bg-layer" id="preview-bg"></div>' +
          '<span class="no-img" id="preview-no-img">NO IMAGE</span>' +
        '</div>' +
        '<div class="slot-strip" id="slot-strip">' +
          '<div class="slot-sq active" data-slot="0" id="slot-0"><span class="slot-inner-lbl">ico</span></div>' +
          '<div class="slot-sq" data-slot="1" id="slot-1"><span class="slot-inner-lbl">ss1</span></div>' +
          '<div class="slot-sq" data-slot="2" id="slot-2"><span class="slot-inner-lbl">ss2</span></div>' +
          '<div class="slot-sq" data-slot="3" id="slot-3"><span class="slot-inner-lbl">ss3</span></div>' +
          '<div class="slot-sq" data-slot="4" id="slot-4"><span class="slot-inner-lbl">ss4</span></div>' +
        '</div>' +
      '</div>';
  },

  mount: function() {
    // Init deferred to app-init.js (needs App.Icon, App.Screenshots)
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Icon — Icon upload, on-chain fetch, preview square
   ───────────────────────────────────────────────────────────── */
App.Icon = {
  switchMode: function(mode) {
    App.Utils.$('mode-upload').style.display = mode === 'upload' ? 'flex' : 'none';
    App.Utils.$('mode-txid').style.display   = mode === 'txid'   ? 'flex' : 'none';
    if (mode === 'txid') { App.Utils.$('txid-st').textContent = ''; App.Utils.$('txid-st').className = 'status txid-status'; }
  },

  handleFileUpload: function(file) {
    if (!file) return;
    var st = App.State;
    st.iconFilename = file.name; st.iconMime = file.type; st.iconKb = (file.size / 1024).toFixed(1);
    App.Utils.$('fname').textContent = file.name;
    var szEl = App.Utils.$('fsize');

    if (file.size > SETTINGS.MAX_ICON_BYTES) {
      szEl.textContent = st.iconKb + 'kb \u2014 OVER LIMIT'; szEl.className = 'file-info file-size-err';
      App.StatusBar.set('FILE TOO LARGE \u2014 MAX ' + Math.round(SETTINGS.MAX_ICON_BYTES / 1024) + 'KB', 'err');
      st.iconDataB64 = null; return;
    }
    szEl.textContent = st.iconKb + 'kb \u2713'; szEl.className = 'file-info file-size-green';
    App.StatusBar.set('ICON LOADED // ' + file.name, 'ok');

    var self = this;
    var reader = new FileReader();
    reader.onload = function(e) { st.iconDataB64 = e.target.result; st.iconChainUrl = null; self._loadIntoPreview(e.target.result); self.updatePreviewStyles(); };
    reader.readAsDataURL(file);
  },

  fetchFromBlockchain: async function() {
    var txid = App.Utils.$('icon-txid').value.trim();
    var el = App.Utils.$('txid-st');
    if (!App.Utils.isValidTxid(txid)) { el.textContent = '\u2717 INVALID \u2014 MUST BE 64 HEX CHARS'; el.className = 'status txid-status err'; return; }

    var activeSlot = App.Screenshots ? App.Screenshots._active : 0;
    var isScreenshot = activeSlot >= 1 && activeSlot <= 4;
    var slotLabel = isScreenshot ? 'SCREENSHOT ' + activeSlot : 'ICON';

    el.textContent = '\u27F3 FETCHING ' + slotLabel + ' FROM BLOCKCHAIN...'; el.className = 'status txid-status warn';

    var allUrls = App.Config.getAllCdnUrls(txid);
    var i, r;

    if (isScreenshot) {
      for (i = 0; i < allUrls.length; i++) { r = await this._tryFetchAsDataUrl(allUrls[i]); if (r) return this._applyFetchedScreenshot(r, txid, el, activeSlot); }
      for (i = 0; i < allUrls.length; i++) { r = await this._tryImgToBase64(allUrls[i]); if (r) return this._applyFetchedScreenshot(r, txid, el, activeSlot); }
      el.textContent = '\u2713 SS' + activeSlot + ' TXID RECORDED // No local preview (CORS)'; el.className = 'status txid-status warn';
      App.StatusBar.set('SS' + activeSlot + ' TXID STORED // Preview unavailable locally', 'warn');
      if (App.Screenshots) {
        App.Screenshots._slots[activeSlot] = {
          dataB64: null, filename: 'ss' + activeSlot, kb: '?', mime: 'image/unknown', txid: txid
        };
        App.Screenshots._updateStripThumb(activeSlot);
        App.Screenshots._updateSlotStates();
      }
    } else {
      for (i = 0; i < allUrls.length; i++) { r = await this._tryFetchAsDataUrl(allUrls[i]); if (r) return this._applyFetchedImage(r, txid, el); }
      for (i = 0; i < allUrls.length; i++) { r = await this._tryImgToBase64(allUrls[i]); if (r) return this._applyFetchedImage(r, txid, el); }
      for (i = 0; i < allUrls.length; i++) { if (await this._tryImgDisplay(allUrls[i])) return this._showChainImageDisplayOnly(allUrls[i], txid, el); }

      el.textContent = '\u2713 TXID RECORDED // No local preview (CORS) \u2014 will display on chain'; el.className = 'status txid-status warn';
      App.StatusBar.set('TXID STORED // Preview unavailable locally \u2014 image loads fine on chain', 'warn');
      App.State.iconDataB64 = null; App.State.iconMime = 'image/unknown'; App.State.iconFilename = txid.slice(0, 8); App.State.iconKb = '?';
    }
  },

  _applyFetchedScreenshot: function(result, txid, statusEl, slotIdx) {
    var kb = (result.bytes / 1024).toFixed(1);
    var ext = (result.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    if (App.Screenshots) {
      App.Screenshots._slots[slotIdx] = {
        dataB64: result.dataUrl,
        filename: txid.slice(0, 8) + '.' + ext,
        kb: parseFloat(kb),
        mime: result.mime,
        txid: txid
      };
      App.Screenshots._updateStripThumb(slotIdx);
      App.Screenshots._showSlotPreview(slotIdx);
      App.Screenshots._updateSlotStates();
    }
    statusEl.textContent = '\u2713 SS' + slotIdx + ' LOADED FROM CHAIN (' + kb + 'kb)'; statusEl.className = 'status txid-status ok';
    App.StatusBar.set('ON-CHAIN SS' + slotIdx + ' FETCHED // ' + txid.slice(0, 12) + '...', 'ok');
  },

  _applyFetchedImage: function(result, txid, statusEl) {
    var st = App.State;
    st.iconDataB64 = result.dataUrl; st.iconChainUrl = null; st.iconMime = result.mime;
    st.iconFilename = txid.slice(0, 8) + '.' + (result.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    st.iconKb = (result.bytes / 1024).toFixed(1);
    statusEl.textContent = '\u2713 LOADED FROM CHAIN (' + st.iconKb + 'kb)'; statusEl.className = 'status txid-status ok';
    App.StatusBar.set('ON-CHAIN ICON FETCHED // ' + txid.slice(0, 12) + '...', 'ok');
    this._loadIntoPreview(st.iconDataB64); this.updatePreviewStyles();
  },

  _showChainImageDisplayOnly: function(url, txid, statusEl) {
    var prev = App.Utils.$('icon-preview');
    var noImg = prev.querySelector('.no-img'); if (noImg) noImg.remove();
    var img = prev.querySelector('img'); if (!img) { img = document.createElement('img'); prev.appendChild(img); }
    img.removeAttribute('crossorigin'); img.src = url;
    App.State.iconChainUrl = url; App.State.iconDataB64 = null; App.State.iconMime = 'image/unknown'; App.State.iconFilename = txid.slice(0, 8); App.State.iconKb = '?';
    this.enforceSquare();
    statusEl.textContent = '\u2713 LOADED FROM CHAIN \u2014 PREVIEW ACTIVE'; statusEl.className = 'status txid-status ok';
    App.StatusBar.set('ON-CHAIN ICON LOADED // ' + txid.slice(0, 12) + '...', 'ok');
  },

  _tryFetchAsDataUrl: function(url) {
    var self = this;
    return new Promise(function(resolve) {
      var ac = new AbortController();
      var timer = setTimeout(function() { ac.abort(); }, SETTINGS.FETCH_TIMEOUT_MS);
      fetch(url, { signal: ac.signal }).then(function(r) {
        clearTimeout(timer); if (!r.ok) { resolve(null); return; }
        return r.arrayBuffer().then(function(buf) {
          if (buf.byteLength === 0) { resolve(null); return; }
          var b = new Uint8Array(buf.slice(0, 4)), mime = self._detectMime(b);
          if (!mime) { resolve(null); return; }
          var bin = ''; var bytes = new Uint8Array(buf);
          for (var i = 0; i < bytes.length; i += 8192) {
            var chunk = bytes.subarray(i, i + 8192);
            bin += String.fromCharCode.apply(null, chunk);
          }
          resolve({ dataUrl: 'data:' + mime + ';base64,' + btoa(bin), mime: mime, bytes: buf.byteLength });
        });
      }).catch(function() { clearTimeout(timer); resolve(null); });
    });
  },

  _tryImgToBase64: function(url) {
    return new Promise(function(resolve) {
      var img = new Image(); img.crossOrigin = 'anonymous';
      var t = setTimeout(function() { img.onload = img.onerror = null; resolve(null); }, SETTINGS.IMG_LOAD_TIMEOUT_MS);
      img.onerror = function() { clearTimeout(t); resolve(null); };
      img.onload = function() {
        clearTimeout(t);
        try { var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0); var dataUrl = c.toDataURL('image/png');
          resolve({ dataUrl: dataUrl, mime: 'image/png', bytes: Math.round(dataUrl.length * 0.75) });
        } catch(e) { resolve(null); }
      }; img.src = url;
    });
  },

  _tryImgDisplay: function(url) {
    return new Promise(function(resolve) {
      var img = new Image();
      var t = setTimeout(function() { img.onload = img.onerror = null; resolve(false); }, SETTINGS.IMG_DISPLAY_TIMEOUT_MS);
      img.onload = function() { clearTimeout(t); resolve(true); };
      img.onerror = function() { clearTimeout(t); resolve(false); };
      img.src = url;
    });
  },

  _detectMime: function(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
    if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
    if (bytes[0] === 0x3C) return 'image/svg+xml';
    return null;
  },

  _loadIntoPreview: function(src) {
    var prev = App.Utils.$('icon-preview');
    var noImg = prev.querySelector('.no-img'); if (noImg) noImg.style.display = 'none';
    var img = prev.querySelector('img:not(.ss-preview-img)'); if (!img) { img = document.createElement('img'); prev.appendChild(img); }
    img.src = src; this.enforceSquare();
    if (App.Screenshots) App.Screenshots.setIconThumb(src);
  },

  enforceSquare: function() {
    var well = App.Utils.$('preview-well'), sq = App.Utils.$('icon-preview');
    var strip = App.Utils.$('slot-strip');
    if (!well || !sq) return;
    var H = well.clientHeight;
    var W = well.clientWidth;
    if (H < 10 || W < 10) return;
    var sideFromH = strip ? Math.floor((H - 4) * 5 / 6) : H;
    var side = Math.min(W, sideFromH);
    if (side > 4) {
      sq.style.width  = side + 'px';
      sq.style.height = side + 'px';
      if (strip) strip.style.width = side + 'px';
    }
  },

  _updateGradientHint: function() {
    var $ = App.Utils.$;
    var bgOn = $('cbg-on').checked, fgOn = $('cfg-on').checked;
    var hint = $('gradient-hint');
    $('cbg').closest('.clr-row').classList.toggle('clr-row-disabled', !bgOn);
    $('cfg').closest('.clr-row').classList.toggle('clr-row-disabled', !fgOn);
    if (bgOn && fgOn)       hint.textContent = 'BG\u2192FG GRADIENT';
    else if (bgOn && !fgOn) hint.textContent = 'BG ONLY \u2014 SOLID COLOUR';
    else if (!bgOn && fgOn) hint.textContent = 'FG ONLY \u2014 SOLID COLOUR';
    else                    hint.textContent = 'NO BACKGROUND';
  },

  updatePreviewStyles: function() {
    var $ = App.Utils.$;
    var bgOn = $('cbg-on').checked, fgOn = $('cfg-on').checked;
    var alpha = parseFloat($('opc').value);
    var bg;
    if (bgOn && fgOn)       bg = App.Utils.buildGradient($('cbg').value, $('cfg').value, alpha);
    else if (bgOn && !fgOn) bg = App.Utils.hexToRgba($('cbg').value, alpha);
    else if (!bgOn && fgOn) bg = App.Utils.hexToRgba($('cfg').value, alpha);
    else                    bg = 'transparent';
    $('preview-bg').style.background = bg;
    this._updateGradientHint();
    var img = $('icon-preview').querySelector('img:not(.ss-preview-img)');
    if (img) { img.style.opacity = '1'; img.style.transform = 'scale(' + $('zom').value + ')'; }
    var ssZImg = $('icon-preview').querySelector('.ss-preview-img');
    if (ssZImg) { ssZImg.style.transform = 'scale(' + $('zom').value + ')'; ssZImg.style.transformOrigin = 'center'; }
    this.enforceSquare();
  },

  syncColour: function(which) { App.Utils.$('c' + which + '-h').value = App.Utils.$('c' + which).value; this.updatePreviewStyles(); },
  syncHex: function(which, val) { if (/^#[0-9a-fA-F]{6}$/.test(val)) { App.Utils.$('c' + which).value = val; this.updatePreviewStyles(); } },

  init: function() {
    var $ = App.Utils.$;
    var self = this;
    var radios = Array.prototype.slice.call(document.querySelectorAll('input[name=isrc]'));
    for (var i = 0; i < radios.length; i++) {
      (function(r) {
        r.addEventListener('change', function() { self.switchMode(r.value); });
      })(radios[i]);
    }
    $('browse-btn').onclick = function() { $('icon-file-input').click(); };
    $('icon-file-input').addEventListener('change', function(e) { self.handleFileUpload(e.target.files[0]); });
    $('fetch-btn').addEventListener('click', function() { self.fetchFromBlockchain(); });
    $('cbg-on').addEventListener('change', function() { self.updatePreviewStyles(); });
    $('cfg-on').addEventListener('change', function() { self.updatePreviewStyles(); });
    $('cbg').addEventListener('input', function() { self.syncColour('bg'); });
    $('cfg').addEventListener('input', function() { self.syncColour('fg'); });
    $('cbg-h').addEventListener('input', function() { self.syncHex('bg', $('cbg-h').value); });
    $('cfg-h').addEventListener('input', function() { self.syncHex('fg', $('cfg-h').value); });
    $('opc').addEventListener('input', function() { $('opc-v').textContent = parseFloat($('opc').value).toFixed(2); self.updatePreviewStyles(); });
    $('zom').addEventListener('input', function() { $('zom-v').textContent = parseFloat($('zom').value).toFixed(2); self.updatePreviewStyles(); });
    window.addEventListener('resize', function() { self.enforceSquare(); });
    requestAnimationFrame(function() { self.enforceSquare(); setTimeout(function() { self.enforceSquare(); }, 200); });
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Screenshots — 5-slot icon+screenshot selector strip
   Slot 0 = icon (App.Icon manages the preview itself).
   Slots 1-4 = screenshots SS1-SS4 managed here.
   ───────────────────────────────────────────────────────────── */
App.Screenshots = {
  _active: 0,
  _prevActive: 0,
  _slots: [null, null, null, null, null],
  _LABELS: ['ICON UPLOAD', 'SCREENSHOT 1', 'SCREENSHOT 2', 'SCREENSHOT 3', 'SCREENSHOT 4'],

  selectSlot: function(idx) {
    if (idx >= 2) {
      var sq = App.Utils.$('slot-' + idx);
      if (sq && sq.classList.contains('slot-disabled')) return;
    }
    this._active = idx;
    var panel = App.Utils.$('p1-icon');

    for (var i = 0; i <= 4; i++) {
      var sq2 = App.Utils.$('slot-' + i);
      if (sq2) sq2.classList.toggle('active', i === idx);
    }

    var lbl = App.Utils.$('lbl-icon');
    if (lbl) lbl.textContent = this._LABELS[idx];

    var txidInput = App.Utils.$('icon-txid');
    var txidSt = App.Utils.$('txid-st');
    if (txidSt) { txidSt.textContent = ''; txidSt.className = 'status txid-status'; }

    if (idx === 0) {
      if (panel) panel.classList.remove('ss-active');
      this._rewireBrowse('icon');
      if (txidInput) {
        var iconMode = document.querySelector('input[name=isrc]:checked');
        if (iconMode && iconMode.value === 'txid') txidInput.value = txidInput.dataset.iconTxid || '';
      }
      var fn = App.Utils.$('fname'), fs = App.Utils.$('fsize');
      if (fn) fn.textContent = 'SVG \u00B7 PNG \u00B7 WEBP';
      if (fs) { fs.textContent = 'MAX ' + Math.round(SETTINGS.MAX_ICON_BYTES / 1024) + 'kb'; fs.className = 'file-info file-size-gold'; }
      App.Icon.updatePreviewStyles();
      var prev = App.Utils.$('icon-preview');
      if (prev) {
        var ssImg = prev.querySelector('.ss-preview-img');
        if (ssImg) ssImg.remove();
        var iconImg = prev.querySelector('img:not(.ss-preview-img)');
        if (iconImg) iconImg.style.display = '';
        var noImg = App.Utils.$('preview-no-img');
        if (noImg) noImg.style.display = (iconImg ? 'none' : '');
        if (noImg && !iconImg) noImg.textContent = 'NO IMAGE';
      }
    } else {
      if (panel) panel.classList.add('ss-active');
      this._rewireBrowse('ss');
      if (txidInput) {
        if (this._prevActive === 0 && txidInput.value) txidInput.dataset.iconTxid = txidInput.value;
        var slot = this._slots[idx];
        txidInput.value = (slot && slot.txid) ? slot.txid : '';
      }
      this._showSlotPreview(idx);
    }
    this._prevActive = idx;
  },

  _showSlotPreview: function(idx) {
    var preview = App.Utils.$('icon-preview');
    var noImg   = App.Utils.$('preview-no-img');
    if (!preview) return;
    var iconImg = preview.querySelector('img:not(.ss-preview-img)');
    if (iconImg) iconImg.style.display = 'none';
    var ssImg = preview.querySelector('.ss-preview-img');
    if (ssImg) ssImg.remove();
    var slot = this._slots[idx];
    var fnEl = App.Utils.$('fname'), fsEl = App.Utils.$('fsize');
    if (slot && slot.dataB64) {
      if (noImg) noImg.style.display = 'none';
      ssImg = document.createElement('img');
      ssImg.className = 'ss-preview-img';
      ssImg.src = slot.dataB64;
      ssImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform-origin:center;z-index:2;transform:scale(' + parseFloat(App.Utils.$('zom').value || 1) + ');';
      preview.appendChild(ssImg);
      if (fnEl) fnEl.textContent = slot.filename || '';
      if (fsEl) { fsEl.textContent = slot.kb + 'kb'; fsEl.className = 'file-info ' + (slot.kb > Math.round(SETTINGS.MAX_SCREENSHOT_BYTES / 1024) ? 'file-size-err' : 'file-size-gold'); }
    } else {
      if (noImg) { noImg.style.display = ''; noImg.textContent = 'NO SCREENSHOT'; }
      if (fnEl) fnEl.textContent = 'PNG \u00B7 JPG \u00B7 WEBP';
      if (fsEl) { fsEl.textContent = 'MAX ' + Math.round(SETTINGS.MAX_SCREENSHOT_BYTES / 1024) + 'kb'; fsEl.className = 'file-info file-size-gold'; }
    }
  },

  _updateStripThumb: function(idx) {
    var sq = App.Utils.$('slot-' + idx); if (!sq) return;
    var slot = this._slots[idx];
    var img = sq.querySelector('img');
    if (slot && slot.dataB64) {
      sq.classList.add('has-img');
      if (!img) { img = document.createElement('img'); sq.appendChild(img); }
      img.src = slot.dataB64;
    } else {
      sq.classList.remove('has-img');
      if (img) img.remove();
    }
  },

  handleSSUpload: function(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { App.StatusBar.set('SCREENSHOTS MUST BE IMAGE FILES', 'err'); return; }
    if (file.size > SETTINGS.MAX_SCREENSHOT_BYTES) { App.StatusBar.set('SCREENSHOT TOO LARGE \u2014 MAX ' + Math.round(SETTINGS.MAX_SCREENSHOT_BYTES / 1024) + 'kb', 'err'); return; }
    var idx = this._active;
    var self = this;
    if (idx > 1 && !this._slots[idx - 1]) {
      App.StatusBar.set('UPLOAD SCREENSHOT ' + (idx - 1) + ' FIRST', 'err');
      return;
    }
    var kb = Math.round(file.size / 1024);
    var reader = new FileReader();
    reader.onload = function(e) {
      self._slots[idx] = { dataB64: e.target.result, filename: file.name, kb: kb, mime: file.type };
      self._updateStripThumb(idx);
      self._showSlotPreview(idx);
      self._updateSlotStates();
      App.StatusBar.set('SCREENSHOT ' + idx + ' LOADED \u2014 ' + file.name, 'ok');
    };
    reader.readAsDataURL(file);
  },

  clearSlot: function(idx) {
    if (idx < 1 || idx > 4) return;
    var cleared = 0;
    for (var i = idx; i <= 4; i++) {
      if (this._slots[i]) cleared++;
      this._slots[i] = null;
      this._updateStripThumb(i);
    }
    this._showSlotPreview(idx);
    this._updateSlotStates();
    var fi = App.Utils.$('ss-file-input'); if (fi) fi.value = '';
    App.StatusBar.set(cleared > 1
      ? 'SCREENSHOTS ' + idx + '-4 CLEARED'
      : 'SCREENSHOT ' + idx + ' CLEARED', 'ok');
  },

  setIconThumb: function(dataB64) {
    var sq = App.Utils.$('slot-0'); if (!sq) return;
    var img = sq.querySelector('img');
    if (dataB64) {
      sq.classList.add('has-img');
      if (!img) { img = document.createElement('img'); sq.appendChild(img); }
      img.src = dataB64;
    } else {
      sq.classList.remove('has-img');
      if (img) img.remove();
    }
  },

  getData: function() {
    return { icon: this._slots[0], screenshots: [this._slots[1], this._slots[2], this._slots[3], this._slots[4]] };
  },

  _updateSlotStates: function() {
    for (var i = 2; i <= 4; i++) {
      var sq = App.Utils.$('slot-' + i);
      if (!sq) continue;
      var prevHasData = !!this._slots[i - 1];
      sq.classList.toggle('slot-disabled', !prevHasData);
    }
  },

  _rewireBrowse: function(target) {
    var btn       = App.Utils.$('browse-btn');
    var iconInput = App.Utils.$('icon-file-input');
    var ssInput   = App.Utils.$('ss-file-input');
    if (!btn) return;
    btn.onclick = target === 'ss'
      ? function() { if (ssInput) ssInput.click(); }
      : function() { if (iconInput) iconInput.click(); };
  },

  init: function() {
    var self = this;
    for (var i = 0; i <= 4; i++) {
      (function(idx) {
        var sq = App.Utils.$('slot-' + idx);
        if (sq) sq.addEventListener('click', function() { self.selectSlot(idx); });
      })(i);
    }
    var ssInput = App.Utils.$('ss-file-input');
    if (ssInput) ssInput.addEventListener('change', function(e) { self.handleSSUpload(e.target.files[0]); });
    this.selectSlot(0);
    this._updateSlotStates();
  }
};
