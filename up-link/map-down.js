/* ═══════════════════════════════════════════════════════════════
   map-down.js — S3 Viewer + MAP Table (v7.4)
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Fetches transactions from WhatsOnChain, decodes MAP
             records from OP_RETURN scripts, and renders the MAP
             table + BSVCard in Screen 3. Also provides the S3
             table panel controller.

   INPUTS:   SETTINGS (from settings.js).
             App.Utils, App.StatusBar, App.Config (from app-core.js).
             BSVCard (from card.js).

   OUTPUTS:  App.Viewer           — { decodeScript, extractMAP, fetchTx,
                                      buildMAPHTML, loadTx, init,
                                      _buildImageMeta, _fetchImageMeta,
                                      _loadImageDirect }
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
      'icon_zoom', 'icon_pan_x', 'icon_pan_y', 'alt_text',
      'developer_paymail', 'developer_twitter', 'developer_github', 'developer_bio'
    ]);

    /* Add screenshot fields — per-slot zoom + alt_text */
    for (var si = 1; si <= 4; si++) {
      if (fields['ss' + si + '_txid']) {
        ordered.push('ss' + si + '_txid', 'ss' + si + '_format', 'ss' + si + '_size_kb', 'ss' + si + '_zoom', 'ss' + si + '_pan_x', 'ss' + si + '_pan_y', 'ss' + si + '_alt_text');
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

    /* Branch: txid_suffix format → image-direct mode, skip MAP fetch */
    if (txid.indexOf('_') !== -1) {
      self._loadImageDirect(txid);
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

        /* Build CDN URL templates — testnet-first when toggle is on */
        var _cb = document.getElementById('testnet-cb');
        var cdnUrlTemplates = (_cb && _cb.checked)
          ? (SETTINGS.CDN_URLS_TESTNET || []).concat(SETTINGS.CDN_URLS || [])
          : (SETTINGS.CDN_URLS || []);

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
     _buildImageMeta(info) — Pure function. Builds image metadata
     table HTML from a plain data object. Each field is only
     rendered if the value is present — no stale placeholders.

     info fields (all optional):
       txHash    {string}  — bare 64-hex transaction ID
       slot      {string}  — output index suffix (e.g. "0")
       type      {string}  — MIME type from CDN header
       sizeKb    {string}  — file size in KB (e.g. "42.3 KB")
       width     {number}  — naturalWidth in pixels
       height    {number}  — naturalHeight in pixels
       block     {number}  — block height
       date      {string}  — ISO date string (YYYY-MM-DD)
       network   {string}  — "MAINNET" or "TESTNET"
       cdn       {string}  — CDN hostname that served the image
     ───────────────────────────────────────────────────────── */
  _buildImageMeta: function(info) {
    var esc = App.Utils.esc;
    var rows = '';

    /* Helper: append a row only when value is truthy */
    function row(label, value) {
      if (!value && value !== 0) return;
      rows += '<tr><td>' + esc(label) + '</td><td>' + esc(String(value)) + '</td></tr>';
    }

    row('TXID',       info.txHash);
    row('SLOT',       info.slot !== undefined ? info.slot : null);
    row('TYPE',       info.type);
    row('SIZE',       info.sizeKb);

    /* Resolution + aspect ratio — only when both dimensions known */
    if (info.width && info.height) {
      row('RESOLUTION', info.width + ' \u00d7 ' + info.height + ' px');
      /* Simplify ratio via GCD */
      var gcd = (function(a, b) { return b ? arguments.callee(b, a % b) : a; })(info.width, info.height);
      row('ASPECT',   (info.width / gcd) + ':' + (info.height / gcd));
    }

    row('BLOCK',      info.block);
    row('DATE',       info.date);
    row('NETWORK',    info.network);
    row('CDN',        info.cdn);

    return '<div class="plabel">IMAGE INFO</div>' +
      '<table class="map-table"><tbody>' + rows + '</tbody></table>';
  },


  /* ─────────────────────────────────────────────────────────
     _fetchImageMeta(url, txHash) — Fetches CDN response headers
     and WoC tx data in parallel. Returns a Promise that resolves
     to a plain metadata object compatible with _buildImageMeta().
     ───────────────────────────────────────────────────────── */
  _fetchImageMeta: function(url, txHash) {
    var self = this;
    var timeout = (SETTINGS.FETCH_TIMEOUT_MS || 6000);

    /* CDN fetch — Content-Type + file size.
       Strategy: HEAD first (fast, no body transfer). If Content-Length is
       absent or zero (common for SVG — CDNs gzip text on the fly and can't
       pre-declare size), fall back to a GET and measure blob.size instead. */
    var cdnPromise = (function() {
      var ctrl = new AbortController();
      var timer = setTimeout(function() { ctrl.abort(); }, timeout);

      function parseType(r) {
        var t = (r.headers.get('Content-Type') || '').split(';')[0].trim().toUpperCase();
        return t || null;
      }

      return fetch(url, { method: 'HEAD', signal: ctrl.signal })
        .then(function(r) {
          clearTimeout(timer);
          var type   = parseType(r);
          var bytes  = parseInt(r.headers.get('Content-Length') || '0', 10);
          if (bytes > 0) {
            return { type: type, sizeKb: (bytes / 1024).toFixed(1) + ' KB' };
          }
          /* Content-Length missing — GET the body and measure blob size */
          var ctrl2  = new AbortController();
          var timer2 = setTimeout(function() { ctrl2.abort(); }, timeout);
          return fetch(url, { signal: ctrl2.signal })
            .then(function(r2) {
              clearTimeout(timer2);
              /* Re-read type from GET response in case HEAD omitted it */
              var type2 = parseType(r2) || type;
              return r2.blob().then(function(blob) {
                var sizeKb = blob.size > 0 ? (blob.size / 1024).toFixed(1) + ' KB' : null;
                return { type: type2, sizeKb: sizeKb };
              });
            })
            .catch(function() { return { type: type, sizeKb: null }; });
        })
        .catch(function() { return { type: null, sizeKb: null }; });
    })();

    /* WoC tx fetch — block height + timestamp */
    var wocPromise = self.fetchTx(txHash)
      .then(function(tx) {
        var date = tx.time
          ? new Date(tx.time * 1000).toISOString().slice(0, 10)
          : null;
        return {
          block: tx.blockheight || null,
          date:  date
        };
      })
      .catch(function() { return { block: null, date: null }; });

    return Promise.all([cdnPromise, wocPromise]).then(function(results) {
      return {
        type:  results[0].type,
        sizeKb: results[0].sizeKb,
        block: results[1].block,
        date:  results[1].date
      };
    });
  },


  /* ─────────────────────────────────────────────────────────
     _loadImageDirect(txid) — Load a single on-chain image by
     txid_suffix. Bypasses WhatsOnChain MAP fetch. Populates
     the table panel with image metadata via _buildImageMeta(),
     fills the card panel with a full-fit <img>.
     Called by loadTx() when the txid contains '_'.
     ───────────────────────────────────────────────────────── */
  _loadImageDirect: function(txid) {
    var self = this;
    var $ = App.Utils.$;

    /* Split "abc...123_0" → txHash="abc...123", slot="0" */
    var parts   = txid.split('_');
    var txHash  = parts[0];
    var slot    = parts.slice(1).join('_');   /* preserve multi-part suffixes */
    var network = (function() {
      var cb = document.getElementById('testnet-cb');
      return (cb && cb.checked) ? 'TESTNET' : 'MAINNET';
    })();

    /* Update URL without reload */
    if (history.replaceState) {
      history.replaceState(null, '', '?tx=' + txid);
    }

    /* Populate input */
    var txInput = $('txid-input');
    if (txInput) txInput.value = txid;

    /* Loading badge */
    var badge = $('viewer-badge');
    if (badge) {
      badge.textContent = 'LOADING...';
      badge.className = 'badge loading';
    }

    /* Table panel: loading state while metadata fetches */
    var tableEl = $('p3-table');
    if (tableEl) {
      tableEl.innerHTML =
        '<div class="plabel">IMAGE INFO</div>' +
        '<div class="loading-msg" style="height:auto;padding:12px 0;">' +
          '<div class="spinner">\u27f3</div>' +
          '<div class="text">FETCHING METADATA...</div>' +
        '</div>';
    }

    /* Card panel: bare <img> sized to fill container */
    var cardEl = $('p3-card');
    if (!cardEl) return;

    var img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    img.alt = txid;
    cardEl.innerHTML = '';
    cardEl.appendChild(img);

    /* CDN try-loop — testnet-first when toggle is on, mainnet fallback */
    var cdnUrls = (network === 'TESTNET')
      ? (SETTINGS.CDN_URLS_TESTNET || []).concat(SETTINGS.CDN_URLS || [])
      : (SETTINGS.CDN_URLS || []);
    var urls    = cdnUrls.map(function(u) { return u.replace('{txid}', txid); });
    var idx     = 0;

    /* Shared metadata accumulator — updated as each async source resolves */
    var meta = { txHash: txHash, slot: slot, network: network };

    function renderMeta() {
      if (tableEl) tableEl.innerHTML = self._buildImageMeta(meta);
    }

    /* Image load handler — resolution known + record which CDN served it */
    img.addEventListener('load', function() {
      if (badge) {
        badge.textContent = '\u2713 IMAGE';
        badge.className = 'badge';
      }
      meta.width  = img.naturalWidth;
      meta.height = img.naturalHeight;
      /* img.src at this point is the resolved URL that actually loaded */
      try { meta.cdn = new URL(img.src).hostname; } catch (e) {}
      renderMeta();
      BSVCard.scaleCard(cardEl);
    }, { once: true });

    /* Start image loading via CDN try-loop */
    function tryNext() {
      if (idx >= urls.length) {
        /* All CDNs failed */
        if (badge) { badge.textContent = 'NOT FOUND'; badge.className = 'badge err'; }
        if (cardEl) {
          cardEl.innerHTML =
            '<div class="loading-msg"><div class="err-msg">' +
            '\u2717 Image not found on any CDN.' +
            '<br><br><span style="color:var(--dim);font-size:12px;">Check the TXID suffix and try again.</span>' +
            '</div></div>';
        }
        if (tableEl) tableEl.innerHTML = self._buildImageMeta(meta);
        return;
      }
      img.src = urls[idx];
      img.style.display = '';
      img.onerror = function() { idx++; tryNext(); };
    }
    tryNext();

    /* Fetch CDN headers + WoC tx in parallel — update table when ready */
    self._fetchImageMeta(urls[0], txHash).then(function(fetched) {
      meta.type   = fetched.type;
      meta.sizeKb = fetched.sizeKb;
      meta.block  = fetched.block;
      meta.date   = fetched.date;
      renderMeta();
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
      var match = search.match(/[?&]tx=([0-9a-fA-F]{64}(?:_[0-9a-zA-Z]+)?)/);
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
