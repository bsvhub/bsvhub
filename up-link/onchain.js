/* ═══════════════════════════════════════════════════════════════════════
   onchain.js — BRC-100 On-Chain Integration for BSV Directory Portal
   ═══════════════════════════════════════════════════════════════════════

   Contains all BRC-100 wallet communication and on-chain transaction
   logic. This file is OPTIONAL. If missing, the portal runs in
   offline-only mode. If present, it registers App.Capabilities.onchain
   = true and enables real wallet connection and blockchain broadcasts.

   Architecture:
     BSVScript         — MAP + B:// OP_RETURN script construction
     BRC100Provider    — fetch() to localhost:2121 (desktop wallet)
     WalletManager     — detection, connection, unified API surface

   Requires: App object with App.Capabilities to exist (defined in
   HTML before this loads).

   NO npm dependencies — plain ES5-compatible JS for static HTML.
   ═══════════════════════════════════════════════════════════════════════ */


// ─────────────────────────────────────────────────────────────────────
//  BSVScript — OP_RETURN script construction helpers
// ─────────────────────────────────────────────────────────────────────

var BSVScript = {

  MAP_PREFIX: '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5',
  B_PREFIX: '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut',

  _utf8Encode: function(str) {
    return new TextEncoder().encode(str);
  },

  _bytesToHex: function(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return hex;
  },

  _pushData: function(bytes) {
    var len = bytes.length;
    var prefix;
    if (len === 0) {
      return '00';
    } else if (len >= 1 && len <= 75) {
      prefix = ('0' + len.toString(16)).slice(-2);
    } else if (len >= 76 && len <= 255) {
      prefix = '4c' + ('0' + len.toString(16)).slice(-2);
    } else if (len >= 256 && len <= 65535) {
      var lo = len & 0xff;
      var hi = (len >> 8) & 0xff;
      prefix = '4d' + ('0' + lo.toString(16)).slice(-2) + ('0' + hi.toString(16)).slice(-2);
    } else {
      throw new Error('Push data too large: ' + len + ' bytes');
    }
    return prefix + this._bytesToHex(bytes);
  },

  _pushString: function(str) {
    var bytes = this._utf8Encode(str);
    return this._pushData(bytes);
  },

  buildMAPScript: function(fields) {
    var hex = '006a';
    hex += this._pushString(this.MAP_PREFIX);
    hex += this._pushString('SET');
    for (var i = 0; i < fields.length; i++) {
      hex += this._pushString(fields[i][0]);
      hex += this._pushString(fields[i][1]);
    }
    return hex;
  },

  buildBProtocolScript: function(fileBytes, mimeType, filename) {
    var hex = '006a';
    hex += this._pushString(this.B_PREFIX);
    hex += this._pushData(fileBytes);
    hex += this._pushString(mimeType);
    hex += this._pushString('binary');
    if (filename) {
      hex += this._pushString(filename);
    }
    return hex;
  },

  decodeScript: function(hex) {
    var parts = [];
    var pos = 0;

    function readByte() {
      var b = parseInt(hex.substr(pos, 2), 16);
      pos += 2;
      return b;
    }

    function readBytes(n) {
      var bytes = new Uint8Array(n);
      for (var i = 0; i < n; i++) bytes[i] = readByte();
      return bytes;
    }

    while (pos < hex.length) {
      var op = readByte();

      if (op === 0x00) {
        parts.push('OP_0');
      } else if (op === 0x6a) {
        parts.push('OP_RETURN');
      } else if (op >= 0x01 && op <= 0x4b) {
        var data = readBytes(op);
        try { parts.push(new TextDecoder().decode(data)); }
        catch (e) { parts.push('[' + BSVScript._bytesToHex(data) + ']'); }
      } else if (op === 0x4c) {
        var len1 = readByte();
        var data1 = readBytes(len1);
        try { parts.push(new TextDecoder().decode(data1)); }
        catch (e) { parts.push('[' + BSVScript._bytesToHex(data1) + ']'); }
      } else if (op === 0x4d) {
        var lo = readByte();
        var hi = readByte();
        var len2 = lo | (hi << 8);
        var data2 = readBytes(len2);
        try { parts.push(new TextDecoder().decode(data2)); }
        catch (e) { parts.push('[' + BSVScript._bytesToHex(data2) + ']'); }
      } else {
        parts.push('OP_' + op.toString(16));
      }
    }
    return parts;
  },
};


// ─────────────────────────────────────────────────────────────────────
//  BRC100Provider — Communication with the BRC-100 desktop wallet
// ─────────────────────────────────────────────────────────────────────

var BRC100Provider = {

  BASE_URL: 'http://localhost:3321',

  _fetch: function(endpoint, options) {
    var url = this.BASE_URL + endpoint;
    options = options || {};
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'string') {
      options.headers['Content-Type'] = 'application/json';
    }

    return fetch(url, options)
      .then(function(resp) {
        if (!resp.ok) {
          return resp.text().then(function(txt) {
            var msg;
            try { msg = JSON.parse(txt).message || txt; } catch (e) { msg = txt; }
            throw new Error('BRC-100 error (' + resp.status + '): ' + msg);
          });
        }
        return resp.json();
      })
      .catch(function(err) {
        if (err.name === 'TypeError' && err.message.indexOf('fetch') !== -1) {
          throw new Error('WALLET_NOT_RUNNING');
        }
        throw err;
      });
  },

  isAuthenticated: function() { return this._fetch('/isAuthenticated'); },
  waitForAuthentication: function() { return this._fetch('/waitForAuthentication'); },
  getNetwork: function() { return this._fetch('/getNetwork'); },
  getVersion: function() { return this._fetch('/getVersion'); },
  getHeight: function() { return this._fetch('/getHeight'); },

  getPublicKey: function(opts) {
    opts = opts || { identityKey: true };
    return this._fetch('/getPublicKey', { method: 'POST', body: JSON.stringify(opts) });
  },

  createSignature: function(params) {
    return this._fetch('/createSignature', { method: 'POST', body: JSON.stringify(params) });
  },

  verifySignature: function(params) {
    return this._fetch('/verifySignature', { method: 'POST', body: JSON.stringify(params) });
  },

  createAction: function(params) {
    return this._fetch('/createAction', { method: 'POST', body: JSON.stringify(params) });
  },

  signAction: function(params) {
    return this._fetch('/signAction', { method: 'POST', body: JSON.stringify(params) });
  },

  abortAction: function(params) {
    return this._fetch('/abortAction', { method: 'POST', body: JSON.stringify(params) });
  },

  listActions: function(params) {
    return this._fetch('/listActions', { method: 'POST', body: JSON.stringify(params) });
  },

  listOutputs: function(params) {
    return this._fetch('/listOutputs', { method: 'POST', body: JSON.stringify(params) });
  },

  discoverByIdentityKey: function(params) {
    return this._fetch('/discoverByIdentityKey', { method: 'POST', body: JSON.stringify(params) });
  },

  discoverByAttributes: function(params) {
    return this._fetch('/discoverByAttributes', { method: 'POST', body: JSON.stringify(params) });
  },
};


// ─────────────────────────────────────────────────────────────────────
//  WalletManager — Unified API surface for the submit page
// ─────────────────────────────────────────────────────────────────────

var WalletManager = {

  connected: false,
  identityKey: null,
  paymail: null,
  network: null,
  walletVersion: null,
  walletAvailable: false,

  detect: function() {
    var self = this;
    return BRC100Provider.isAuthenticated()
      .then(function() { self.walletAvailable = true; return true; })
      .catch(function() { self.walletAvailable = false; return false; });
  },

  connect: function() {
    var self = this;

    return BRC100Provider.isAuthenticated()
      .then(function(res) {
        self.walletAvailable = true;
        if (!res.authenticated) {
          return BRC100Provider.waitForAuthentication();
        }
        return res;
      })
      .then(function() {
        return BRC100Provider.getPublicKey({ identityKey: true });
      })
      .then(function(res) {
        self.identityKey = res.publicKey;
        return Promise.all([
          BRC100Provider.getNetwork().catch(function() { return { network: 'unknown' }; }),
          self._discoverPaymail(res.publicKey),
        ]);
      })
      .then(function(results) {
        self.network = results[0].network;
        self.paymail = results[1];
        self.connected = true;
        return {
          identityKey: self.identityKey,
          paymail: self.paymail,
          network: self.network,
        };
      })
      .catch(function(err) {
        self.connected = false;
        self.identityKey = null;
        self.paymail = null;
        throw err;
      });
  },

  disconnect: function() {
    this.connected = false;
    this.identityKey = null;
    this.paymail = null;
    this.network = null;
  },

  _discoverPaymail: function(identityKey) {
    return BRC100Provider.discoverByIdentityKey({ identityKey: identityKey })
      .then(function(res) {
        if (res && res.certificates && res.certificates.length > 0) {
          for (var i = 0; i < res.certificates.length; i++) {
            var cert = res.certificates[i];
            if (cert.decryptedFields) {
              var pm = cert.decryptedFields.paymail
                || cert.decryptedFields.email
                || cert.decryptedFields.userName;
              if (pm) return pm;
            }
          }
        }
        return null;
      })
      .catch(function() { return null; });
  },

  uploadIcon: function(fileBytes, mimeType, filename) {
    var script = BSVScript.buildBProtocolScript(fileBytes, mimeType, filename);
    return BRC100Provider.createAction({
      description: 'Upload icon to BSV chain',
      outputs: [{ lockingScript: script, satoshis: 0, outputDescription: 'Icon file via B protocol' }],
      labels: ['up-link', 'icon'],
    }).then(function(res) { return { txid: res.txid }; });
  },

  submitRecord: function(fields, tipSatoshis, tipAddress) {
    var script = BSVScript.buildMAPScript(fields);
    var outputs = [{ lockingScript: script, satoshis: 0, outputDescription: 'MAP app listing record' }];
    if (tipSatoshis && tipSatoshis > 0 && tipAddress) {
      outputs.push({
        lockingScript: this._buildP2PKHScript(tipAddress),
        satoshis: tipSatoshis,
        outputDescription: 'Directory listing tip',
      });
    }
    return BRC100Provider.createAction({
      description: 'Submit app to Up-LINK',
      outputs: outputs,
      labels: ['up-link'],
    }).then(function(res) { return { txid: res.txid }; });
  },

  updateRecord: function(fields, tipSatoshis, tipAddress) {
    var script = BSVScript.buildMAPScript(fields);
    var outputs = [{ lockingScript: script, satoshis: 0, outputDescription: 'MAP app update record' }];
    if (tipSatoshis && tipSatoshis > 0 && tipAddress) {
      outputs.push({
        lockingScript: this._buildP2PKHScript(tipAddress),
        satoshis: tipSatoshis,
        outputDescription: 'Directory listing tip',
      });
    }
    return BRC100Provider.createAction({
      description: 'Update app on Up-LINK',
      outputs: outputs,
      labels: ['up-link', 'update'],
    }).then(function(res) { return { txid: res.txid }; });
  },

  WOC_API: 'https://api.whatsonchain.com/v1/bsv/main',

  scanRecords: function() {
    var self = this;
    return BRC100Provider.listActions({
      labels: ['up-link'],
      labelQueryMode: 'any',
      limit: 100,
      offset: 0,
    }).then(function(res) {
      if (!res || !res.actions || res.actions.length === 0) return [];
      var mapActions = res.actions.filter(function(a) {
        return a.description && a.description.indexOf('icon') === -1;
      });
      var fetchPromises = mapActions.map(function(action) {
        return self._fetchAndParseRecord(action.txid).catch(function() {
          return {
            txid: action.txid,
            fields: { _txid: action.txid, _description: action.description || '', protocol: 'up-link' },
          };
        });
      });
      return Promise.all(fetchPromises);
    });
  },

  _fetchAndParseRecord: function(txid) {
    var self = this;
    return fetch(this.WOC_API + '/tx/' + txid)
      .then(function(resp) {
        if (!resp.ok) throw new Error('WoC HTTP ' + resp.status);
        return resp.json();
      })
      .then(function(tx) {
        var fields = { _txid: txid };
        if (tx.vout) {
          for (var i = 0; i < tx.vout.length; i++) {
            var script = tx.vout[i].scriptPubKey;
            if (!script || !script.hex) continue;
            var decoded = BSVScript.decodeScript(script.hex);
            var mapFields = self._extractMAPFields(decoded);
            if (mapFields) {
              for (var key in mapFields) { fields[key] = mapFields[key]; }
              break;
            }
          }
        }
        return { txid: txid, fields: fields };
      });
  },

  _extractMAPFields: function(parts) {
    var mapIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === BSVScript.MAP_PREFIX) { mapIdx = i; break; }
    }
    if (mapIdx === -1) return null;
    if (parts[mapIdx + 1] !== 'SET') return null;
    var fields = {};
    for (var j = mapIdx + 2; j + 1 < parts.length; j += 2) {
      var key = parts[j];
      var val = parts[j + 1];
      if (key === 'OP_0') continue;
      if (val === 'OP_0') val = '';
      fields[key] = val;
    }
    return fields;
  },

  _buildP2PKHScript: function(address) {
    var decoded = this._base58Decode(address);
    if (!decoded || decoded.length !== 25) {
      throw new Error('Invalid BSV address: ' + address);
    }
    var pubkeyHash = '';
    for (var i = 1; i < 21; i++) {
      pubkeyHash += ('0' + decoded[i].toString(16)).slice(-2);
    }
    return '76a914' + pubkeyHash + '88ac';
  },

  _base58Decode: function(str) {
    var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var BASE = 58;
    var bytes = [0];
    for (var i = 0; i < str.length; i++) {
      var charIdx = ALPHABET.indexOf(str[i]);
      if (charIdx === -1) return null;
      var carry = charIdx;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * BASE;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (var k = 0; k < str.length && str[k] === '1'; k++) { bytes.push(0); }
    bytes.reverse();
    return new Uint8Array(bytes);
  },

  submitFull: function(data, fields, tipAddress, onStatus) {
    var self = this;
    var iconTxid = null;
    var ssTxids = [null, null, null, null];
    onStatus = onStatus || function() {};

    // --- Step 1: Upload icon if needed ---
    var iconPromise;
    if (data.icon_source === 'upload' && data.icon_data_b64) {
      onStatus('UPLOADING ICON TO CHAIN...');
      var fileBytes = this._base64ToBytes(data.icon_data_b64);
      iconPromise = this.uploadIcon(fileBytes, data.icon_format, data.icon_filename)
        .then(function(res) {
          iconTxid = res.txid;
          onStatus('ICON UPLOADED // TXID: ' + res.txid.substring(0, 12) + '...');
          for (var i = 0; i < fields.length; i++) {
            if (fields[i][0] === 'icon_txid') { fields[i][1] = iconTxid; break; }
          }
          return res;
        });
    } else {
      iconPromise = Promise.resolve(null);
    }

    // --- Step 2: Upload screenshots sequentially (ss1-ss4) ---
    // Skip screenshots that already have a valid txid (loaded via on-chain fetch).
    var ssPromise = iconPromise.then(function() {
      var screenshots = data.screenshots || [null, null, null, null];
      var chain = Promise.resolve();
      for (var si = 0; si < 4; si++) {
        (function(idx) {
          var slot = screenshots[idx];
          if (!slot) return;
          var n = idx + 1;
          var existingTxid = data['ss' + n + '_txid'];
          // If the slot already has a valid 64-char txid, skip upload
          if (existingTxid && existingTxid !== '(pending)' && /^[0-9a-fA-F]{64}$/.test(existingTxid)) {
            ssTxids[idx] = existingTxid;
            return;
          }
          if (slot.dataB64) {
            chain = chain.then(function() {
              onStatus('UPLOADING SCREENSHOT ' + n + ' TO CHAIN...');
              var ssBytes = self._base64ToBytes(slot.dataB64);
              var ssMime = slot.mime || 'image/png';
              var ssFilename = slot.filename || ('ss' + n);
              return self.uploadIcon(ssBytes, ssMime, ssFilename).then(function(res) {
                ssTxids[idx] = res.txid;
                onStatus('SS' + n + ' UPLOADED // TXID: ' + res.txid.substring(0, 12) + '...');
                // Write txid into MAP fields
                for (var fi = 0; fi < fields.length; fi++) {
                  if (fields[fi][0] === 'ss' + n + '_txid') { fields[fi][1] = res.txid; break; }
                }
              });
            });
          }
        })(si);
      }
      return chain;
    });

    // --- Step 3: Broadcast MAP record ---
    return ssPromise.then(function() {
      onStatus('CONSTRUCTING MAP TRANSACTION...');
      var tipSats = data.tip_bsv ? Math.round(data.tip_bsv * 1e8) : 0;
      var isUpdate = data._isUpdate || false;
      if (isUpdate) {
        return self.updateRecord(fields, tipSats, tipAddress);
      } else {
        return self.submitRecord(fields, tipSats, tipAddress);
      }
    }).then(function(res) {
      onStatus('BROADCAST SUCCESS // APP_ID: ' + res.txid);
      return { appTxid: res.txid, iconTxid: iconTxid, ssTxids: ssTxids };
    });
  },

  _base64ToBytes: function(b64) {
    var raw = b64;
    var commaIdx = b64.indexOf(',');
    if (commaIdx !== -1) { raw = b64.substring(commaIdx + 1); }
    var binary = atob(raw);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
    return bytes;
  },

  FEE_RATE_SATS_PER_KB: 100,

  estimateFee: function(scriptHexArray) {
    var overhead = 10;
    var inputBytes = 148;
    var changeOutput = 34;
    var outputBytes = 0;
    for (var i = 0; i < scriptHexArray.length; i++) {
      var scriptBytes = scriptHexArray[i].length / 2;
      outputBytes += 8 + this._varintSize(scriptBytes) + scriptBytes;
    }
    outputBytes += changeOutput;
    var txBytes = overhead + inputBytes + outputBytes;
    var feeSats = Math.max(1, Math.ceil(txBytes * this.FEE_RATE_SATS_PER_KB / 1000));
    return { feeSats: feeSats, txBytes: txBytes };
  },

  _varintSize: function(n) {
    if (n < 0xfd) return 1;
    if (n <= 0xffff) return 3;
    if (n <= 0xffffffff) return 5;
    return 9;
  },

  estimateSubmitFee: function(fields, iconBytes, tipSats, ssSlots) {
    tipSats = tipSats || 0;
    var mapScript = BSVScript.buildMAPScript(fields);
    var mapOutputs = [mapScript];
    if (tipSats > 0) {
      mapOutputs.push('76a914' + '00'.repeat(20) + '88ac');
    }
    var mapEst = this.estimateFee(mapOutputs);
    var iconEst = { feeSats: 0, txBytes: 0 };
    if (iconBytes && iconBytes.length > 0) {
      var iconScript = BSVScript.buildBProtocolScript(iconBytes, 'image/png', 'icon');
      iconEst = this.estimateFee([iconScript]);
    }
    // Estimate screenshot upload fees
    var ssFeeSats = 0;
    var ssTotalBytes = 0;
    if (ssSlots) {
      for (var i = 0; i < ssSlots.length; i++) {
        if (ssSlots[i] && ssSlots[i].dataB64) {
          var ssBytes = this._base64ToBytes(ssSlots[i].dataB64);
          var ssScript = BSVScript.buildBProtocolScript(ssBytes, ssSlots[i].mime || 'image/png', 'ss' + (i+1));
          var ssEst = this.estimateFee([ssScript]);
          ssFeeSats += ssEst.feeSats;
          ssTotalBytes += ssEst.txBytes;
        }
      }
    }
    var totalFeeSats = mapEst.feeSats + iconEst.feeSats + ssFeeSats + tipSats;
    return {
      mapFeeSats: mapEst.feeSats,
      iconFeeSats: iconEst.feeSats + ssFeeSats,
      tipSats: tipSats,
      totalFeeSats: totalFeeSats,
      totalBytes: mapEst.txBytes + iconEst.txBytes + ssTotalBytes,
    };
  },

  getDisplayName: function() {
    if (this.paymail) return this.paymail;
    if (this.identityKey) {
      return this.identityKey.substring(0, 8) + '...' + this.identityKey.substring(58);
    }
    return 'UNKNOWN';
  },

  getDisplayNameUpper: function() {
    return this.getDisplayName().toUpperCase();
  },
};

// Attach to window
window.BSVScript = BSVScript;
window.BRC100Provider = BRC100Provider;
window.WalletManager = WalletManager;


// ─────────────────────────────────────────────────────────────────────
//  App extensions — on-chain save and record scanning
//
//  These extend App objects defined in the HTML or offline.js.
//  If App.MAPExport doesn't exist yet (offline.js not loaded),
//  create a minimal version with just _buildMAPFields.
// ─────────────────────────────────────────────────────────────────────

// Ensure App.MAPExport exists with at least _buildMAPFields
if (!App.MAPExport) {
  App.MAPExport = {
    _buildMAPFields: function(d) {
      var fields = [
        ['protocol',          d.protocol],
        ['protocol_version',  d.protocol_version],
        ['name',              d.name || ''],
        ['abbreviation',      d.abbreviation || ''],
        ['url',               d.url || ''],
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
      d.features.forEach(function(f, i) {
        if (f) fields.push(['feature_' + (i + 1), f]);
      });
      fields.push(
        ['icon_txid',         d.icon_txid || '(pending)'],
        ['icon_format',       d.icon_format || ''],
        ['icon_size_kb',      String(d.icon_size_kb || '')],
        ['icon_bg_enabled',   String(d.icon_bg_enabled)],
        ['icon_fg_enabled',   String(d.icon_fg_enabled)],
        ['icon_bg_colour',    (d.icon_bg_enabled && d.icon_bg_colour && d.icon_bg_colour.toLowerCase() !== '#1a1440') ? d.icon_bg_colour : ''],
        ['icon_fg_colour',    (d.icon_fg_enabled && d.icon_fg_colour && d.icon_fg_colour.toLowerCase() !== '#eab300') ? d.icon_fg_colour : ''],
        ['icon_bg_alpha',     String(d.icon_bg_alpha)],
        ['icon_zoom',         String(d.icon_zoom)],
        ['alt_text',          d.alt_text || ''],
        ['developer_paymail', d.developer_paymail || ''],
        ['developer_twitter', d.developer_twitter || ''],
        ['developer_github',  d.developer_github || ''],
        ['developer_bio',     d.developer_bio || ''],
      );

      // Screenshots — ss1 through ss4 txids and metadata
      var ss = d.screenshots || [null, null, null, null];
      for (var si = 0; si < 4; si++) {
        var n = si + 1;
        var slot = ss[si];
        if (slot || d['ss' + n + '_txid']) {
          fields.push(['ss' + n + '_txid',    d['ss' + n + '_txid'] || '(pending)']);
          fields.push(['ss' + n + '_format',  (slot && slot.mime) || d['ss' + n + '_format'] || '']);
          fields.push(['ss' + n + '_size_kb', (slot && String(slot.kb)) || d['ss' + n + '_size_kb'] || '']);
          fields.push(['ss' + n + '_zoom',    d['ss' + n + '_zoom'] || '1']);
        }
      }

      return fields;
    },
    init: function() {},
  };
}

// Add saveOnChain method to MAPExport
App.MAPExport.saveOnChain = function(statusCallback) {
  try {
    var d = App.Form.collectData();
    d._isUpdate = (App.State.mode === 'update');
    var fields = App.MAPExport._buildMAPFields(d);
  } catch (e) {
    App.StatusBar.set('DATA ERROR: ' + (e.message || 'UNKNOWN'), 'err');
    return Promise.reject(e);
  }

  var tipAddr = (typeof SETTINGS !== 'undefined' && SETTINGS.TIP_ADDRESS) ? SETTINGS.TIP_ADDRESS : null;
  return WalletManager.submitFull(d, fields, tipAddr, statusCallback)
    .then(function(result) {
      App.StatusBar.set('BROADCAST SUCCESS // TXID: ' + result.appTxid, 'ok');
      return result.appTxid;
    });
};

// On-chain wallet scan for RecordPicker
App._onchainScanRecords = async function() {
  var results = await WalletManager.scanRecords();
  var records = [];
  for (var i = 0; i < results.length; i++) {
    var rec = results[i];
    if (rec.fields && rec.fields.protocol === SETTINGS.PROTOCOL_PREFIX) {
      records.push(rec.fields);
    }
  }
  return records;
};


// ─────────────────────────────────────────────────────────────────────
//  Register capability
// ─────────────────────────────────────────────────────────────────────
App.Capabilities.onchain = true;
