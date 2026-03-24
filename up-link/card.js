/* ═══════════════════════════════════════════════════════════════════════
   card.js — Shared DIRECTORY CARD PREVIEW component
   ═══════════════════════════════════════════════════════════════════════

   Single source for the 3-column card layout (icon + screenshots),
   tab strip, info pills, info tables, scale-to-fit, and image loading.

   Used by:
     - submit_mockup_v25.html (preview iframe via srcdoc)
     - viewer.html (on-chain record viewer)

   Expects CSS variables on :root or parent:
     --amber, --amber-dim, --accent, --green, --gold, --highlight,
     --white, --dim, --border, --input-bg, --font

   NO npm dependencies — plain ES5-compatible JS.
   ═══════════════════════════════════════════════════════════════════════ */

var BSVCard = (function() {

  // ── Defaults ───────────────────────────────────────────────────
  var DEFAULTS = {
    tileSize: 160,
    tileRadius: 20,
    tileBorder: 4,
    tabGap: 2,
    tabRadius: 4,
    cdnUrls: [
      'https://ordinals.gorillapool.io/content/{txid}_0',
      'https://ordfs.network/{txid}_0',
      'https://1satordinals.com/content/{txid}_0',
      'https://ordfs.network/{txid}',
      'https://ordinals.gorillapool.io/content/{txid}',
    ],
    statusColours: {
      alpha: '#ff5733', beta: '#ffcc66', live: '#00cc44',
      deprecated: 'rgba(255,255,255,0.3)', delisted: '#ff3c3c'
    },
  };

  // ── Helpers ────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function escBreakable(s) {
    return esc(s).replace(/\//g, '/<wbr>').replace(/\./g, '.<wbr>');
  }

  function rgba(hex, a) {
    if (!hex || hex.length < 7) return 'transparent';
    var r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }

  function isoToEU(d) {
    var p = (d || '').split('-');
    return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : d;
  }

  // ── CSS (injected once) ────────────────────────────────────────
  var _cssInjected = false;
  function injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '/* ── BSVCard shared styles ── */',
      '.bsvcard-wrap{display:flex;flex-direction:column;overflow:hidden;flex:1;min-height:0;height:100%;}',

      '.bsvcard-tip-wrap{margin-bottom:2px;flex-shrink:0;width:100%;}',
      '.bsvcard-tip-box{background:var(--input-bg);border:1px solid var(--border);padding:4px 10px;font-size:12px;text-align:center;letter-spacing:1px;display:grid;}',
      '.bsvcard-tip-box .tip-static,.bsvcard-tip-box .tip-desc{grid-area:1/1;display:flex;align-items:center;justify-content:center;transition:opacity 0.25s ease;min-height:0;}',
      '.bsvcard-tip-box .tip-static{color:rgba(200,200,200,0.35);letter-spacing:2px;font-size:11px;text-transform:uppercase;opacity:0;}',
      '.bsvcard-tip-box .tip-desc{color:var(--highlight);line-height:1.5;letter-spacing:0.5px;opacity:1;overflow-wrap:break-word;word-break:break-word;}',

      '.bsvcard-pills{display:flex;gap:4px;flex-wrap:wrap;padding:3px 0 2px;font-size:11px;align-items:center;flex-shrink:0;}',
      '.bsvcard-pill{padding:1px 5px;letter-spacing:1px;font-family:var(--font);font-size:11px;}',

      '.bsvcard-scale-wrap{flex:1;min-height:0;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;padding-top:2px;}',
      '.bsvcard-inner{display:flex;flex-direction:column;align-items:center;transform-origin:top center;}',

      '.bsvcard-3col{display:flex;gap:6px;align-items:stretch;justify-content:center;}',
      '.bsvcard-side-col{display:flex;flex-direction:column;gap:4px;flex-shrink:0;}',
      '.bsvcard-center-col{display:flex;flex-direction:column;align-items:center;flex-shrink:0;}',

      '.bsvcard-tile{position:relative;overflow:hidden;flex-shrink:0;background:rgba(90,110,165,0.5);}',
      '.bsvcard-tile-bg{position:absolute;inset:0;z-index:0;}',
      '.bsvcard-tile-img{position:absolute;top:0;left:0;right:0;bottom:28px;margin:auto;z-index:1;max-width:80%;max-height:70%;object-fit:contain;}',
      '.bsvcard-tile-name{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);z-index:11;text-align:center;padding:6px 4px;}',
      '.bsvcard-tile-name span{color:#fff;font-size:13px;font-weight:500;letter-spacing:1px;}',
      '.bsvcard-no-img{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;color:rgba(255,255,255,0.25);font-size:13px;margin-bottom:20px;}',

      '.bsvcard-side-tile{position:relative;overflow:hidden;box-sizing:border-box;flex:1;min-height:0;border-radius:4px;background:rgba(0,229,255,0.03);}',
      '.bsvcard-side-tile img{width:100%;height:100%;object-fit:contain;display:block;opacity:0.7;}',
      '.bsvcard-side-tile:hover img{opacity:1;}',
      '.bsvcard-side-tile:hover{border-color:rgba(0,229,255,0.5) !important;}',
      '.bsvcard-side-lbl{position:absolute;top:2px;left:3px;font-size:8px;font-weight:700;letter-spacing:0.3px;}',

      '.bsvcard-tab-strip{display:flex;margin-top:3px;}',
      '.bsvcard-tab{box-sizing:border-box;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:border-color 0.15s,background 0.15s;}',
      '.bsvcard-tab:hover{filter:brightness(1.3);}',
      '.bsvcard-tab.tab-active{outline:2px solid var(--amber);outline-offset:-1px;}',
      '.bsvcard-tab-lbl{font-size:8px;font-weight:700;letter-spacing:0.3px;}',

      '.bsvcard-info-tbl{border-collapse:collapse;font-size:11px;margin:0 auto;}',
      '.bsvcard-info-tbl td{padding:2px 1px;border-bottom:1px solid rgba(46,63,102,0.3);height:16px;line-height:16px;}',
      '.bsvcard-info-tbl td:first-child{color:var(--amber-dim);letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap;padding-right:2px;}',
      '.bsvcard-info-tbl td:last-child{color:var(--white);text-align:right;}',
      '.bsvcard-info-tbl .box{display:inline-block;background:rgba(234,179,0,0.12);color:var(--amber);border:1px solid rgba(234,179,0,0.35);padding:1px 4px;font-size:10px;letter-spacing:1px;margin:1px;}',
      '.bsvcard-info-tbl .box-status{display:inline-block;padding:1px 6px;font-size:10px;letter-spacing:1px;border-width:1px;border-style:solid;margin:1px;}',

      '.bsvcard-plabel{font-size:12px;color:var(--amber);letter-spacing:3px;font-weight:700;padding-bottom:4px;border-bottom:1px solid var(--accent);margin-bottom:6px;flex-shrink:0;}',
    ].join('\n');
    document.head.appendChild(style);
  }


  // ── Build card HTML ────────────────────────────────────────────
  //
  //  fields: MAP key-value object (from on-chain decode or collectData)
  //    Required: name, description, category, status, language,
  //              brc100, icon_txid, icon_bg_enabled, icon_fg_enabled, etc.
  //
  //  opts: {
  //    tileSize, tileRadius, tileBorder,         — dimensions
  //    iconSrc,                                   — data URL or CDN URL for icon
  //    screenshots: [{src, format, kb}, ...],     — up to 4 screenshot image sources
  //    statusColours,                             — override colour map
  //    showLabel,                                 — show DIRECTORY CARD PREVIEW label (default true)
  //  }
  //
  function build(fields, opts) {
    injectCSS();
    opts = opts || {};
    var f = fields;
    var ts = opts.tileSize || DEFAULTS.tileSize;
    var tr = opts.tileRadius || DEFAULTS.tileRadius;
    var tb = opts.tileBorder || DEFAULTS.tileBorder;
    var tabGap = DEFAULTS.tabGap;
    var tabR = DEFAULTS.tabRadius;
    var statusColours = opts.statusColours || DEFAULTS.statusColours;
    var showLabel = opts.showLabel !== false;

    var name = esc(f.name || 'UNNAMED');
    var rawDesc = f.description || 'No description';
    if (rawDesc.length > 256) rawDesc = rawDesc.substring(0, 256) + '...';
    var desc = escBreakable(rawDesc);

    // Icon background
    var bgOn = f.icon_bg_enabled === 'true' || f.icon_bg_enabled === true;
    var fgOn = f.icon_fg_enabled === 'true' || f.icon_fg_enabled === true;
    var bgCol = f.icon_bg_colour || '#1a1440';
    var fgCol = f.icon_fg_colour || '#EAB300';
    var alpha = parseFloat(f.icon_bg_alpha) || 1;
    var tileBg = 'transparent';
    if (bgOn && fgOn) tileBg = 'linear-gradient(135deg,'+rgba(bgCol,alpha)+','+rgba(fgCol,alpha)+')';
    else if (bgOn) tileBg = rgba(bgCol, alpha);
    else if (fgOn) tileBg = rgba(fgCol, alpha);

    var zoom = parseFloat(f.icon_zoom) || 1;
    var iconSrc = opts.iconSrc || '';

    // Screenshot sources — either dataB64/src or will be loaded from CDN later.
    // If no screenshots opt provided, derive from fields' ssN_txid values.
    var ss = opts.screenshots || [null,null,null,null];
    for (var _si = 0; _si < 4; _si++) {
      if (!ss[_si]) {
        var _txid = f['ss' + (_si+1) + '_txid'];
        if (_txid && _txid !== '(pending)' && _txid.length === 64) {
          ss[_si] = { src: '', txid: _txid, format: f['ss'+(_si+1)+'_format'] || '', kb: f['ss'+(_si+1)+'_size_kb'] || '' };
        }
      }
    }

    // Status colour
    var status = (f.status || '').toLowerCase();
    var statusC = statusColours[status] || 'var(--dim)';

    // Categories, languages
    var cats = (f.category || '').split(';').filter(Boolean);
    var langs = (f.language || '').split(';').filter(Boolean);
    var brc = f.brc100 || 'false';

    // ── Tab buttons ──
    var tabS = Math.floor((ts - tabGap * 4) / 5);
    var tabSources = [
      { label: 'ICO', src: iconSrc, isIcon: true },
      { label: 'SS1', src: (ss[0] && ss[0].src) || '' },
      { label: 'SS2', src: (ss[1] && ss[1].src) || '' },
      { label: 'SS3', src: (ss[2] && ss[2].src) || '' },
      { label: 'SS4', src: (ss[3] && ss[3].src) || '' },
    ];

    function tabBtn(idx) {
      var t = tabSources[idx];
      var has = !!t.src;
      var isActive = idx === 0;
      var borderCol = t.isIcon ? 'var(--amber)' : (has ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.12)');
      var bgC = t.isIcon ? 'rgba(234,179,0,0.18)' : (has ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.03)');
      var lblCol = t.isIcon ? 'var(--amber)' : (has ? 'rgba(0,229,255,0.75)' : 'rgba(255,255,255,0.2)');
      return '<div class="bsvcard-tab' + (isActive ? ' tab-active' : '') + '"'
        + ' data-tab="' + idx + '"'
        + ' data-src="' + (has ? esc(t.src) : '') + '"'
        + ' data-is-icon="' + (t.isIcon ? '1' : '0') + '"'
        + ' style="width:'+tabS+'px;height:'+tabS+'px;border:1px solid '+borderCol+';border-radius:'+tabR+'px;background:'+bgC+';">'
        + '<span class="bsvcard-tab-lbl" style="color:'+lblCol+';">'+t.label+'</span>'
        + '</div>';
    }

    var stripHTML = '<div class="bsvcard-tab-strip" style="gap:'+tabGap+'px;width:'+ts+'px;">'
      + tabBtn(0) + tabBtn(1) + tabBtn(2) + tabBtn(3) + tabBtn(4)
      + '</div>';

    // ── Side tiles ──
    var sideW = Math.round(ts * 0.58);

    function sideTile(n, slotData) {
      var has = slotData && slotData.src;
      var txid = slotData && slotData.txid;
      return '<div class="bsvcard-side-tile"'
        + ' style="width:'+sideW+'px;border:1px solid '+(has ? 'rgba(0,229,255,0.25)' : 'rgba(0,229,255,0.06)')+';border-radius:'+tabR+'px;">'
        + (has ? '<img src="'+esc(slotData.src)+'" data-ss-idx="'+n+'">' : (txid ? '<img data-ss-txid="'+esc(txid)+'" data-ss-idx="'+n+'" style="display:none;">' : ''))
        + '<span class="bsvcard-side-lbl" style="color:rgba(0,229,255,'+(has?'0.55':'0.15')+');">SS'+n+'</span>'
        + '</div>';
    }

    // ── Center tile ──
    var centerTile = '<div id="cctile"'
      + ' data-isrc="'+esc(iconSrc)+'"'
      + ' data-zoom="'+zoom+'"'
      + ' data-ibg="'+tileBg+'"'
      + ' class="bsvcard-tile"'
      + ' style="width:'+ts+'px;height:'+ts+'px;border-radius:'+tr+'px;border:'+tb+'px solid var(--border);">'
      + '<div id="ccbg" class="bsvcard-tile-bg" style="background:'+tileBg+';"></div>'
      + '<img id="ccimg" class="bsvcard-tile-img"'
      + (iconSrc ? ' src="'+esc(iconSrc)+'"' : '')
      + ' style="transform:scale('+zoom+');display:'+(iconSrc?'block':'none')+';">'
      + (iconSrc ? '' : '<span id="ccnoimg" class="bsvcard-no-img">NO IMAGE</span>')
      + '<div class="bsvcard-tile-name"><span>'+name+'</span></div>'
      + '</div>';

    // ── Assemble 3-column layout ──
    var card3col = '<div class="bsvcard-3col">'
      + '<div class="bsvcard-side-col">'
      + sideTile(1, ss[0]) + sideTile(3, ss[2])
      + '</div>'
      + '<div class="bsvcard-center-col">'
      + centerTile + stripHTML
      + '</div>'
      + '<div class="bsvcard-side-col">'
      + sideTile(2, ss[1]) + sideTile(4, ss[3])
      + '</div></div>';

    // ── Info pills ──
    var pills = '<div class="bsvcard-pills">';
    if (cats.length) pills += '<span class="bsvcard-pill" style="background:rgba(234,179,0,0.12);color:var(--amber);border:1px solid rgba(234,179,0,0.35);">' + esc(cats[0].toUpperCase()) + '</span>';
    if (status) pills += '<span class="bsvcard-pill" style="border:1px solid '+statusC+'50;color:'+statusC+';background:rgba(0,0,0,0.3);">' + esc(status.toUpperCase()) + '</span>';
    langs.forEach(function(l) { pills += '<span class="bsvcard-pill" style="background:rgba(234,179,0,0.06);color:rgba(212,208,224,0.7);border:1px solid rgba(46,63,102,0.5);">' + esc(l.toUpperCase()) + '</span>'; });
    if (brc === 'true' || brc === true) pills += '<span class="bsvcard-pill" style="background:rgba(0,204,68,0.08);color:var(--green);border:1px solid rgba(0,204,68,0.3);">BRC-100</span>';
    if (f.on_chain === 'true' || f.on_chain === true) pills += '<span class="bsvcard-pill" style="background:rgba(0,204,68,0.08);color:var(--green);border:1px solid rgba(0,204,68,0.3);">ON-CHAIN</span>';
    if (f.accepts_bsv === 'true' || f.accepts_bsv === true) pills += '<span class="bsvcard-pill" style="background:rgba(234,179,0,0.08);color:var(--amber);border:1px solid rgba(234,179,0,0.3);">\u20BFPAY</span>';
    if (f.open_source === 'true' || f.open_source === true) pills += '<span class="bsvcard-pill" style="background:rgba(0,229,255,0.06);color:rgba(0,229,255,0.8);border:1px solid rgba(0,229,255,0.25);">OSS</span>';
    pills += '</div>';

    // ── Unified info table builder for all 5 slots (ICO + SS1-4) ──
    var dm = 'style="color:var(--dim);opacity:0.35;"';
    var dimCell = '<td '+dm+'>\u2014</td>';
    var naCell  = '<td '+dm+'>N/A</td>';

    function infoPanel(id, slotLabel, loaded, txid, fmt, sizeKb, hasBg, bgC, hasFg, fgC, alphaVal, zoomVal) {
      var h = '<table class="bsvcard-info-tbl" style="width:'+ts+'px;margin-top:6px;">';
      // SLOT
      h += '<tr><td>SLOT</td><td>'+esc(slotLabel)+'</td></tr>';
      // STATUS
      h += '<tr><td>STATUS</td><td style="color:'+(loaded ? 'var(--green)' : 'var(--amber-dim)')+';">'+(loaded ? '\u2713 LOADED' : '\u2717 EMPTY')+'</td></tr>';
      // TXID
      h += '<tr><td>TXID</td>'+(txid && txid !== '(pending)' && txid.length >= 12 ? '<td>'+esc(txid.substring(0,12))+'...</td>' : dimCell)+'</tr>';
      // FORMAT
      h += '<tr><td>FORMAT</td>'+(fmt && fmt !== '—' ? '<td>'+esc(fmt).toUpperCase()+'</td>' : dimCell)+'</tr>';
      // SIZE
      h += '<tr><td>SIZE</td>'+(sizeKb && sizeKb !== '—' ? '<td>'+esc(String(sizeKb))+'kb</td>' : dimCell)+'</tr>';
      // BG
      if (hasBg === 'n/a') h += '<tr><td>BG</td>'+naCell+'</tr>';
      else if (hasBg) h += '<tr><td>BG</td><td><span style="display:inline-block;width:9px;height:9px;background:'+bgC+';border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:3px;"></span>'+bgC+'</td></tr>';
      else h += '<tr><td>BG</td>'+dimCell+'</tr>';
      // FG
      if (hasFg === 'n/a') h += '<tr><td>FG</td>'+naCell+'</tr>';
      else if (hasFg) h += '<tr><td>FG</td><td><span style="display:inline-block;width:9px;height:9px;background:'+fgC+';border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:3px;"></span>'+fgC+'</td></tr>';
      else h += '<tr><td>FG</td>'+dimCell+'</tr>';
      // ALPHA
      if (alphaVal === 'n/a') h += '<tr><td>ALPHA</td>'+naCell+'</tr>';
      else h += '<tr><td>ALPHA</td><td>'+(alphaVal !== undefined && alphaVal !== null ? esc(String(alphaVal)) : '<span '+dm+'>\u2014</span>')+'</td></tr>';
      // ZOOM
      var zv = parseFloat(zoomVal) || 1;
      h += '<tr><td>ZOOM</td><td'+(zv === 1 ? ' '+dm : '')+'>'+zv+'x</td></tr>';
      h += '</table>';
      return h;
    }

    // ── Icon info panel (always rendered) ──
    var hasIcon = !!iconSrc || (f.icon_txid && f.icon_txid !== '(pending)');
    var iconInfo = '<div id="info-icon">';
    iconInfo += infoPanel('info-icon', 'ICON', hasIcon,
      f.icon_txid, f.icon_format, f.icon_size_kb,
      bgOn ? true : false, bgCol,
      fgOn ? true : false, fgCol,
      f.icon_bg_alpha, zoom);
    iconInfo += '</div>';

    // ── Screenshot info panels (always rendered, hidden by default) ──
    var ssInfoPanels = '';
    for (var si = 0; si < 4; si++) {
      var n = si + 1;
      var sSlot = ss[si];
      var ssTxid = f['ss' + n + '_txid'];
      var hasSS = !!(sSlot && sSlot.src) || (ssTxid && ssTxid !== '(pending)');
      var ssFmt = (sSlot && sSlot.format) || f['ss'+n+'_format'] || '';
      var ssSize = (sSlot && sSlot.kb) || f['ss'+n+'_size_kb'] || '';
      var ssZoom = f['ss' + n + '_zoom'];
      ssInfoPanels += '<div id="info-ss'+n+'" style="display:none;">';
      ssInfoPanels += infoPanel('info-ss'+n, 'SCREENSHOT '+n, hasSS,
        ssTxid, ssFmt, ssSize,
        'n/a', '', 'n/a', '', 'n/a', ssZoom);
      ssInfoPanels += '</div>';
    }

    // ── Final assembly ──
    var html = '';
    if (showLabel) html += '<div class="bsvcard-plabel">DIRECTORY CARD PREVIEW</div>';
    html += '<div class="bsvcard-tip-wrap"><div class="bsvcard-tip-box">';
    html += '<div class="tip-static">SCREENSHOT PREVIEW</div>';
    html += '<div class="tip-desc">'+desc+'</div>';
    html += '</div></div>';
    html += pills;
    html += '<div class="bsvcard-scale-wrap" id="card-scale-wrap">';
    html += '<div class="bsvcard-inner" id="card-inner">';
    html += card3col;
    html += iconInfo;
    html += ssInfoPanels;
    html += '</div></div>';

    return html;
  }


  // ── Tab click handler ──────────────────────────────────────────
  function initTabs(container) {
    container = container || document;
    var tabs = container.querySelectorAll('.bsvcard-tab');
    tabs.forEach(function(el) {
      el.addEventListener('click', function() {
        // Remove active from all tabs
        tabs.forEach(function(b) { b.classList.remove('tab-active'); });
        el.classList.add('tab-active');

        var tabIdx = parseInt(el.getAttribute('data-tab'));
        var src = el.getAttribute('data-src');
        var isIcon = el.getAttribute('data-is-icon') === '1';

        var tile = container.querySelector('#cctile');
        var img = container.querySelector('#ccimg');
        var bg = container.querySelector('#ccbg');
        var noimg = container.querySelector('#ccnoimg');
        var tipS = container.querySelector('.tip-static');
        var tipD = container.querySelector('.tip-desc');

        // Hide all info panels
        var infoIco = container.querySelector('#info-icon');
        if (infoIco) infoIco.style.display = 'none';
        for (var si = 1; si <= 4; si++) {
          var sp = container.querySelector('#info-ss'+si);
          if (sp) sp.style.display = 'none';
        }

        if (isIcon) {
          // Show icon info panel
          if (infoIco) infoIco.style.display = '';
          var orig = tile ? tile.getAttribute('data-isrc') : '';
          var ibg = tile ? tile.getAttribute('data-ibg') : '';
          var _z = tile ? tile.getAttribute('data-zoom') : '1';
          if (img) {
            img.src = orig || '';
            img.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:28px;margin:auto;z-index:1;max-width:80%;max-height:70%;object-fit:contain;transform:scale('+_z+');display:'+(orig?'block':'none')+';';
          }
          if (bg) { bg.style.background = ibg; bg.style.visibility = ''; }
          if (noimg) noimg.style.display = orig ? 'none' : '';
          if (tipS) tipS.style.opacity = '0';
          if (tipD) tipD.style.opacity = '1';
        } else {
          // Show screenshot info panel
          var ssPanel = container.querySelector('#info-ss'+tabIdx);
          if (ssPanel) ssPanel.style.display = '';
          if (src && img) {
            img.src = src;
            img.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:28px;margin:auto;z-index:1;max-width:92%;max-height:calc(100% - 34px);object-fit:contain;display:block;transform:scale(1);';
          } else if (img) {
            img.style.display = 'none';
          }
          if (bg) bg.style.visibility = 'hidden';
          if (noimg) noimg.style.display = src ? 'none' : '';
          if (tipS) { tipS.textContent = src ? 'SCREENSHOT '+tabIdx+' PREVIEW' : 'NO SCREENSHOT LOADED'; tipS.style.opacity = '1'; }
          if (tipD) tipD.style.opacity = '0';
        }
        setTimeout(function() { scaleCard(container); }, 10);
      });
    });
  }


  // ── Scale card to fit container ────────────────────────────────
  function scaleCard(container) {
    container = container || document;
    var w = container.querySelector ? container.querySelector('#card-scale-wrap') : document.getElementById('card-scale-wrap');
    var i = container.querySelector ? container.querySelector('#card-inner') : document.getElementById('card-inner');
    if (!w || !i) return;
    i.style.transform = 'none';
    var aH = w.clientHeight, aW = w.clientWidth;
    var nH = i.scrollHeight, nW = i.scrollWidth;
    if (nH <= 0 || aH <= 0) return;
    i.style.transform = 'scale(' + Math.min(aH / nH, aW / nW) + ')';
    i.style.transformOrigin = 'top center';
  }


  // ── Load images from CDN ───────────────────────────────────────
  //  Tries multiple CDN URLs for a given txid. On success, sets img.src.
  //
  function loadImage(txid, imgEl, cdnUrls) {
    if (!txid || !imgEl) return;
    cdnUrls = cdnUrls || DEFAULTS.cdnUrls;
    var urls = cdnUrls.map(function(u) { return u.replace('{txid}', txid); });
    var idx = 0;
    function tryNext() {
      if (idx >= urls.length) { imgEl.style.display = 'none'; return; }
      imgEl.src = urls[idx];
      imgEl.style.display = '';
      imgEl.onerror = function() { idx++; tryNext(); };
    }
    tryNext();
  }

  // Load all images in a card container (icon + screenshots)
  function loadAllImages(container, fields, cdnUrls) {
    container = container || document;
    cdnUrls = cdnUrls || DEFAULTS.cdnUrls;

    // Icon
    var iconTxid = fields.icon_txid;
    if (iconTxid && iconTxid !== '(pending)' && iconTxid.length === 64) {
      var iconImg = container.querySelector('#ccimg');
      var currentSrc = iconImg ? iconImg.getAttribute('src') : '';
      if (iconImg && (!currentSrc || currentSrc === '')) {
        loadImage(iconTxid, iconImg, cdnUrls);
        // Also update the tile data-isrc for tab switching
        var tile = container.querySelector('#cctile');
        if (tile) {
          iconImg.addEventListener('load', function() {
            tile.setAttribute('data-isrc', iconImg.src);
            // Update the ICO tab data-src
            var icoTab = container.querySelector('.bsvcard-tab[data-tab="0"]');
            if (icoTab) icoTab.setAttribute('data-src', iconImg.src);
            var noimg = container.querySelector('#ccnoimg');
            if (noimg) noimg.style.display = 'none';
          }, { once: true });
        }
      }
    }

    // Screenshots
    for (var si = 1; si <= 4; si++) {
      var ssTxid = fields['ss' + si + '_txid'];
      if (ssTxid && ssTxid !== '(pending)' && ssTxid.length === 64) {
        // Side tile images
        var sideImgs = container.querySelectorAll('[data-ss-txid="'+ssTxid+'"]');
        for (var j = 0; j < sideImgs.length; j++) {
          loadImage(ssTxid, sideImgs[j], cdnUrls);
        }
        // Also try any img with data-ss-idx matching
        var idxImgs = container.querySelectorAll('.bsvcard-side-tile [data-ss-idx="'+si+'"]');
        for (var k = 0; k < idxImgs.length; k++) {
          var kSrc = idxImgs[k].getAttribute('src');
          if (!kSrc || kSrc === '' || idxImgs[k].style.display === 'none') {
            loadImage(ssTxid, idxImgs[k], cdnUrls);
          }
        }
        // Update the tab data-src once the image loads
        (function(ssIdx, txid) {
          var tabEl = container.querySelector('.bsvcard-tab[data-tab="'+ssIdx+'"]');
          var sideImg = container.querySelector('.bsvcard-side-tile [data-ss-idx="'+ssIdx+'"]');
          if (tabEl && sideImg) {
            sideImg.addEventListener('load', function() {
              tabEl.setAttribute('data-src', sideImg.src);
            }, { once: true });
          }
        })(si, ssTxid);
      }
    }
  }


  // ── Public API ─────────────────────────────────────────────────
  return {
    DEFAULTS: DEFAULTS,
    esc: esc,
    escBreakable: escBreakable,
    rgba: rgba,
    isoToEU: isoToEU,
    build: build,
    initTabs: initTabs,
    scaleCard: scaleCard,
    loadImage: loadImage,
    loadAllImages: loadAllImages,
    injectCSS: injectCSS,
  };

})();

// Attach to window for global access
if (typeof window !== 'undefined') window.BSVCard = BSVCard;


/* ═══════════════════════════════════════════════════════════════
   S2/S3 Panel Wrappers (v7.0)

   Thin wrappers that plug BSVCard into wireframe panel slots.
   App.Panels.S2.card — preview card from form data (#p2-card)
   App.Panels.S3.card — on-chain card from fetched data (#p3-card)
   ═══════════════════════════════════════════════════════════════ */

App.Panels = App.Panels || {};
App.Panels.S2 = App.Panels.S2 || {};
App.Panels.S3 = App.Panels.S3 || {};


/* ─────────────────────────────────────────────────────────────
   App.Panels.S2.card — S2 BSVCard Preview
   Renders a container, then mount() builds the actual card.
   ───────────────────────────────────────────────────────────── */
App.Panels.S2.card = {

  /**
   * Build cardFields and options from collected form data.
   * Returns { fields, opts } for BSVCard.build().
   */
  _prepareCard: function(data) {
    var d = data;
    var ss = d.screenshots || [null, null, null, null];

    var cardFields = {
      name:            d.name,
      description:     d.description,
      category:        d.category,
      status:          d.status,
      language:        d.language,
      brc100:          String(d.brc100),
      on_chain:        String(!!d.on_chain),
      accepts_bsv:     String(!!d.accepts_bsv),
      open_source:     String(!!d.open_source),
      icon_txid:       d.icon_txid,
      icon_format:     d.icon_format,
      icon_size_kb:    d.icon_size_kb,
      icon_bg_enabled: String(d.icon_bg_enabled),
      icon_fg_enabled: String(d.icon_fg_enabled),
      icon_bg_colour:  d.icon_bg_colour,
      icon_fg_colour:  d.icon_fg_colour,
      icon_bg_alpha:   d.icon_bg_alpha,
      icon_zoom:       d.icon_zoom,
      version:         d.version,
      release_date:    d.release_date
    };

    /* Screenshot txid fields for card rendering */
    for (var si = 0; si < 4; si++) {
      var n = si + 1;
      if (ss[si] || d['ss' + n + '_txid']) {
        cardFields['ss' + n + '_txid']    = d['ss' + n + '_txid'] || '(pending)';
        cardFields['ss' + n + '_format']  = (ss[si] && ss[si].mime) || d['ss' + n + '_format'] || '';
        cardFields['ss' + n + '_size_kb'] = (ss[si] && String(ss[si].kb)) || d['ss' + n + '_size_kb'] || '';
      }
    }

    /* Icon source: prefer base64 data, fall back to chain URL */
    var iconSrc = d.icon_data_b64 || d.icon_chain_url || '';

    /* Build screenshot source array for BSVCard */
    var cardScreenshots = [];
    for (var i = 0; i < 4; i++) {
      var slot = ss[i];
      if (slot) {
        cardScreenshots.push({
          src:      slot.dataB64 || '',
          format:   slot.mime,
          kb:       slot.kb,
          filename: slot.filename,
          txid:     slot.txid
        });
      } else {
        cardScreenshots.push(null);
      }
    }

    var opts = {
      tileSize:    SETTINGS.PREVIEW_TILE_SIZE,
      tileRadius:  SETTINGS.PREVIEW_TILE_RADIUS,
      tileBorder:  SETTINGS.PREVIEW_TILE_BORDER,
      iconSrc:     iconSrc,
      screenshots: cardScreenshots,
      showLabel:   true
    };

    return { fields: cardFields, opts: opts };
  },

  /**
   * Render the card container HTML (placeholder for BSVCard.build).
   */
  render: function() {
    return '<div id="s2-card-container" style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0;"></div>';
  },

  /**
   * Mount the BSVCard into #s2-card-container.
   * @param {Object} data — collected form data
   */
  mount: function(data) {
    var container = document.getElementById('s2-card-container');
    if (!container) return;

    var prep = this._prepareCard(data);
    var cardHTML = BSVCard.build(prep.fields, prep.opts);
    container.innerHTML = cardHTML;

    BSVCard.initTabs(container);
    BSVCard.scaleCard(container);
  }
};


/* ─────────────────────────────────────────────────────────────
   App.Panels.S3.card — S3 On-Chain Card View
   Placeholder — populated dynamically by App.Viewer.loadTx().
   ───────────────────────────────────────────────────────────── */
App.Panels.S3.card = {
  render: function() {
    return '<div id="p3-card-content"></div>';
  },

  mount: function() {
    /* Empty — populated dynamically by App.Viewer.loadTx() */
  }
};
