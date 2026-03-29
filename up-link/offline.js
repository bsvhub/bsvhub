/* ═══════════════════════════════════════════════════════════════════════
   offline.js (v7.4) — Offline/Local Testing Module for BSV Directory Portal
   ═══════════════════════════════════════════════════════════════════════

   Provides .txt file export/import for MAP protocol records.
   Used for local testing without a real BRC-100 wallet.

   This file is OPTIONAL. If missing, the portal runs in on-chain-only
   mode. If present, it registers App.Capabilities.offline = true and
   the portal enables local simulation features.

   Requires: App object to exist (defined in HTML before this loads).
   ═══════════════════════════════════════════════════════════════════════ */


// ─────────────────────────────────────────────────────────────────────
//  App.MAPExport — Serialise form data to MAP protocol text
//  and trigger browser download as .txt file.
//
//  IMPORTANT — additive extension, not a replacement:
//  onchain.js (loaded before this file) may have already attached
//  saveOnChain and other methods to App.MAPExport.  Using a bare
//  assignment ( App.MAPExport = { … } ) would silently destroy those
//  methods, causing saveMAP() to fall through to the offline file-save
//  path even when on-chain mode is active.
//
//  Object.assign merges our offline methods into whatever object already
//  exists (or into a fresh one if onchain.js is absent), preserving any
//  methods added by earlier scripts.
// ─────────────────────────────────────────────────────────────────────

App.MAPExport = Object.assign(App.MAPExport || {}, {

  // Generate a mock 64-char hex txid for local testing.
  _mockTxid: function() {
    var hex = '0123456789abcdef';
    var id = '';
    for (var i = 0; i < 64; i++) id += hex[Math.floor(Math.random() * 16)];
    return id;
  },

  // Build ordered MAP key-value pairs from collectData() output.
  // This field order matches the on-chain MAP SET structure exactly.
  // Shared by both offline (serialisation) and on-chain (hex scripts).
  _buildMAPFields: function(d) {
    var fields = [
      ['protocol',          d.protocol],
      ['protocol_version',  d.protocol_version],
      ['name',              d.name || ''],
      ['abbreviation',      d.abbreviation || ''],
      ['url',               d.url || ''],
      ['tor_url',           d.tor_url || ''],
      ['bsv_address',       d.bsv_address || ''],
      ['category',          d.category || ''],
      ['subcategory',       d.subcategory || ''],
      ['status',            d.status || ''],
      ['language',          d.language || ''],
      ['bsv_content',       String(!!d.bsv_content)],
      ['brc100',            String(d.brc100)],
      ['on_chain',          String(!!d.on_chain)],
      ['accepts_bsv',       String(!!d.accepts_bsv)],
      ['open_source',       String(!!d.open_source)],
      ['release_date',      d.release_date || ''],
      ['version',           d.version || ''],
      ['tags',              d.tags || ''],
      ['description',       d.description || ''],
    ];

    // Features — only include non-empty slots
    d.features.forEach(function(f, i) {
      if (f) fields.push(['feature_' + (i + 1), f]);
    });

    fields.push(
      ['icon_txid',         d.icon_txid || '(pending)'],
      ['icon_format',       d.icon_format || ''],
      ['icon_size_kb',      String(d.icon_size_kb || '')],
      ['icon_bg_enabled',   String(d.icon_bg_enabled)],
      ['icon_fg_enabled',   String(d.icon_fg_enabled)],
      ['icon_bg_colour',    d.icon_bg_colour || ''],
      ['icon_fg_colour',    d.icon_fg_colour || ''],
      ['icon_bg_alpha',     String(d.icon_bg_alpha)],
      ['icon_zoom',         String(d.icon_zoom)],
      ['icon_pan_x',        String(d.icon_pan_x !== undefined ? d.icon_pan_x : 0)],
      ['icon_pan_y',        String(d.icon_pan_y !== undefined ? d.icon_pan_y : 0)],
      ['alt_text',          d.alt_text || ''],
      ['developer_paymail', d.developer_paymail || ''],
      ['developer_twitter', d.developer_twitter || ''],
      ['developer_github',  d.developer_github || ''],
      ['developer_bio',     d.developer_bio || ''],
    );

    // Screenshots — ss1 through ss4 txids, metadata, per-slot zoom + alt text
    var ss = d.screenshots || [null, null, null, null];
    for (var si = 0; si < 4; si++) {
      var n = si + 1;
      var slot = ss[si];
      if (slot || d['ss' + n + '_txid']) {
        fields.push(['ss' + n + '_txid',     d['ss' + n + '_txid'] || '(pending)']);
        fields.push(['ss' + n + '_format',   (slot && slot.mime) || d['ss' + n + '_format'] || '']);
        fields.push(['ss' + n + '_size_kb',  (slot && String(slot.kb)) || d['ss' + n + '_size_kb'] || '']);
        fields.push(['ss' + n + '_zoom',     d['ss' + n + '_zoom'] || (slot && String(slot.zoom)) || '1']);
        fields.push(['ss' + n + '_pan_x',    d['ss' + n + '_pan_x'] !== undefined ? String(d['ss' + n + '_pan_x']) : '0']);
        fields.push(['ss' + n + '_pan_y',    d['ss' + n + '_pan_y'] !== undefined ? String(d['ss' + n + '_pan_y']) : '0']);
        fields.push(['ss' + n + '_alt_text', d['ss' + n + '_alt_text'] || (slot && slot.altText) || '']);
      }
    }

    return fields;
  },

  // Serialise form data to MAP protocol text format.
  _serialise: function(d) {
    var fields = this._buildMAPFields(d);
    var mockId = this._mockTxid();
    var ts = new Date().toISOString();

    var maxKey = 0;
    fields.forEach(function(pair) { if (pair[0].length > maxKey) maxKey = pair[0].length; });

    var lines = [
      '# ═══════════════════════════════════════════════════════════════',
      '# UP-LINK — MAP PROTOCOL RECORD',
      '# ═══════════════════════════════════════════════════════════════',
      '#',
      '# Timestamp:  ' + ts,
      '# App ID:     ' + mockId + '  [LOCAL TEST — mock txid]',
      '# Action:     MAP SET',
      '# Protocol:   ' + d.protocol + ' v' + d.protocol_version,
      '#',
      '# [TEMPORARY] Local test file — not written to chain.',
      '# ═══════════════════════════════════════════════════════════════',
      '',
      'MAP SET',
    ];

    fields.forEach(function(pair) {
      lines.push(pair[0].padEnd(maxKey + 2) + '| ' + pair[1]);
    });

    if (d.tip_bsv > 0) {
      lines.push('');
      lines.push('# TIP: ' + d.tip_bsv + ' BSV (included in transaction output)');
    }

    // Only embed icon data if it's not already on-chain
    var iconOnChain = d.icon_txid && App.Utils.isValidTxid(d.icon_txid);
    if (d.icon_data_b64 && !iconOnChain) {
      lines.push('');
      lines.push('# ═══════════════════════════════════════════════════════════════');
      lines.push('# B:// ICON DATA');
      lines.push('# [TEMPORARY] Embedded for local testing only.');
      lines.push('# ═══════════════════════════════════════════════════════════════');
      lines.push('B_ICON_DATA | ' + d.icon_data_b64);
    }

    // Only embed screenshot data if not already on-chain
    var ss = d.screenshots || [null, null, null, null];
    for (var si = 0; si < 4; si++) {
      var ssn = si + 1;
      var ssTxid = d['ss' + ssn + '_txid'];
      var ssOnChain = ssTxid && App.Utils.isValidTxid(ssTxid);
      if (ss[si] && ss[si].dataB64 && !ssOnChain) {
        lines.push('');
        lines.push('# B:// SCREENSHOT ' + ssn + ' DATA');
        lines.push('B_SS' + ssn + '_DATA | ' + ss[si].dataB64);
      }
    }

    lines.push('');
    lines.push('# ═══════════════════════════════════════════════════════════════');
    lines.push('# OP_RETURN REFERENCE (single-line on-chain format)');
    lines.push('# ═══════════════════════════════════════════════════════════════');
    var opParts = ['OP_RETURN', '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5', 'SET'];
    fields.forEach(function(pair) { opParts.push(pair[0], pair[1]); });
    lines.push('# ' + opParts.join(' | '));

    lines.push('');
    lines.push('# END OF RECORD');

    return { text: lines.join('\n'), mockId: mockId };
  },

  // Trigger browser file download.
  // Strategy:
  //   1. showSaveFilePicker (Chromium HTTPS — native save dialog with confirmation)
  //   2. <a download> with blob URL (works on HTTP, file://, and most browsers)
  //   3. window.open blob URL (Firefox HTTPS fallback — programmatic <a download>
  //      is silently blocked by Firefox on HTTPS with Cloudflare/GitHub Pages
  //      headers. Both blob URLs and data URIs via <a>.click() fail. Opening
  //      a blob URL in a new tab forces Firefox to offer a download dialog.)
  _downloadFile: function(text, filename) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

    // Path 1: File System Access API (Chromium on HTTPS)
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }]
      }).then(function(handle) {
        return handle.createWritable();
      }).then(function(writable) {
        writable.write(blob);
        return writable.close();
      })['catch'](function(err) {
        if (err.name !== 'AbortError') console.warn('Save failed:', err);
      });
      return;
    }

    // Path 2 & 3: Firefox on HTTPS silently blocks <a download>.click() for
    // both blob URLs and data URIs when restrictive headers are present.
    // Use window.open with blob URL instead — Firefox treats this as user-
    // initiated navigation and will offer save/open dialog.
    var isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

    if (isFirefox && location.protocol === 'https:') {
      var url = URL.createObjectURL(blob);
      var w = window.open(url, '_blank');
      // If popup was blocked, try location.href as last resort
      if (!w) {
        window.location.href = url;
      }
      setTimeout(function() { URL.revokeObjectURL(url); }, 30000);
      return;
    }

    // Path 2: Standard <a download> — works on HTTP, file://, non-Firefox HTTPS
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  },

  // Main entry point — validate, serialise, download.
  save: function() {
    var d = App.Form.collectData();
    var result = this._serialise(d);

    var safeName = (d.name || 'unnamed').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
    var date = new Date().toISOString().slice(0, 10);
    var filename = 'up-link_MAP_' + safeName + '_' + date + '.txt';

    this._downloadFile(result.text, filename);
    App.StatusBar.set('MAP RECORD SAVED // ' + filename, 'ok');

    return result.mockId;
  },

  init: function() {
    // Set up the saveMAP bridge for offline mode.
    // If onchain.js also loads, it will wrap this in a dispatcher.
    // If only offline.js loads, this is the only save path.
    if (!window.saveMAP) {
      window.saveMAP = function() {
        return App.MAPExport.save();
      };
    }
  },
});


// ─────────────────────────────────────────────────────────────────────
//  App.MAPImport — Parse a MAP protocol text file and populate
//  the submit form for update/edit testing.
// ─────────────────────────────────────────────────────────────────────

App.MAPImport = {

  // Parse MAP protocol text into a key-value object.
  _parse: function(text) {
    var fields = {};
    var inMAPBlock = false;

    text.split('\n').forEach(function(line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      if (trimmed === 'MAP SET') { inMAPBlock = true; return; }

      if (trimmed.startsWith('B_ICON_DATA')) {
        var pipeIdx = trimmed.indexOf('|');
        if (pipeIdx !== -1) fields._icon_data_b64 = trimmed.slice(pipeIdx + 1).trim();
        return;
      }
      // Parse embedded screenshot data (B_SS1_DATA through B_SS4_DATA)
      for (var ssi = 1; ssi <= 4; ssi++) {
        if (trimmed.startsWith('B_SS' + ssi + '_DATA')) {
          var ssPipeIdx = trimmed.indexOf('|');
          if (ssPipeIdx !== -1) fields['_ss' + ssi + '_data_b64'] = trimmed.slice(ssPipeIdx + 1).trim();
          return;
        }
      }

      if (inMAPBlock) {
        var pipeIdx2 = trimmed.indexOf('|');
        if (pipeIdx2 === -1) return;
        var key = trimmed.slice(0, pipeIdx2).trim();
        var val = trimmed.slice(pipeIdx2 + 1).trim();
        if (key) fields[key] = val;
      }
    });

    return fields;
  },

  // Populate form fields from parsed MAP data.
  // Reusable for both local file import and on-chain record loading.
  _populateForm: function(f) {
    var $ = App.Utils.$;

    // Clear all fields first so no stale data from a previous record lingers.
    // skipPicker=true prevents clearAll from triggering the record picker again.
    if (App.Form && App.Form.clearAll) App.Form.clearAll();

    // Normalize icon_txid to canonical txid_suffix form before storing.
    // parseTxid() appends _0 to bare 64-hex, leaves already-suffixed values alone.
    // This prevents a false diff when fetchFromBlockchain() normalises the same way.
    if (f.icon_txid && App.Utils.isValidTxid(f.icon_txid)) {
      f = Object.assign({}, f, { icon_txid: App.Utils.parseTxid(f.icon_txid) });
    }

    // Store original loaded data for diff comparison in preview
    App.State.loadedRecord = Object.assign({}, f);

    // Auto-switch to UPDATE mode (skipPicker=true — record already being loaded)
    App.Mode.set('update', true);

    // --- Text inputs ---
    if (f.name !== undefined)    $('app-name').value = f.name;
    if (f.abbreviation !== undefined) $('app-abbr').value = f.abbreviation;
    if (f.url !== undefined)     $('app-url').value = f.url;
    if (f.tor_url !== undefined) $('app-tor').value = f.tor_url;
    if (f.bsv_address !== undefined) $('app-bsv').value = f.bsv_address;
    if (f.tags !== undefined)    $('app-tags').value = f.tags;
    if (f.version !== undefined) $('app-ver').value = f.version;
    if (f.release_date !== undefined) { $('app-rel').value = f.release_date; $('rel-today').checked = false; $('app-rel').disabled = false; }
    if (f.brc100 !== undefined) $('brc100-on').checked = f.brc100 === 'true' || f.brc100 === true;
    if (f.bsv_content !== undefined) $('flag-bsv-content').checked = f.bsv_content === 'true' || f.bsv_content === true;
    if (f.on_chain !== undefined) $('flag-on-chain').checked = f.on_chain === 'true' || f.on_chain === true;
    if (f.accepts_bsv !== undefined) $('flag-accepts-bsv').checked = f.accepts_bsv === 'true' || f.accepts_bsv === true;
    if (f.open_source !== undefined) $('flag-open-source').checked = f.open_source === 'true' || f.open_source === true;

    // --- Selects ---
    if (f.status) $('app-status').value = f.status;

    // --- Language multi-select ---
    if (f.language) {
      var langs = f.language.split(';').map(function(l) { return l.trim(); }).filter(Boolean);
      document.querySelectorAll('#lang-dd input[type=checkbox]').forEach(function(cb) {
        cb.checked = langs.includes(cb.value);
      });
      App.Lang.updatePills();
    }

    // --- Categories + Subcategories (via App.Category single source of truth) ---
    if (App.Category) {
      App.Category.restore(f.category || '', f.subcategory || '');
    }

    // --- Description ---
    if (f.description !== undefined) {
      $('desc').value = f.description;
      $('desc').dispatchEvent(new Event('input'));
    }

    // --- Features ---
    for (var i = 1; i <= SETTINGS.MAX_FEATURES; i++) {
      var el = $('f' + i);
      if (!el) continue;
      var val = f['feature_' + i] || '';
      if (i > 1 && val) el.disabled = false;
      el.value = val;
      el.dispatchEvent(new Event('input'));
    }

    // --- Developer fields ---
    if (f.developer_twitter !== undefined) $('dev-tw').value = f.developer_twitter;
    if (f.developer_github !== undefined)  $('dev-gh').value = f.developer_github;
    if (f.developer_bio !== undefined) {
      $('dev-bio').value = f.developer_bio;
      $('dev-bio').dispatchEvent(new Event('input'));
    }
    if (f.developer_paymail && App.State.walletConnected) {
      $('dev-paymail').value = f.developer_paymail;
    }

    // --- Restore all icon data into _slots[0] (single source of truth) ---
    if (App.Screenshots) {
      var s0 = App.Screenshots._defaultSlotValues(0);
      if (f.icon_format) s0.mime = f.icon_format;
      if (f.icon_size_kb && f.icon_size_kb !== '\u2014') s0.kb = f.icon_size_kb;
      if (f.icon_txid && f.icon_txid !== '(pending)') s0.txid = f.icon_txid;
      if (f.icon_bg_enabled !== undefined) s0.bgOn = f.icon_bg_enabled === 'true' || f.icon_bg_enabled === true;
      else if (f.icon_bg_colour && f.icon_bg_colour !== '\u2014') s0.bgOn = true;
      if (f.icon_fg_enabled !== undefined) s0.fgOn = f.icon_fg_enabled === 'true' || f.icon_fg_enabled === true;
      else if (f.icon_fg_colour && f.icon_fg_colour !== '\u2014') s0.fgOn = true;
      if (f.icon_bg_colour && /^#[0-9a-fA-F]{6}$/.test(f.icon_bg_colour)) s0.bg = f.icon_bg_colour;
      if (f.icon_fg_colour && /^#[0-9a-fA-F]{6}$/.test(f.icon_fg_colour)) s0.fg = f.icon_fg_colour;
      if (f.icon_bg_alpha !== undefined) s0.alpha = f.icon_bg_alpha;
      if (f.icon_zoom !== undefined) s0.zoom = f.icon_zoom;
      /* parseFloat with || '0' so OP_0 decoded as '' maps to 0, not a false diff */
      s0.panX = parseFloat(f.icon_pan_x || '0') || 0;
      s0.panY = parseFloat(f.icon_pan_y || '0') || 0;
      if (f.alt_text !== undefined) s0.altText = f.alt_text;

      // Image data: embedded B64 or chain fetch
      if (f._icon_data_b64) {
        s0.dataB64 = f._icon_data_b64; s0.chainUrl = null;
      }
      App.Screenshots._slots[0] = s0;
    }

    // --- Populate icon UI controls from slot 0 ---
    if (f.icon_bg_enabled !== undefined) {
      $('cbg-on').checked = f.icon_bg_enabled === 'true' || f.icon_bg_enabled === true;
    } else if (f.icon_bg_colour && f.icon_bg_colour !== '\u2014') {
      $('cbg-on').checked = true;
    }
    if (f.icon_fg_enabled !== undefined) {
      $('cfg-on').checked = f.icon_fg_enabled === 'true' || f.icon_fg_enabled === true;
    } else if (f.icon_fg_colour && f.icon_fg_colour !== '\u2014') {
      $('cfg-on').checked = true;
    }
    if (f.icon_bg_colour && /^#[0-9a-fA-F]{6}$/.test(f.icon_bg_colour)) {
      $('cbg').value = f.icon_bg_colour; $('cbg-h').value = f.icon_bg_colour;
    }
    if (f.icon_fg_colour && /^#[0-9a-fA-F]{6}$/.test(f.icon_fg_colour)) {
      $('cfg').value = f.icon_fg_colour; $('cfg-h').value = f.icon_fg_colour;
    }
    if (f.icon_bg_alpha !== undefined) {
      $('opc').value = f.icon_bg_alpha; $('opc-v').textContent = parseFloat(f.icon_bg_alpha).toFixed(2);
    }
    if (f.icon_zoom !== undefined) {
      $('zom').value = f.icon_zoom; $('zom-v').textContent = parseFloat(f.icon_zoom).toFixed(2);
    }
    if (f.alt_text !== undefined) $('icon-alt').value = f.alt_text;

    // --- Icon mode and preview ---
    if (f.icon_txid && f.icon_txid !== '(pending)' && App.Utils.isValidTxid(f.icon_txid)) {
      var txidRadio = document.querySelector('input[name=isrc][value=txid]');
      txidRadio.checked = true;
      App.Icon.switchMode('txid');
      $('icon-txid').value = f.icon_txid;
    }
    if (f._icon_data_b64) {
      App.Icon._loadIntoPreview(f._icon_data_b64);
      App.Screenshots.setIconThumb(f._icon_data_b64);
    } else if (f.icon_txid && f.icon_txid !== '(pending)' && App.Utils.isValidTxid(f.icon_txid)) {
      if (App.Icon.fetchFromBlockchain) {
        $('icon-txid').value = f.icon_txid;
        App.Icon.fetchFromBlockchain();
      }
    } else {
      var prev = $('icon-preview');
      prev.innerHTML = '<div class="bg-layer" id="preview-bg"></div><span class="no-img">NO IMAGE</span>';
    }

    // --- Restore screenshots from embedded data or on-chain txids ---
    if (App.Screenshots) {
      // Clear existing screenshots first
      for (var si = 1; si <= 4; si++) {
        App.Screenshots._slots[si] = null;
        App.Screenshots._updateStripThumb(si);
      }
      for (var sj = 1; sj <= 4; sj++) {
        var ssTxid = f['ss' + sj + '_txid'];
        var ssEmbedded = f['_ss' + sj + '_data_b64'];
        var ssZoom = f['ss' + sj + '_zoom'] || '1';
        var ssAlt  = f['ss' + sj + '_alt_text'] || '';

        /* parseFloat with || '0' so OP_0 decoded as '' maps to 0, not a false diff */
        var ssPanX = parseFloat(f['ss' + sj + '_pan_x'] || '0') || 0;
        var ssPanY = parseFloat(f['ss' + sj + '_pan_y'] || '0') || 0;
        if (ssEmbedded) {
          // Offline file with embedded B64 data
          App.Screenshots._slots[sj] = {
            dataB64: ssEmbedded,
            filename: 'ss' + sj,
            kb: f['ss' + sj + '_size_kb'] || '?',
            mime: f['ss' + sj + '_format'] || 'image/png',
            zoom: ssZoom, panX: ssPanX, panY: ssPanY, altText: ssAlt
          };
          App.Screenshots._updateStripThumb(sj);
        } else if (ssTxid && ssTxid !== '(pending)') {
          // On-chain record — restore metadata and try to fetch from CDN
          var ssSlot = {
            dataB64: null,
            filename: 'ss' + sj,
            kb: f['ss' + sj + '_size_kb'] || '?',
            mime: f['ss' + sj + '_format'] || 'image/png',
            txid: ssTxid,
            zoom: ssZoom, panX: ssPanX, panY: ssPanY, altText: ssAlt
          };
          App.Screenshots._slots[sj] = ssSlot;
          App.Screenshots._updateStripThumb(sj);
          // Try to fetch screenshot image from chain CDN
          (function(idx, txid, slot) {
            if (App.Config && App.Config.getAllCdnUrls) {
              var urls = App.Config.getAllCdnUrls(txid);
              var attempt = 0;
              function tryNext() {
                if (attempt >= urls.length) return;
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                  var canvas = document.createElement('canvas');
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  canvas.getContext('2d').drawImage(img, 0, 0);
                  try {
                    slot.dataB64 = canvas.toDataURL(slot.mime);
                    App.Screenshots._updateStripThumb(idx);
                    if (App.Screenshots._updateSlotStates) App.Screenshots._updateSlotStates();
                  } catch(e) { /* CORS blocked — thumbnail stays empty */ }
                };
                img.onerror = function() { attempt++; tryNext(); };
                img.src = urls[attempt];
              }
              tryNext();
            }
          })(sj, ssTxid, ssSlot);
        }
      }
      // Update slot disabled states after restoring
      if (App.Screenshots._updateSlotStates) App.Screenshots._updateSlotStates();
    }

    App.Icon.updatePreviewStyles();
    App.LabelAlign.align();
  },

  // Open file picker, read .txt, parse, populate form.
  load: function() {
    var self = this;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';

    input.addEventListener('change', function() {
      var file = input.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        var fields = self._parse(text);

        if (fields.protocol !== SETTINGS.PROTOCOL_PREFIX) {
          App.StatusBar.set('INVALID FILE \u2014 NOT AN UP-LINK MAP RECORD', 'err');
          return;
        }

        self._populateForm(fields);
        App.StatusBar.set('MAP RECORD LOADED // ' + file.name, 'ok');
      };
      reader.readAsText(file);
    });

    input.click();
  },

  init: function() {},
};


// ─────────────────────────────────────────────────────────────────────
//  App._offlineScanLocal — File-picker-based local record loader
// ─────────────────────────────────────────────────────────────────────
//
//  Presents a multi-file picker so the user can select one or more
//  previously saved MAP .txt files.  Uses FileReader (not fetch), so
//  it works correctly under the file:// protocol with no server needed.
//
//  Previous implementation used fetch() on hardcoded filenames, which
//  is blocked by browsers under file:// (CORS / same-origin policy).
//  FileReader is exempt from that restriction because the user explicitly
//  grants access to the files via the OS picker dialog.
//
//  Called by App.RecordPicker._scanWallet() in the HTML.
//  Returns a Promise that resolves with an array of parsed record objects,
//  each matching the shape produced by App.MAPImport._parse().
//
//  ── SERVER UPGRADE NOTE ─────────────────────────────────────────────
//  When served from HTTP, this approach still works perfectly — the
//  file picker is always valid.  If you later want auto-discovery
//  (scan a directory for all .txt files without a manual picker), that
//  requires a small server endpoint and should replace this function.
//  ─────────────────────────────────────────────────────────────────────

App._offlineScanLocal = function() {
  return new Promise(function(resolve) {

    // Build a hidden multi-file input restricted to .txt files.
    var input = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.txt,text/plain';
    input.multiple = true;

    // If the user cancels the picker without selecting anything,
    // resolve with an empty array rather than hanging forever.
    input.addEventListener('cancel', function() { resolve([]); });

    input.addEventListener('change', function() {
      var files = Array.prototype.slice.call(input.files);
      if (!files.length) { resolve([]); return; }

      var records  = [];
      var pending  = files.length;

      files.forEach(function(file) {
        var reader = new FileReader();

        reader.onload = function(e) {
          try {
            var fields = App.MAPImport._parse(e.target.result);
            // Silently skip files that aren't BSV Directory MAP records.
            if (fields.protocol === SETTINGS.PROTOCOL_PREFIX) {
              fields._source_file = file.name;
              records.push(fields);
            }
          } catch (err) {
            // Malformed file — skip gracefully, never block the rest.
            console.warn('_offlineScanLocal: skipping unreadable file:', file.name, err);
          }
          // Resolve only once every FileReader has finished.
          if (--pending === 0) resolve(records);
        };

        reader.onerror = function() {
          console.warn('_offlineScanLocal: FileReader error on:', file.name);
          if (--pending === 0) resolve(records);
        };

        reader.readAsText(file);
      });
    });

    // Trigger the OS file-picker dialog.
    input.click();
  });
};


// ─────────────────────────────────────────────────────────────────────
//  Register capability
// ─────────────────────────────────────────────────────────────────────
App.Capabilities.offline = true;
