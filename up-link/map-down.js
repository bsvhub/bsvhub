/* ═══════════════════════════════════════════════════════════════
   map-down.js — S3 Viewer + MAP Table (v7.0)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Fetches transactions from WhatsOnChain, decodes MAP
             records from OP_RETURN scripts, and renders the MAP
             table + BSVCard in Screen 3. Also provides the S3
             table panel controller.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.StatusBar, App.Config (from app-core.js).
             BSVCard (from card.js).

   OUTPUTS:  App.Viewer           — { decodeScript, extractMAP, fetchTx,
                                      buildMAPHTML, loadTx, init }
             App.Panels.S3.table  — { render(), mount() }

   DEPENDS:  settings.js, app-core.js (Utils, StatusBar, Config),
             card.js (BSVCard).

   NOTES:    Absorbed from app-panels-s3.js (App.Viewer + S3.table).
             "map-down" because it pulls MAP data DOWN from chain
             (contrast with map-up.js which pushes data UP to chain).
             decodeScript and extractMAP are NOT duplicates of
             onchain.js BSVScript — those build scripts for
             broadcasting; these decode scripts from fetched txs.
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S3 = App.Panels.S3 || {};


/* ─────────────────────────────────────────────────────────────
   Helper: isoToEU — Convert ISO date (YYYY-MM-DD) to EU (DD/MM/YYYY)
   ───────────────────────────────────────────────────────────── */
function _viewerIsoToEU(d) {
  var p = (d || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
}


/* ═════════════════════════════════════════════════════════════
   App.Viewer — Core viewer logic
   ═════════════════════════════════════════════════════════════ */
App.Viewer = {

  /* MAP protocol prefix address */
  MAP_PREFIX: '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5',

  /* WhatsOnChain API base — switched by testnet toggle in S3 titlebar */
  WOC_API_MAIN: 'https://api.whatsonchain.com/v1/bsv/main',
  WOC_API_TEST: 'https://api.whatsonchain.com/v1/bsv/test',

  getWocApi: function() {
    var cb = document.getElementById('testnet-cb');
    return (cb && cb.checked) ? this.WOC_API_TEST : this.WOC_API_MAIN;
  },


  /* ─────────────────────────────────────────────────────────
     decodeScript(hex) — Decode a hex script output into OP parts
     Iterates hex string parsing opcodes and pushdata.
     Returns array of decoded strings.
     ───────────────────────────────────────────────────────── */
  decodeScript: function(hex) {
    var parts = [];
    var pos = 0;

    function rb() {
      var b = parseInt(hex.substr(pos, 2), 16);
      pos += 2;
      return b;
    }

    function rbs(n) {
      var a = new Uint8Array(n);
      for (var i = 0; i < n; i++) { a[i] = rb(); }
      return a;
    }

    while (pos < hex.length) {
      var op = rb();
      if (op === 0x00) {
        parts.push('OP_0');
      } else if (op === 0x6a) {
        parts.push('OP_RETURN');
      } else if (op >= 0x01 && op <= 0x4b) {
        var d = rbs(op);
        try { parts.push(new TextDecoder().decode(d)); } catch (e) { parts.push('[hex]'); }
      } else if (op === 0x4c) {
        var l1 = rb();
        var d1 = rbs(l1);
        try { parts.push(new TextDecoder().decode(d1)); } catch (e) { parts.push('[hex]'); }
      } else if (op === 0x4d) {
        var lo = rb();
        var hi = rb();
        var l2 = lo | (hi << 8);
        var d2 = rbs(l2);
        try { parts.push(new TextDecoder().decode(d2)); } catch (e) { parts.push('[hex]'); }
      } else {
        parts.push('OP_' + op.toString(16));
      }
    }

    return parts;
  },


  /* ─────────────────────────────────────────────────────────
     extractMAP(parts) — Extract MAP fields from decoded script parts
     Looks for MAP prefix followed by 'SET', then parses key-value pairs.
     Returns MAP fields object or null.
     ───────────────────────────────────────────────────────── */
  extractMAP: function(parts) {
    var idx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === this.MAP_PREFIX) { idx = i; break; }
    }
    if (idx === -1 || parts[idx + 1] !== 'SET') return null;

    var fields = {};
    for (var j = idx + 2; j + 1 < parts.length; j += 2) {
      var key = parts[j];
      var val = parts[j + 1];
      if (key === 'OP_0') continue;
      if (val === 'OP_0') val = '';
      fields[key] = val;
    }
    return fields;
  },


  /* ─────────────────────────────────────────────────────────
     fetchTx(txid) — Fetch transaction from WhatsOnChain API
     Returns JSON tx object or throws.
     ───────────────────────────────────────────────────────── */
  fetchTx: function(txid) {
    return fetch(this.getWocApi() + '/tx/' + txid)
      .then(function(r) {
        if (!r.ok) throw new Error('Transaction not found (HTTP ' + r.status + ')');
        return r.json();
      });
  },


  /* ─────────────────────────────────────────────────────────
     buildMAPHTML(fields, txid) — Build MAP record table HTML
     Creates table rows for each field, skipping internal fields
     starting with '_'. Uses App.Utils.esc() for values.
     Returns HTML string.
     ───────────────────────────────────────────────────────── */
  buildMAPHTML: function(fields, txid) {
    var esc = App.Utils.esc;
    var html = '<div class="plabel">ON-CHAIN MAP RECORD</div>';
    html += '<table class="map-table"><tbody>';

    /* Display fields in protocol order */
    var ordered = [
      'protocol', 'protocol_version', 'name', 'abbreviation', 'url',
      'tor_url', 'bsv_address',
      'category', 'status', 'language', 'brc100', 'release_date',
      'version', 'tags', 'description'
    ];

    /* Add feature fields */
    for (var i = 1; i <= 6; i++) {
      if (fields['feature_' + i]) ordered.push('feature_' + i);
    }

    ordered = ordered.concat([
      'icon_txid', 'icon_format', 'icon_size_kb',
      'icon_bg_enabled', 'icon_fg_enabled', 'icon_bg_colour', 'icon_fg_colour', 'icon_bg_alpha',
      'icon_zoom', 'alt_text',
      'developer_paymail', 'developer_twitter', 'developer_github', 'developer_bio'
    ]);

    /* Add screenshot fields */
    for (var si = 1; si <= 4; si++) {
      if (fields['ss' + si + '_txid']) {
        ordered.push('ss' + si + '_txid', 'ss' + si + '_format', 'ss' + si + '_size_kb', 'ss' + si + '_zoom');
      }
    }

    /* Render ordered fields */
    var rendered = {};
    for (var j = 0; j < ordered.length; j++) {
      var k = ordered[j];
      if (fields[k] === undefined) continue;
      rendered[k] = true;
      var isFeature = k.indexOf('feature') === 0;
      var val = (k === 'release_date') ? _viewerIsoToEU(fields[k]) : fields[k];
      html += '<tr><td>' + esc(k) + '</td><td class="' + (isFeature ? 'fv' : '') + '">' + esc(val) + '</td></tr>';
    }

    /* Any extra fields not in the standard set */
    for (var key in fields) {
      if (fields.hasOwnProperty(key) && !rendered[key]) {
        html += '<tr><td>' + esc(key) + '</td><td>' + esc(fields[key]) + '</td></tr>';
      }
    }

    html += '</tbody></table>';
    return html;
  },


  /* ─────────────────────────────────────────────────────────
     loadTx(txidParam) — Main load function
     Gets txid from input or parameter. Validates, fetches,
     decodes, builds MAP table + BSVCard.
     ───────────────────────────────────────────────────────── */
  loadTx: function(txidParam) {
    var $ = App.Utils.$;
    var esc = App.Utils.esc;
    var self = this;

    var txid = txidParam || ($('txid-input') ? $('txid-input').value.trim() : '');
    if (!txid) return;

    /* Validate txid format (64 hex chars) */
    if (!App.Utils.isValidTxid(txid)) {
      var badge = $('viewer-badge');
      if (badge) {
        badge.textContent = 'INVALID TXID';
        badge.className = 'badge err';
      }
      return;
    }

    /* Update URL without reload */
    if (history.replaceState) {
      history.replaceState(null, '', '?tx=' + txid);
    }

    /* Populate input */
    var txInput = $('txid-input');
    if (txInput) txInput.value = txid;

    /* Set loading state */
    var badge = $('viewer-badge');
    if (badge) {
      badge.textContent = 'LOADING...';
      badge.className = 'badge loading';
    }

    var tableEl = $('p3-table');
    var cardEl = $('p3-card');

    if (tableEl) {
      tableEl.innerHTML = '<div class="loading-msg"><div class="spinner">&#x27F3;</div><div class="text">FETCHING TX FROM CHAIN...</div></div>';
    }
    if (cardEl) {
      cardEl.innerHTML = '<div class="loading-msg"><div class="spinner">&#x27F3;</div><div class="text">LOADING...</div></div>';
    }

    /* Fetch and decode */
    self.fetchTx(txid)
      .then(function(tx) {
        /* Find the OP_RETURN output with MAP data */
        var fields = null;
        for (var i = 0; i < tx.vout.length; i++) {
          var script = tx.vout[i].scriptPubKey;
          if (!script || !script.hex) continue;
          var decoded = self.decodeScript(script.hex);
          var map = self.extractMAP(decoded);
          if (map) { fields = map; break; }
        }

        if (!fields) {
          throw new Error('No MAP record found in this transaction');
        }

        /* Render MAP table */
        if (tableEl) {
          tableEl.innerHTML = self.buildMAPHTML(fields, txid);
        }

        /* Inject BSVCard CSS once before rendering */
        if (typeof BSVCard !== 'undefined' && BSVCard.injectCSS) {
          BSVCard.injectCSS();
        }

        /* Build CDN URLs from config */
        var cdnUrls = App.Config.getAllCdnUrls('{txid}');
        /* getAllCdnUrls replaces {txid} with the param, but we need template URLs for BSVCard */
        var cdnUrlTemplates = [];
        var withSuffix = SETTINGS.CDN_URLS_WITH_SUFFIX || [];
        var noSuffix = SETTINGS.CDN_URLS_NO_SUFFIX || [];
        for (var u = 0; u < withSuffix.length; u++) { cdnUrlTemplates.push(withSuffix[u]); }
        for (var v = 0; v < noSuffix.length; v++) { cdnUrlTemplates.push(noSuffix[v]); }

        /* Render card using shared BSVCard module */
        if (cardEl) {
          cardEl.innerHTML = '<div class="bsvcard-wrap">' + BSVCard.build(fields, { showLabel: true }) + '</div>';

          /* Init tab click handlers and load all images from CDN */
          BSVCard.initTabs(cardEl);
          BSVCard.loadAllImages(cardEl, fields, cdnUrlTemplates);
        }

        /* Update badge */
        if (badge) {
          badge.textContent = '\u2713 ON CHAIN';
          badge.className = 'badge';
        }

        /* Update status bar */
        var sbEl = document.querySelector('#screen-3 .sb-l');
        if (sbEl) {
          var wocLink = 'https://whatsonchain.com/tx/' + txid;
          sbEl.innerHTML = 'TXID: <a href="' + wocLink + '" target="_blank" style="color:var(--dim);text-decoration:none;border-bottom:1px solid var(--border);">' + txid.substring(0, 16) + '...</a>' +
            (tx.blockheight ? ' // BLOCK: ' + tx.blockheight : ' // UNCONFIRMED') +
            (tx.time ? ' // ' + new Date(tx.time * 1000).toISOString().slice(0, 10) : '');
          sbEl.className = 'sb-l ok';
        }

        /* Scale card after render */
        setTimeout(function() {
          if (cardEl) BSVCard.scaleCard(cardEl);
        }, 80);
      })
      .catch(function(err) {
        if (badge) {
          badge.textContent = 'ERROR';
          badge.className = 'badge err';
        }
        if (tableEl) {
          tableEl.innerHTML = '<div class="loading-msg"><div class="err-msg">' +
            '\u2717 ' + esc(err.message) +
            '<br><br><span style="color:var(--dim);font-size:12px;">Check the TXID and try again.' +
            '<br>The transaction must contain a MAP protocol OP_RETURN.</span></div></div>';
        }
        if (cardEl) {
          cardEl.innerHTML = '';
        }
      });
  },


  /* ─────────────────────────────────────────────────────────
     init() — Initialize viewer
     Wires Enter key, checks ?tx= URL param, wires resize.
     ───────────────────────────────────────────────────────── */
  init: function() {
    var $ = App.Utils.$;
    var self = this;

    /* Wire Enter key on txid input to trigger load */
    var txInput = $('txid-input');
    if (txInput) {
      txInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') self.loadTx();
      });
    }

    /* Wire resize handler for BSVCard.scaleCard */
    window.addEventListener('resize', function() {
      var cardEl = $('p3-card');
      if (cardEl && typeof BSVCard !== 'undefined') {
        BSVCard.scaleCard(cardEl);
      }
    });

    /* Check ?tx= URL parameter for auto-load */
    var search = window.location.search || '';
    if (search) {
      var match = search.match(/[?&]tx=([0-9a-fA-F]{64})/);
      if (match) {
        var txid = match[1];
        if (txInput) txInput.value = txid;
        self.loadTx(txid);
      }
    }
  }
};


/* ═════════════════════════════════════════════════════════════
   Panel Controller — App.Panels.S3.table
   ═════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   P3-TABLE — MAP record table (populated by loadTx)
   ───────────────────────────────────────────────────────────── */
App.Panels.S3.table = {
  render: function() {
    return '' +
      '<div class="plabel">MAP RECORD</div>' +
      '<div id="p3-table-content"></div>';
  },

  mount: function() {
    /* Empty — populated dynamically by App.Viewer.loadTx() */
  }
};
