/* ═══════════════════════════════════════════════════════════════
   s1-icon.js — Icon Design Panel (Screen 1, #p1-icon) (v7.9)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Self-contained panel: HTML template, icon upload/fetch,
             colour controls, zoom slider, preview square, and the
             5-slot screenshot strip. Everything for #p1-icon in
             one file.
             Each slot stores its own values independently:
               ico:  upload, chainUrl, txid, bg, fg, alpha, zoom, alt text
               ss1-4: upload, txid, zoom, alt text

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.StatusBar, App.Config,
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
            '<button class="ce-btn" id="ce-slot-btn" title="Clear this slot">CE</button>' +
          '</div>' +
        '</div>' +
        '<div id="mode-upload" class="mode-container">' +
          '<div class="row"><button class="file-btn" id="browse-btn">\u25b8 BROWSE</button></div>' +
        '</div>' +
        '<div id="mode-txid" class="mode-container" style="display:none;">' +
          '<div class="row">' +
            /* Input takes remaining width; button fixed at 16% of row — RHS */
            '<input type="text" id="icon-txid" placeholder="txid or txid_0" style="letter-spacing:0.3px;flex:1;min-width:0;font-size:1.0em;">' +
            '<button class="file-btn" id="fetch-btn" style="flex:0 0 20%;width:auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:clip;">\u25b8FETCH</button>' +
          '</div>' +
          '<div id="txid-st" class="status txid-status"></div>' +
        '</div>' +
        '<div class="icon-mid-row">' +
          '<div class="icon-sub-controls icon-only">' +
            '<div class="file-info" id="fname">GIF \u00b7 SVG \u00b7 PNG \u00b7 WEBP \u00b7 AVIF</div>' +
            '<div class="file-info file-size-gold" id="fsize"></div>' +
            '<div class="clr-row"><label class="clr-toggle"><input type="checkbox" id="cbg-on" checked><div class="tbox"></div></label><lbl>BG</lbl><input type="color" id="cbg"><input type="text" id="cbg-h" class="hex-in"></div>' +
            '<div class="clr-row"><label class="clr-toggle"><input type="checkbox" id="cfg-on"><div class="tbox"></div></label><lbl>FG</lbl><input type="color" id="cfg"><input type="text" id="cfg-h" class="hex-in"></div>' +
            '<div class="gradient-hint" id="gradient-hint">BG ONLY \u2014 SOLID COLOUR</div>' +
          '</div>' +
          '<div class="pan-box">' +
            '<div class="pan-cross">' +
              '<button class="pan-btn" id="pan-up"    title="Pan up">\u25b2</button>' +
              '<div class="pan-mid">' +
                '<button class="pan-btn" id="pan-left"  title="Pan left">\u25c4</button>' +
                '<button class="pan-btn" id="pan-right" title="Pan right">\u25ba</button>' +
              '</div>' +
              '<button class="pan-btn" id="pan-down"  title="Pan down">\u25bc</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="icon-bottom-box">' +
          '<div class="srow srow-compact icon-only"><lbl>ALPHA</lbl><input type="range" id="opc"><span class="sval" id="opc-v"></span></div>' +
          '<div class="srow srow-compact"><lbl>ZOOM</lbl><input type="range" id="zom"><span class="sval" id="zom-v"></span></div>' +
          '<div class="row srow-compact"><lbl>ALT</lbl><input type="text" id="icon-alt" placeholder="alt text"></div>' +
        '</div>' +
      '</div>' +
      '<div class="icon-well icon-well-col" id="preview-well">' +
        '<div class="icon-preview-sq" id="icon-preview">' +
          '<div class="bg-layer" id="preview-bg"></div>' +
          /* Dashed inset rectangle — shows the image boundary (80% wide, above name bar) */
          '<div id="ico-padding-guide" aria-hidden="true"></div>' +
          '<span class="no-img" id="preview-no-img">NO IMAGE</span>' +
          /* Name bar — mirrors the card tile name bar; text linked to #app-name input */
          '<div id="ico-preview-name-bar"><span id="ico-preview-name-txt">APP NAME</span></div>' +
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
    var slot = App.Screenshots._slots[0] || App.Screenshots._defaultSlotValues(0);
    App.Screenshots._slots[0] = slot;
    slot.filename = file.name; slot.mime = file.type; slot.kb = (file.size / 1024).toFixed(1);
    App.Utils.$('fname').textContent = file.name;
    var szEl = App.Utils.$('fsize');

    if (file.size > SETTINGS.MAX_ICON_BYTES) {
      szEl.textContent = slot.kb + 'kb \u2014 OVER LIMIT'; szEl.className = 'file-info file-size-err';
      App.StatusBar.set('FILE TOO LARGE \u2014 MAX ' + Math.round(SETTINGS.MAX_ICON_BYTES / 1024) + 'KB', 'err');
      slot.dataB64 = null; return;
    }
    szEl.textContent = slot.kb + 'kb \u2713'; szEl.className = 'file-info file-size-green';
    App.StatusBar.set('ICON LOADED // ' + file.name, 'ok');

    var self = this;
    var reader = new FileReader();
    reader.onload = function(e) {
      slot.dataB64 = e.target.result; slot.chainUrl = null; slot.txid = '';
      /* Clear the txid input so _saveActiveControls won't re-contaminate the slot */
      var txIn = App.Utils.$('icon-txid');
      if (txIn) txIn.value = '';
      self._loadIntoPreview(e.target.result); self.updatePreviewStyles(); App.Screenshots.setIconThumb(e.target.result);
      /* Refresh S1 fee estimate — icon upload cost now applies */
      if (App.Tips && App.Tips.updateFeeDisplay) App.Tips.updateFeeDisplay();
    };
    reader.readAsDataURL(file);
  },

  fetchFromBlockchain: async function() {
    var raw = App.Utils.$('icon-txid').value.trim();
    var el = App.Utils.$('txid-st');
    if (!App.Utils.isValidTxid(raw)) { el.textContent = '\u2717 INVALID \u2014 MUST BE 64 HEX CHARS (optional _suffix)'; el.className = 'status txid-status err'; return; }
    var txid = App.Utils.parseTxid(raw);
    /* Write normalized txid back into input so user sees what was stored */
    App.Utils.$('icon-txid').value = txid;

    var activeSlot = App.Screenshots ? App.Screenshots._active : 0;
    var isScreenshot = activeSlot >= 1 && activeSlot <= 4;
    var slotLabel = isScreenshot ? 'SCREENSHOT ' + activeSlot : 'ICON';

    el.textContent = '\u27F3 FETCHING ' + slotLabel + ' FROM BLOCKCHAIN...'; el.className = 'status txid-status warn';

    var allUrls = App.Config.getAllCdnUrls(txid);
    var i, r;

    if (isScreenshot) {
      for (i = 0; i < allUrls.length; i++) { r = await this._tryFetchAsDataUrl(allUrls[i]); if (r) return this._applyFetchedScreenshot(r, txid, el, activeSlot); }
      for (i = 0; i < allUrls.length; i++) { r = await this._tryImgToBase64(allUrls[i]); if (r) return this._applyFetchedScreenshot(r, txid, el, activeSlot); }
      /* Fallback: direct img.src CDN approach (no CORS) — same as S3 card.js loadImage() */
      var existing2 = App.Screenshots._slots[activeSlot] || App.Screenshots._defaultSlotValues(activeSlot);
      App.Screenshots._slots[activeSlot] = {
        dataB64: null, chainUrl: null, filename: 'ss' + activeSlot, kb: '?',
        mime: 'image/unknown', txid: txid, zoom: existing2.zoom, altText: existing2.altText, mode: 'txid'
      };
      this._loadFromCdn(txid, activeSlot);
      el.textContent = '\u2713 SS' + activeSlot + ' LOADING FROM CHAIN...'; el.className = 'status txid-status warn';
      App.StatusBar.set('SS' + activeSlot + ' LOADING FROM CDN...', 'warn');
    } else {
      for (i = 0; i < allUrls.length; i++) { r = await this._tryFetchAsDataUrl(allUrls[i]); if (r) return this._applyFetchedImage(r, txid, el); }
      for (i = 0; i < allUrls.length; i++) { r = await this._tryImgToBase64(allUrls[i]); if (r) return this._applyFetchedImage(r, txid, el); }
      /* Fallback: direct img.src CDN approach (no CORS) — same as S3 card.js loadImage() */
      var slot0 = App.Screenshots._slots[0] || App.Screenshots._defaultSlotValues(0);
      App.Screenshots._slots[0] = slot0;
      slot0.dataB64 = null; slot0.chainUrl = null; slot0.mime = 'image/unknown'; slot0.filename = txid.slice(0, 8); slot0.kb = '?'; slot0.txid = txid;
      this._loadFromCdn(txid, 0);
      el.textContent = '\u2713 ICON LOADING FROM CHAIN...'; el.className = 'status txid-status warn';
      App.StatusBar.set('ICON LOADING FROM CDN...', 'warn');
    }
  },

  _applyFetchedScreenshot: function(result, txid, statusEl, slotIdx) {
    var kb = (result.bytes / 1024).toFixed(1);
    var ext = (result.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    if (App.Screenshots) {
      /* Preserve existing per-slot control values (zoom, altText) */
      var existing = App.Screenshots._slots[slotIdx] || App.Screenshots._defaultSlotValues(slotIdx);
      App.Screenshots._slots[slotIdx] = {
        dataB64: result.dataUrl,
        filename: txid.slice(0, 8) + '.' + ext,
        kb: parseFloat(kb),
        mime: result.mime,
        txid: txid,
        zoom: existing.zoom,
        altText: existing.altText
      };
      App.Screenshots._updateStripThumb(slotIdx);
      App.Screenshots._showSlotPreview(slotIdx);
      App.Screenshots._updateSlotStates();
    }
    statusEl.textContent = '\u2713 SS' + slotIdx + ' LOADED FROM CHAIN (' + kb + 'kb)'; statusEl.className = 'status txid-status ok';
    App.StatusBar.set('ON-CHAIN SS' + slotIdx + ' FETCHED // ' + txid.slice(0, 12) + '...', 'ok');
  },

  _applyFetchedImage: function(result, txid, statusEl) {
    var slot = App.Screenshots._slots[0] || App.Screenshots._defaultSlotValues(0);
    App.Screenshots._slots[0] = slot;
    slot.dataB64 = result.dataUrl; slot.chainUrl = null; slot.mime = result.mime;
    slot.filename = txid.slice(0, 8) + '.' + (result.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    slot.kb = (result.bytes / 1024).toFixed(1); slot.txid = txid;
    statusEl.textContent = '\u2713 LOADED FROM CHAIN (' + slot.kb + 'kb)'; statusEl.className = 'status txid-status ok';
    App.StatusBar.set('ON-CHAIN ICON FETCHED // ' + txid.slice(0, 12) + '...', 'ok');
    this._loadIntoPreview(slot.dataB64); this.updatePreviewStyles();
    App.Screenshots.setIconThumb(slot.dataB64);
  },

  /* Shared CDN image loader for all 5 slots — direct img.src approach (no fetch, no CORS,
     no canvas). Same method S3 uses in card.js loadImage(). Tries CDN URLs in order via
     onerror. On success updates the slot, strip thumb, and preview for the active slot. */
  _loadFromCdn: function(txid, idx) {
    var urls = App.Config.getAllCdnUrls(txid);
    var attempt = 0;
    var slot = App.Screenshots._slots[idx];
    if (!slot) return;
    function tryNext() {
      if (attempt >= urls.length) return;
      var img = new Image();
      img.onload = function() {
        /* Guard: naturalWidth === 0 means browser got non-image bytes (e.g. raw script data) */
        if (img.naturalWidth === 0) { attempt++; tryNext(); return; }
        /* Store CDN URL in both — dataB64 is what _updateStripThumb/_showSlotPreview read */
        slot.chainUrl = img.src; slot.dataB64 = img.src;
        if (idx === 0) {
          App.Icon._loadIntoPreview(img.src);
          App.Icon.updatePreviewStyles();
          App.Screenshots.setIconThumb(img.src);
        } else {
          App.Screenshots._updateStripThumb(idx);
          if (App.Screenshots._active === idx) App.Screenshots._showSlotPreview(idx);
          App.Screenshots._updateSlotStates();
        }
      };
      img.onerror = function() { attempt++; tryNext(); };
      img.src = urls[attempt];
    }
    tryNext();
  },

  _showChainImageDisplayOnly: function(url, txid, statusEl) {
    var prev = App.Utils.$('icon-preview');
    var noImg = prev.querySelector('.no-img'); if (noImg) noImg.remove();
    var img = prev.querySelector('img'); if (!img) { img = document.createElement('img'); prev.appendChild(img); }
    /* Position to match real BSVhub grid geometry (top:46%, left:50%, translate(-50%,-50%)) */
    img.style.cssText = 'position:absolute;top:46%;left:50%;transform:translate(-50%,-50%);max-width:81.25%;max-height:80%;object-fit:contain;z-index:1;';
    img.removeAttribute('crossorigin'); img.src = url;
    var slot = App.Screenshots._slots[0] || App.Screenshots._defaultSlotValues(0);
    App.Screenshots._slots[0] = slot;
    slot.chainUrl = url; slot.dataB64 = null; slot.mime = 'image/unknown'; slot.filename = txid.slice(0, 8); slot.kb = '?'; slot.txid = txid;
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
          var b = new Uint8Array(buf.slice(0, 12)), mime = self._detectMime(b);
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
    /* AVIF: ftyp box at offset 4 — check for 'ftyp' then 'avif' or 'avis' */
    if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      if ((bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69) /* avi(f|s) */) return 'image/avif';
    }
    return null;
  },

  _loadIntoPreview: function(src) {
    var prev = App.Utils.$('icon-preview');
    var noImg = prev.querySelector('.no-img'); if (noImg) noImg.style.display = 'none';
    var img = prev.querySelector('img:not(.ss-preview-img)'); if (!img) { img = document.createElement('img'); prev.appendChild(img); }
    /* Position icon image to match real BSVhub grid geometry:
       centre point = top:46% (6% top gap + 80% image zone / 2), left:50%,
       max-width:81.25% (9.375% padding each side), max-height:80%      */
    img.style.cssText = 'position:absolute;top:46%;left:50%;transform:translate(-50%,-50%);max-width:81.25%;max-height:80%;object-fit:contain;z-index:1;';
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
    /* Read pan from the active slot — pan + zoom compose into one transform */
    var activeSlotForPan = App.Screenshots ? App.Screenshots._slots[App.Screenshots._active] : null;
    var panX = (activeSlotForPan && activeSlotForPan.panX) ? activeSlotForPan.panX : 0;
    var panY = (activeSlotForPan && activeSlotForPan.panY) ? activeSlotForPan.panY : 0;
    var translatePfx = 'translate(' + (panX * 100) + '%, ' + (panY * 100) + '%) ';
    var img = $('icon-preview').querySelector('img:not(.ss-preview-img)');
    /* Icon image: base position is top:46%/left:50% (grid geometry); pan + zoom stack on top.
       translate(-50%,-50%) centres it at that point, then pan offset + zoom apply. */
    if (img) {
      img.style.opacity = '1';
      img.style.transform = 'translate(calc(-50% + ' + (panX * 100) + '%), calc(-50% + ' + (panY * 100) + '%)) scale(' + $('zom').value + ')';
    }
    var ssZImg = $('icon-preview').querySelector('.ss-preview-img');
    if (ssZImg) { ssZImg.style.transform = translatePfx + 'scale(' + $('zom').value + ')'; ssZImg.style.transformOrigin = 'center'; }
    /* Persist control values into the active slot on every change */
    if (App.Screenshots) App.Screenshots._saveActiveControls();
    this.enforceSquare();
  },

  syncColour: function(which) { App.Utils.$('c' + which + '-h').value = App.Utils.$('c' + which).value; this.updatePreviewStyles(); },
  syncHex: function(which, val) { if (/^#[0-9a-fA-F]{6}$/.test(val)) { App.Utils.$('c' + which).value = val; this.updatePreviewStyles(); } },

  /* Update the ico preview name bar text from the #app-name input.
     Called on init and on every keystroke in the name field. */
  _syncNameBar: function() {
    var nameBar = document.getElementById('ico-preview-name-txt');
    if (!nameBar) return;
    var appNameEl = document.getElementById('app-name');
    var val = appNameEl ? appNameEl.value.trim() : '';
    if (val) {
      nameBar.textContent = val;
      nameBar.style.opacity = '1';
    } else {
      nameBar.textContent = 'APP NAME';
      nameBar.style.opacity = '0.3';
    }
  },

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
    /* Sync name bar from #app-name — the field lives in a different panel (s1-details.js)
       so we wire it here with getElementById rather than assuming load order */
    var appNameInput = document.getElementById('app-name');
    if (appNameInput) {
      appNameInput.addEventListener('input', function() { self._syncNameBar(); });
    }
    /* Initialise name bar text from whatever is already in the field on load */
    this._syncNameBar();
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Screenshots — 5-slot icon+screenshot selector strip
   Slot 0 = icon. Slots 1-4 = screenshots SS1-SS4.

   Each slot independently stores its own values:
     ico  (slot 0): dataB64, chainUrl, filename, kb, mime, txid, bgOn, fgOn, bg, fg, alpha, zoom, altText
     ss1-4 (1-4):   dataB64, filename, kb, mime, txid, zoom, altText

   The UI controls (zoom slider, alt text input, bg/fg/alpha for ico)
   are shared visually — values swap in/out when switching slots.
   ───────────────────────────────────────────────────────────── */
App.Screenshots = {
  _active: 0,
  _prevActive: 0,
  _slots: [null, null, null, null, null],
  _LABELS: ['ICON UPLOAD', 'SCREENSHOT 1', 'SCREENSHOT 2', 'SCREENSHOT 3', 'SCREENSHOT 4'],

  /* ── Per-slot value defaults ────────────────────────────── */
  _defaultSlotValues: function(idx) {
    var v = { dataB64: null, filename: '', kb: 0, mime: '', txid: '', zoom: SETTINGS.ICON_DEFAULT_ZOOM || 1, altText: '',
              panX: 0, panY: 0,  /* fractional pan offset — 0 = centred; clamped to ±(zoom-1)/2 */
              mode: 'upload'     /* per-slot upload/on-chain radio state */ };
    if (idx === 0) {
      v.chainUrl = null;
      v.bgOn = SETTINGS.ICON_BG_ENABLED !== undefined ? SETTINGS.ICON_BG_ENABLED : true;
      v.fgOn = SETTINGS.ICON_FG_ENABLED !== undefined ? SETTINGS.ICON_FG_ENABLED : false;
      v.bg = SETTINGS.ICON_DEFAULT_BG || '#1a1440';
      v.fg = SETTINGS.ICON_DEFAULT_FG || '#EAB300';
      v.alpha = SETTINGS.ICON_DEFAULT_ALPHA || 1;
    }
    return v;
  },

  /* ── Save current UI control values into the active slot ── */
  _saveActiveControls: function() {
    var $ = App.Utils.$;
    var idx = this._active;
    var slot = this._slots[idx];
    /* Build a values object even if slot has no image data yet —
       we store control state regardless so switching back restores it */
    if (!slot) {
      slot = this._defaultSlotValues(idx);
      this._slots[idx] = slot;
    }
    slot.zoom = $('zom') ? $('zom').value : (slot.zoom || 1);
    slot.altText = $('icon-alt') ? $('icon-alt').value.trim() : (slot.altText || '');
    /* Save txid from the shared input if user typed/pasted one */
    var txIn = $('icon-txid');
    if (txIn && txIn.value.trim()) slot.txid = txIn.value.trim();
    /* Save upload/on-chain radio state — each slot tracks its own mode */
    var activeRadio = document.querySelector('input[name=isrc]:checked');
    if (activeRadio) slot.mode = activeRadio.value;
    if (idx === 0) {
      slot.bgOn  = $('cbg-on') ? $('cbg-on').checked : slot.bgOn;
      slot.fgOn  = $('cfg-on') ? $('cfg-on').checked : slot.fgOn;
      slot.bg    = $('cbg')    ? $('cbg').value       : slot.bg;
      slot.fg    = $('cfg')    ? $('cfg').value       : slot.fg;
      slot.alpha = $('opc')    ? $('opc').value       : slot.alpha;
    }
  },

  /* ── Load a slot's stored values into the UI controls ──── */
  _loadSlotControls: function(idx) {
    var $ = App.Utils.$;
    var slot = this._slots[idx];
    var defs = this._defaultSlotValues(idx);
    var zoom = (slot && slot.zoom !== undefined) ? slot.zoom : defs.zoom;
    var alt  = (slot && slot.altText !== undefined) ? slot.altText : defs.altText;
    if ($('zom'))   { $('zom').value = zoom; $('zom-v').textContent = parseFloat(zoom).toFixed(2); }
    if ($('icon-alt')) $('icon-alt').value = alt;
    /* Restore upload/on-chain radio state for this slot — each slot is independent */
    var slotMode = (slot && slot.mode) ? slot.mode : 'upload';
    var radioToCheck = document.querySelector('input[name=isrc][value="' + slotMode + '"]');
    if (radioToCheck) radioToCheck.checked = true;
    App.Icon.switchMode(slotMode);
    if (idx === 0) {
      var bgOn  = (slot && slot.bgOn !== undefined)  ? slot.bgOn  : defs.bgOn;
      var fgOn  = (slot && slot.fgOn !== undefined)  ? slot.fgOn  : defs.fgOn;
      var bg    = (slot && slot.bg)                  ? slot.bg    : defs.bg;
      var fg    = (slot && slot.fg)                  ? slot.fg    : defs.fg;
      var alpha = (slot && slot.alpha !== undefined)  ? slot.alpha : defs.alpha;
      if ($('cbg-on')) $('cbg-on').checked = bgOn;
      if ($('cfg-on')) $('cfg-on').checked = fgOn;
      if ($('cbg'))    $('cbg').value   = bg;
      if ($('cbg-h'))  $('cbg-h').value = bg;
      if ($('cfg'))    $('cfg').value   = fg;
      if ($('cfg-h'))  $('cfg-h').value = fg;
      if ($('opc'))    { $('opc').value = alpha; $('opc-v').textContent = parseFloat(alpha).toFixed(2); }
    }
  },

  selectSlot: function(idx) {
    if (idx >= 2) {
      var sq = App.Utils.$('slot-' + idx);
      if (sq && sq.classList.contains('slot-disabled')) return;
    }

    /* Save outgoing slot's control values before switching */
    this._saveActiveControls();

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

    /* Load incoming slot's control values into UI */
    this._loadSlotControls(idx);

    if (idx === 0) {
      if (panel) panel.classList.remove('ss-active');
      /* Show ico-only overlays: name bar + padding guide */
      var nameBar = document.getElementById('ico-preview-name-bar');
      var padGuide = document.getElementById('ico-padding-guide');
      if (nameBar)  nameBar.style.display  = '';
      if (padGuide) padGuide.style.display = '';
      this._rewireBrowse('icon');
      if (txidInput) {
        var s0 = this._slots[0];
        txidInput.value = (s0 && s0.txid) ? s0.txid : '';
      }
      var fn = App.Utils.$('fname'), fs = App.Utils.$('fsize');
      var s0d = this._slots[0];
      if (fn) fn.textContent = (s0d && s0d.filename) ? s0d.filename : 'GIF \u00B7 SVG \u00B7 PNG \u00B7 WEBP \u00B7 AVIF';
      if (fs) {
        if (s0d && s0d.dataB64) { fs.textContent = s0d.kb + 'kb \u2713'; fs.className = 'file-info file-size-green'; }
        else { fs.textContent = 'MAX ' + Math.round(SETTINGS.MAX_ICON_BYTES / 1024) + 'kb'; fs.className = 'file-info file-size-gold'; }
      }
      /* Restore BG/FG gradient layer — only applies to icon */
      var bgLayer = App.Utils.$('preview-bg');
      if (bgLayer) bgLayer.style.display = '';
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
      /* Hide ico-only overlays: name bar + padding guide */
      var nameBar2 = document.getElementById('ico-preview-name-bar');
      var padGuide2 = document.getElementById('ico-padding-guide');
      if (nameBar2)  nameBar2.style.display  = 'none';
      if (padGuide2) padGuide2.style.display = 'none';
      this._rewireBrowse('ss');
      if (txidInput) {
        var slot = this._slots[idx];
        txidInput.value = (slot && slot.txid) ? slot.txid : '';
      }
      /* Hide BG/FG gradient layer — screenshots don't support bg/fg */
      var bgLayer2 = App.Utils.$('preview-bg');
      if (bgLayer2) bgLayer2.style.display = 'none';
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
    /* Read zoom from stored slot value, not from global control */
    var slotZoom = (slot && slot.zoom !== undefined) ? slot.zoom : 1;
    if (slot && slot.dataB64) {
      if (noImg) noImg.style.display = 'none';
      ssImg = document.createElement('img');
      ssImg.className = 'ss-preview-img';
      ssImg.src = slot.dataB64;
      /* Pan + zoom compose into one transform — pan stored as fraction, translated to % */
      var slotPanX = (slot && slot.panX) ? slot.panX : 0;
      var slotPanY = (slot && slot.panY) ? slot.panY : 0;
      if (idx === 0) {
        /* Slot 0 (ico): match real BSVhub grid geometry — top:46%, left:50%, translate(-50%,-50%)
           Pan offsets compose into the translate so the image pans within its centre point. */
        ssImg.style.cssText = 'position:absolute;top:46%;left:50%;max-width:81.25%;max-height:80%;object-fit:contain;transform-origin:center;z-index:2;transform:translate(calc(-50% + ' + (slotPanX * 100) + '%), calc(-50% + ' + (slotPanY * 100) + '%)) scale(' + parseFloat(slotZoom) + ');';
      } else {
        /* Slots 1-4 (screenshots): fill full preview area */
        ssImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform-origin:center;z-index:2;transform:translate(' + (slotPanX * 100) + '%, ' + (slotPanY * 100) + '%) scale(' + parseFloat(slotZoom) + ');';
      }
      preview.appendChild(ssImg);
      if (fnEl) fnEl.textContent = slot.filename || '';
      if (fsEl) { fsEl.textContent = slot.kb + 'kb'; fsEl.className = 'file-info ' + (slot.kb > Math.round(SETTINGS.MAX_SCREENSHOT_BYTES / 1024) ? 'file-size-err' : 'file-size-gold'); }
    } else {
      if (noImg) { noImg.style.display = ''; noImg.textContent = 'NO SCREENSHOT'; }
      if (fnEl) fnEl.textContent = 'GIF \u00B7 PNG \u00B7 JPG \u00B7 WEBP \u00B7 AVIF';
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
      /* Preserve any existing per-slot control values (zoom, alt) */
      var existing = self._slots[idx] || self._defaultSlotValues(idx);
      self._slots[idx] = {
        dataB64: e.target.result, filename: file.name, kb: kb, mime: file.type,
        txid: '', zoom: existing.zoom, altText: existing.altText
      };
      /* Clear the txid input so _saveActiveControls won't re-contaminate the slot */
      var txIn = App.Utils.$('icon-txid');
      if (txIn) txIn.value = '';
      self._updateStripThumb(idx);
      self._showSlotPreview(idx);
      self._updateSlotStates();
      App.StatusBar.set('SCREENSHOT ' + idx + ' LOADED \u2014 ' + file.name, 'ok');
      /* Refresh S1 fee estimate — screenshot upload cost now applies */
      if (App.Tips && App.Tips.updateFeeDisplay) App.Tips.updateFeeDisplay();
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
    /* Reset controls to defaults for this slot */
    this._loadSlotControls(idx);
    this._showSlotPreview(idx);
    this._updateSlotStates();
    var fi = App.Utils.$('ss-file-input'); if (fi) fi.value = '';
    App.StatusBar.set(cleared > 1
      ? 'SCREENSHOTS ' + idx + '-4 CLEARED'
      : 'SCREENSHOT ' + idx + ' CLEARED', 'ok');
  },

  /* Clear only the active slot's image data (CE button) */
  clearEntry: function() {
    var $ = App.Utils.$;
    var idx = this._active;
    if (idx === 0) {
      var activeRadio = document.querySelector('input[name=isrc]:checked');
      var currentMode = activeRadio ? activeRadio.value : 'upload';
      this._slots[0] = this._defaultSlotValues(0);
      this._slots[0].mode = currentMode;
      this.setIconThumb(null);
      /* Reset icon preview */
      var prev = $('icon-preview');
      if (prev) {
        var img = prev.querySelector('img'); if (img) img.remove();
        var ssImg = prev.querySelector('.ss-preview-img'); if (ssImg) ssImg.remove();
        var noImg = $('preview-no-img');
        if (noImg) { noImg.style.display = ''; noImg.textContent = 'NO IMAGE'; }
      }
      $('preview-bg').style.background = '';
      if ($('fname')) $('fname').textContent = 'GIF \u00B7 SVG \u00B7 PNG \u00B7 WEBP \u00B7 AVIF';
      if ($('fsize')) { $('fsize').textContent = 'MAX ' + Math.round(SETTINGS.MAX_ICON_BYTES / 1024) + 'kb'; $('fsize').className = 'file-info file-size-gold'; }
      if ($('icon-file-input')) $('icon-file-input').value = '';
    } else {
      var activeRadio2 = document.querySelector('input[name=isrc]:checked');
      var currentMode2 = activeRadio2 ? activeRadio2.value : 'upload';
      this._slots[idx] = this._defaultSlotValues(idx);
      this._slots[idx].mode = currentMode2;
      this._showSlotPreview(idx);
      if ($('ss-file-input')) $('ss-file-input').value = '';
    }
    /* Clear shared controls */
    if ($('icon-txid')) $('icon-txid').value = '';
    if ($('txid-st')) { $('txid-st').textContent = ''; $('txid-st').className = 'status txid-status'; }
    this._updateStripThumb(idx);
    this._loadSlotControls(idx);
    this._updateSlotStates();
    var label = idx === 0 ? 'ICON' : 'SCREENSHOT ' + idx;
    App.StatusBar.set(label + ' CLEARED', 'ok');
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

  /* Return per-slot data for collectData / MAP export.
     Each slot includes zoom and altText alongside image data. */
  getData: function() {
    /* Snapshot current UI controls into active slot before returning */
    this._saveActiveControls();
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

    /* ── Pan config — reads from SETTINGS, falls back to 2% safe default ── */
    var PAN_STEP = (SETTINGS && SETTINGS.ICON_PAN_STEP) || 0.02;

    for (var i = 0; i <= 4; i++) {
      (function(idx) {
        var sq = App.Utils.$('slot-' + idx);
        if (sq) sq.addEventListener('click', function() { self.selectSlot(idx); });
      })(i);
    }
    var ssInput = App.Utils.$('ss-file-input');
    if (ssInput) ssInput.addEventListener('change', function(e) { self.handleSSUpload(e.target.files[0]); });
    /* CE button — clear active slot */
    var ceBtn = App.Utils.$('ce-slot-btn');
    if (ceBtn) ceBtn.addEventListener('click', function() { self.clearEntry(); });

    /* Pan buttons — shift active slot image by PAN_STEP per press.
       Clamped to ±(zoom-1)/2 so the image edge never passes the preview edge. */
    function _applyPan(dx, dy) {
      var idx = self._active;
      var slot = self._slots[idx];
      /* Inert when no image loaded in this slot */
      if (!slot || (!slot.dataB64 && !slot.chainUrl && !slot.txid)) return;
      var zoom = parseFloat(slot.zoom) || 1;
      var maxPan = Math.max(0, (zoom - 1) / 2);
      slot.panX = Math.min(maxPan, Math.max(-maxPan, (slot.panX || 0) + dx));
      slot.panY = Math.min(maxPan, Math.max(-maxPan, (slot.panY || 0) + dy));
      /* Refresh preview with updated pan */
      if (idx === 0) {
        App.Icon.updatePreviewStyles();
      } else {
        self._showSlotPreview(idx);
      }
    }
    var panUp    = App.Utils.$('pan-up');
    var panDown  = App.Utils.$('pan-down');
    var panLeft  = App.Utils.$('pan-left');
    var panRight = App.Utils.$('pan-right');
    if (panUp)    panUp.addEventListener('click',    function() { _applyPan(0,         -PAN_STEP); });
    if (panDown)  panDown.addEventListener('click',  function() { _applyPan(0,          PAN_STEP); });
    if (panLeft)  panLeft.addEventListener('click',  function() { _applyPan(-PAN_STEP,  0);        });
    if (panRight) panRight.addEventListener('click', function() { _applyPan( PAN_STEP,  0);        });

    /* Initialise slot 0 (icon) with default control values */
    this._slots[0] = this._defaultSlotValues(0);
    this.selectSlot(0);
    this._updateSlotStates();
  }
};
