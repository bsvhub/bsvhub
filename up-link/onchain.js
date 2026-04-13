/* ═══════════════════════════════════════════════════════════════════════
   onchain.js — BRC-100 On-Chain Integration for BSV Directory Portal (v7.6)
   ═══════════════════════════════════════════════════════════════════════

   Contains all BRC-100 wallet communication and on-chain transaction
   logic. This file is OPTIONAL. If missing, the portal runs in
   offline-only mode. If present, it registers App.Capabilities.onchain
   = true and enables real wallet connection and blockchain broadcasts.

   Architecture:
     BSVScript         — MAP + B:// OP_RETURN script construction
     BRC100Provider    — fetch() to localhost:3321 (desktop wallet)
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
    } else if (len >= 65536 && len <= 0xffffffff) {
      var b0 = len & 0xff;
      var b1 = (len >> 8) & 0xff;
      var b2 = (len >> 16) & 0xff;
      var b3 = (len >>> 24) & 0xff;
      prefix = '4e'
        + ('0' + b0.toString(16)).slice(-2)
        + ('0' + b1.toString(16)).slice(-2)
        + ('0' + b2.toString(16)).slice(-2)
        + ('0' + b3.toString(16)).slice(-2);
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

  /* RIPEMD-160 — compact pure-JS implementation, no external deps.
     Used exclusively by _hash160() below. Based on the reference
     algorithm by Antoon Bosselaers / RIPEMD team. */
  _ripemd160: function(msg) {
    function rotl(x, n) { return (x << n) | (x >>> (32 - n)); }
    function f(j, x, y, z) {
      if (j < 16) return x ^ y ^ z;
      if (j < 32) return (x & y) | (~x & z);
      if (j < 48) return (x | ~y) ^ z;
      if (j < 64) return (x & z) | (y & ~z);
      return x ^ (y | ~z);
    }
    var K  = [0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E];
    var KK = [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000];
    var r  = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
    var rr = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
    var s  = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
    var ss = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
    /* pad message */
    var l = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (var i = 0; i < 8; i++) msg.push((l >>> (i * 8)) & 0xff);
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    for (var o = 0; o < msg.length; o += 64) {
      var X = [];
      for (var xi = 0; xi < 16; xi++) {
        X[xi] = msg[o+xi*4] | (msg[o+xi*4+1]<<8) | (msg[o+xi*4+2]<<16) | (msg[o+xi*4+3]<<24);
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4;
      var aa = h0, bb = h1, cc = h2, dd = h3, ee = h4;
      for (var j = 0; j < 80; j++) {
        var T = (a + f(j,b,c,d) + X[r[j]] + K[Math.floor(j/16)])|0;
        T = (rotl(T, s[j]) + e)|0; a=e; e=d; d=rotl(c,10); c=b; b=T;
        T = (aa + f(79-j,bb,cc,dd) + X[rr[j]] + KK[Math.floor(j/16)])|0;
        T = (rotl(T, ss[j]) + ee)|0; aa=ee; ee=dd; dd=rotl(cc,10); cc=bb; bb=T;
      }
      var T2 = (h1+c+dd)|0; h1=(h2+d+ee)|0; h2=(h3+e+aa)|0; h3=(h4+a+bb)|0; h4=(h0+b+cc)|0; h0=T2;
    }
    function le(x) { return [(x)&0xff,(x>>>8)&0xff,(x>>>16)&0xff,(x>>>24)&0xff]; }
    return le(h0).concat(le(h1),le(h2),le(h3),le(h4));
  },

  /* HASH160 — SHA256 then RIPEMD160 of a hex-encoded public key.
     Returns a Promise that resolves to a 40-char hex string (20 bytes).
     Uses SubtleCrypto (native browser API) for SHA256. */
  _hash160: function(pubKeyHex) {
    var self = this;
    var bytes = [];
    for (var i = 0; i < pubKeyHex.length; i += 2) {
      bytes.push(parseInt(pubKeyHex.substr(i, 2), 16));
    }
    return crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
      .then(function(sha256) {
        var ripe = self._ripemd160(Array.from(new Uint8Array(sha256)));
        return ripe.map(function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
  },

  /* 1Sat Ordinal inscription with P2PKH ownership.
     Standard format: OP_FALSE OP_IF "ord" OP_1 <mime> OP_0 <data> OP_ENDIF
     followed by P2PKH (76a914 <pkh> 88ac).

     The envelope comes first, P2PKH after — this is the standard 1Sat
     Ordinals pattern. The wallet recognises the P2PKH suffix as spendable
     and places the output at vout 0. */
  buildOrdinalInscriptionScript: function(fileBytes, mimeType, pubKeyHash) {
    var pkh = (typeof pubKeyHash === 'string' && pubKeyHash.length === 40)
      ? pubKeyHash : '00'.repeat(20);
    var hex = '';
    hex += '00';  /* OP_FALSE */
    hex += '63';  /* OP_IF */
    hex += this._pushString('ord');
    hex += '51';  /* OP_1 */
    hex += this._pushString(mimeType || 'application/octet-stream');
    hex += '00';  /* OP_0 — content separator */
    hex += this._pushData(fileBytes);
    hex += '68';  /* OP_ENDIF */
    hex += '76a914' + pkh + '88ac';  /* P2PKH — makes output spendable + owned */
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
    /* Ord inscription so content is indexed by 1sat CDNs
       (gorillapool, ordfs, 1satordinals). filename is unused by the
       inscription format — kept in the signature for call-site compatibility.

       Key derivation: we request a per-upload key from the wallet using a
       unique keyID (timestamp). This is BRC-100 compliant — any conforming
       wallet can derive the matching private key later using the same
       protocolID + keyID pair. Falls back to zero hash if getPublicKey fails
       (inscription still lands on chain, just unspendable). */
    var _unused = filename;
    var keyID = 'up-link-icon-' + Date.now();
    return BRC100Provider.getPublicKey({
      protocolID: [0, 'up-link'],
      keyID: keyID,
      counterparty: 'self',
      forSelf: true,
    })
    .then(function(res) {
      return BSVScript._hash160(res.publicKey);
    })
    .catch(function() {
      /* If wallet doesn't support key derivation, fall back to zero hash.
         Content still reaches chain and CDNs index it. */
      return '00'.repeat(20);
    })
    .then(function(pubKeyHash) {
      var script = BSVScript.buildOrdinalInscriptionScript(fileBytes, mimeType, pubKeyHash);
      return BRC100Provider.createAction({
        description: 'Upload image to BSV chain',
        outputs: [{ lockingScript: script, satoshis: 1, outputDescription: '1Sat Ordinal inscription', basket: 'up-link-inscriptions' }],
        labels: ['up-link', 'icon'],
      });
    })
    .then(function(res) {
      /* Query the wallet for the real vout of the inscription output.
         listOutputs returns the actual outpoint (txid + vout) so we
         don't have to guess which suffix the wallet assigned. */
      console.log('[uploadIcon] createAction returned:', JSON.stringify(res));
      return BRC100Provider.listOutputs({
        basket: 'up-link-inscriptions',
        include: 'locking scripts',
      }).then(function(list) {
        console.log('[uploadIcon] listOutputs returned:', JSON.stringify(list));
        /* listOutputs may return { outputs: [...] } or a flat array */
        var outputs = Array.isArray(list) ? list : (list && list.outputs ? list.outputs : []);
        /* Find the most recent output matching this txid.
           Outpoint format from BRC-100 wallet is "txid.vout" (dot separator).
           Scan backwards — newest output is most likely the one we just created. */
        var match = null;
        for (var i = outputs.length - 1; i >= 0; i--) {
          var o = outputs[i];
          var op = o.outpoint || '';
          var dotIdx = op.lastIndexOf('.');
          var oTxid = dotIdx !== -1 ? op.substring(0, dotIdx) : (o.txid || '');
          if (oTxid === res.txid) { match = o; break; }
        }
        console.log('[uploadIcon] matched output:', match ? JSON.stringify(match) : 'none');
        if (match && match.outpoint) {
          var dotPos = match.outpoint.lastIndexOf('.');
          if (dotPos !== -1) {
            var vout = match.outpoint.substring(dotPos + 1);
            return { txid: res.txid + '_' + vout };
          }
        }
        /* Fallback: use bare txid — parseTxid will append _0 */
        return { txid: res.txid };
      }).catch(function(err) {
        console.warn('[uploadIcon] listOutputs failed:', err);
        return { txid: res.txid };
      });
    });
  },

  submitRecord: function(fields, tipSatoshis, tipAddress) {
    var script = BSVScript.buildMAPScript(fields);
    var outputs = [{ lockingScript: script, satoshis: 1, outputDescription: 'MAP app listing record' }];
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
    var outputs = [{ lockingScript: script, satoshis: 1, outputDescription: 'MAP app update record' }];
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

  WOC_API_MAIN: 'https://api.whatsonchain.com/v1/bsv/main',
  WOC_API_TEST: 'https://api.whatsonchain.com/v1/bsv/test',
  get WOC_API() { return this.network === 'testnet' ? this.WOC_API_TEST : this.WOC_API_MAIN; },

  scanRecords: function(onRecord) {
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
      /* WHY sequential: WoC rate-limits concurrent requests (429).
       * Fetch one at a time with a 50ms gap to stay under the limit. */
      var results = [];
      return mapActions.reduce(function(chain, action) {
        return chain.then(function() {
          return new Promise(function(resolve) { setTimeout(resolve, 50); })
            .then(function() { return self._fetchAndParseRecord(action.txid); })
            .then(function(r) {
              results.push(r);
              if (onRecord) onRecord(r);
            })
            .catch(function(err) { if (typeof console !== 'undefined') { console.error('[scanRecords] fetch/parse failed:', err); } });
        });
      }, Promise.resolve()).then(function() { return results; });
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
          iconTxid = App.Utils.parseTxid(res.txid);
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
          if (existingTxid && existingTxid !== '(pending)' && /^[0-9a-fA-F]{64}(_\w+)?$/.test(existingTxid)) {
            ssTxids[idx] = App.Utils.parseTxid(existingTxid);
            return;
          }
          if (slot.dataB64) {
            chain = chain.then(function() {
              onStatus('UPLOADING SCREENSHOT ' + n + ' TO CHAIN...');
              var ssBytes = self._base64ToBytes(slot.dataB64);
              var ssMime = slot.mime || 'image/png';
              var ssFilename = slot.filename || ('ss' + n);
              return self.uploadIcon(ssBytes, ssMime, ssFilename).then(function(res) {
                ssTxids[idx] = App.Utils.parseTxid(res.txid);
                onStatus('SS' + n + ' UPLOADED // TXID: ' + res.txid.substring(0, 12) + '...');
                // Write txid into MAP fields
                for (var fi = 0; fi < fields.length; fi++) {
                  if (fields[fi][0] === 'ss' + n + '_txid') { fields[fi][1] = App.Utils.parseTxid(res.txid); break; }
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
      // Strip any _txid fields that still have no real txid before broadcast.
      // Uploads overwrite the empty placeholder with real 64-char hex txids.
      // Any that remain empty must not be broadcast.
      for (var fi = fields.length - 1; fi >= 0; fi--) {
        if (/_txid$/.test(fields[fi][0]) && !fields[fi][1]) {
          fields.splice(fi, 1);
        }
      }
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
      var iconScript = BSVScript.buildOrdinalInscriptionScript(iconBytes, 'image/png');
      iconEst = this.estimateFee([iconScript]);
    }
    // Estimate screenshot upload fees.
    // Mirror the submitFull() guard: skip slots that already have a valid on-chain
    // txid — those will NOT be re-uploaded, so they cost nothing here.
    // Without this guard, slots restored from an on-chain record have both a txid
    // AND dataB64 (loaded for preview), causing buildBProtocolScript to throw on
    // large images, which is caught silently and collapses the estimate to 20 sats.
    var ssFeeSats = 0;
    var ssTotalBytes = 0;
    if (ssSlots) {
      for (var i = 0; i < ssSlots.length; i++) {
        var ssTxid = ssSlots[i] && ssSlots[i].txid;
        var ssOnChain = ssTxid && ssTxid !== '(pending)' && /^[0-9a-fA-F]{64}(_\w+)?$/.test(ssTxid);
        if (ssSlots[i] && ssSlots[i].dataB64 && !ssOnChain) {
          var ssBytes = this._base64ToBytes(ssSlots[i].dataB64);
          var ssScript = BSVScript.buildOrdinalInscriptionScript(ssBytes, ssSlots[i].mime || 'image/png');
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
      d.features.forEach(function(f, i) {
        if (f) fields.push(['feature_' + (i + 1), f]);
      });
      fields.push(
        ['icon_txid',         d.icon_txid || ''],
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
          fields.push(['ss' + n + '_txid',     d['ss' + n + '_txid'] || '']);
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
      return result;
    });
};

// On-chain wallet scan for RecordPicker
App._onchainScanRecords = async function(onRecord) {
  var records = [];
  await WalletManager.scanRecords(function(r) {
    if (r.fields && r.fields.protocol === SETTINGS.PROTOCOL_PREFIX) {
      records.push(r.fields);
      if (onRecord) onRecord(r.fields);
    }
  });
  return records;
};


// ─────────────────────────────────────────────────────────────────────
//  Register capability
// ─────────────────────────────────────────────────────────────────────
App.Capabilities.onchain = true;
