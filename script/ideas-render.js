/* ============================================================
   ideas-render.js — App Ideas accordion renderer (v1.1)
   ------------------------------------------------------------
   Standalone — fetches its own data, no dependency on json.js.
   Requires tile-render.js to be loaded first (setTileColour,
   buildSlotOverlay on window).

   Source:
     /api/ideas — on-chain records via Cloudflare Worker

   On-chain cards render a rich layout: ico tile (with colour,
   zoom, pan, overlay slots), description, features (lazy-loaded
   from WhatsOnChain on first expand), developer block, date.
   ============================================================ */

fetch('/api/ideas')
    .then(function (r) { return r.json(); })
    .catch(function () { return { items: [] }; })
.then(function (chainIdeas) {
    chainIdeas = chainIdeas || { items: [] };

    var ideasSec = document.getElementById('ideas');
    if (!ideasSec) return;
    ideasSec.innerHTML = '';

    var wrapper       = document.createElement('div');
    wrapper.className = 'ideas-section';

    /* ── Helper — accordion header (title + chevron) ───────── */
    function buildHeader(title) {
        var header       = document.createElement('div');
        header.className = 'idea-header';
        var titleSpan    = document.createElement('span');
        titleSpan.className = 'idea-title';
        titleSpan.textContent = title;
        header.innerHTML =
            '<span class="idea-chevron">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                   'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="6 9 12 15 18 9"/>' +
              '</svg>' +
            '</span>';
        header.insertBefore(titleSpan, header.firstChild);
        return header;
    }

    /* ── Helper — format D1 created_at as "DD MMM YYYY" ────── */
    function formatIdeaDate(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        if (isNaN(d)) return '';
        var months = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    /* ── Helper — append dev row if value is non-empty ─────── */
    function appendDevRow(container, label, value) {
        if (!value) return;
        var row = document.createElement('div');
        row.className = 'dev-row';
        var lbl = document.createElement('span');
        lbl.className = 'dev-label';
        lbl.textContent = label + ':';
        var val = document.createElement('span');
        val.className = 'dev-value';
        val.textContent = value;
        row.appendChild(lbl);
        row.appendChild(val);
        container.appendChild(row);
    }

    /* ── Build rich on-chain idea card ─────────────────────── */
    function buildOnChainCard(idea) {
        var card = document.createElement('div');
        card.className = 'idea-card is-on-chain';
        card.dataset.txid = idea.txid || '';

        card.appendChild(buildHeader(idea.name || '(untitled)'));

        var body = document.createElement('div');
        body.className = 'idea-body';

        /* Image strip — 5 slots: ss1, ss2, ico, ss3, ss4 */
        var stripWrap = document.createElement('div');
        stripWrap.className = 'idea-img-strip';
        var slotDefs = [
            { key: 'ico' },
            { key: 'ss1' },
            { key: 'ss2' },
            { key: 'ss3' },
            { key: 'ss4' }
        ];
        slotDefs.forEach(function (def) {
            var slot = document.createElement('div');
            slot.className = 'idea-img-slot slot-empty';
            slot.dataset.slot = def.key;

            if (def.key === 'ico') {
                /* Full tile structure — colour, zoom, pan, overlay slots */
                var wrap = document.createElement('div');
                wrap.className = 'icon-wrapper';

                /* Colour / opacity on the icon-wrapper — same element the
                   ::before colour layer targets in unified.css */
                if (typeof setTileColour === 'function') {
                    setTileColour(wrap, idea.colour1, idea.colour2, idea.opacity);
                }

                /* Pan + zoom */
                if (idea.zoom) wrap.style.setProperty('--icon-zoom', idea.zoom);
                if (idea.pan_x && idea.pan_x !== '0') wrap.style.setProperty('--icon-pan-x', idea.pan_x);
                if (idea.pan_y && idea.pan_y !== '0') wrap.style.setProperty('--icon-pan-y', idea.pan_y);

                var icoImg = document.createElement('img');
                icoImg.alt = idea.alt || idea.name || '';
                wrap.appendChild(icoImg);

                var lbl = document.createElement('div');
                lbl.className = 'icon-text';
                lbl.textContent = idea.name || '';
                wrap.appendChild(lbl);

                /* Slot overlay — no click stats for idea tiles */
                if (typeof buildSlotOverlay === 'function') {
                    buildSlotOverlay(wrap, idea.info, {}, '');
                }

                slot.appendChild(wrap);
            }

            stripWrap.appendChild(slot);
        });

        /* Expanded image container — injected after strip on slot click */
        var expandedWrap = document.createElement('div');
        expandedWrap.className = 'idea-img-expanded';
        expandedWrap.style.display = 'none';
        body.appendChild(stripWrap);
        body.appendChild(expandedWrap);

        /* Description */
        if (idea.description) {
            var p = document.createElement('p');
            p.textContent = idea.description;
            body.appendChild(p);
        }

        /* Features — empty placeholder, filled lazily on first expand */
        var featsWrap = document.createElement('div');
        featsWrap.className = 'idea-features';
        featsWrap.style.display = 'none';
        body.appendChild(featsWrap);

        /* Developer block */
        var hasDev = idea.wallet_id || idea.dev_twitter || idea.dev_github || idea.dev_bio;
        if (hasDev) {
            var devWrap = document.createElement('div');
            devWrap.className = 'idea-developer';
            var devHead = document.createElement('h4');
            devHead.textContent = 'Developer';
            devWrap.appendChild(devHead);
            appendDevRow(devWrap, 'Paymail', idea.wallet_id);
            appendDevRow(devWrap, 'Twitter', idea.dev_twitter);
            appendDevRow(devWrap, 'Github',  idea.dev_github);
            if (idea.dev_bio) {
                var bio = document.createElement('p');
                bio.className = 'dev-bio';
                bio.textContent = idea.dev_bio;
                devWrap.appendChild(bio);
            }
            body.appendChild(devWrap);
        }

        /* Upload date */
        var dateStr = formatIdeaDate(idea.created_at);
        if (dateStr) {
            var dateEl = document.createElement('div');
            dateEl.className = 'idea-date';
            dateEl.textContent = 'Uploaded: ' + dateStr;
            body.appendChild(dateEl);
        }

        card.appendChild(body);
        return card;
    }

    /* ── Render on-chain ideas ──────────────────────────────── */
    var chainItems = (chainIdeas && chainIdeas.items) || [];
    chainItems.forEach(function (idea) {
        wrapper.appendChild(buildOnChainCard(idea));
    });

    ideasSec.appendChild(wrapper);
})
.catch(function (err) { console.error('ideas-render.js load error:', err); });


/* ============================================================
   IDEA MEDIA HELPERS — standalone MAP decode (no App.Viewer dep)
   ============================================================ */

function _ideaDecodeScript(hex) {
    var parts = [], pos = 0;
    function rb() { var b = parseInt(hex.substr(pos, 2), 16); pos += 2; return b; }
    function rbs(n) {
        var a = new Uint8Array(n);
        for (var i = 0; i < n; i++) a[i] = rb();
        return a;
    }
    while (pos < hex.length) {
        var op = rb();
        if (op === 0x6a) { parts.push('OP_RETURN'); }
        else if (op === 0x00) { parts.push('OP_0'); }
        else if (op >= 0x01 && op <= 0x4b) {
            try { parts.push(new TextDecoder().decode(rbs(op))); } catch(e) { parts.push(''); }
        } else if (op === 0x4c) {
            var l1 = rb();
            try { parts.push(new TextDecoder().decode(rbs(l1))); } catch(e) { parts.push(''); }
        } else if (op === 0x4d) {
            var lo = rb(), hi = rb(), l2 = lo | (hi << 8);
            try { parts.push(new TextDecoder().decode(rbs(l2))); } catch(e) { parts.push(''); }
        } else { parts.push('OP_' + op.toString(16)); }
    }
    return parts;
}

var _IDEA_MAP_PREFIX = '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5';
function _ideaExtractMAP(parts) {
    var idx = -1;
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] === _IDEA_MAP_PREFIX) { idx = i; break; }
    }
    if (idx === -1 || parts[idx + 1] !== 'SET') return null;
    var fields = {};
    for (var j = idx + 2; j + 1 < parts.length; j += 2) {
        var key = parts[j], val = parts[j + 1];
        if (key === 'OP_0') continue;
        if (val === 'OP_0') val = '';
        fields[key] = val;
    }
    return fields;
}

/* Rate-limited WoC fetch queue — max 3 requests per second */
var _ideaFetchQueue    = [];
var _ideaFetchInFlight = 0;
var _IDEA_FETCH_MAX    = 3;

function _ideaFetchTx(txid) {
    return new Promise(function (resolve, reject) {
        _ideaFetchQueue.push({ txid: txid, resolve: resolve, reject: reject });
        _ideaDrainQueue();
    });
}

function _ideaDrainQueue() {
    if (_ideaFetchInFlight >= _IDEA_FETCH_MAX || !_ideaFetchQueue.length) return;
    var item = _ideaFetchQueue.shift();
    _ideaFetchInFlight++;
    fetch('https://api.whatsonchain.com/v1/bsv/main/tx/' + item.txid)
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(item.resolve, item.reject)
        .then(function () {
            _ideaFetchInFlight--;
            setTimeout(_ideaDrainQueue, 340);
        });
}


/* ============================================================
   LAZY FEATURE + IMAGE FETCH — on-chain ideas
   Fetches MAP transaction from WhatsOnChain on first expand.
   Cached on the card element so subsequent expands don't refetch.
   ============================================================ */
function fetchIdeaFeatures(card) {
    if (!card || card.dataset.featuresLoaded === 'true') return;
    if (card.dataset.featuresLoading === 'true') return;
    var txid = card.dataset.txid;
    if (!txid) return;

    card.dataset.featuresLoading = 'true';

    _ideaFetchTx(txid).then(function (tx) {
        if (!tx || !tx.vout) return;
        var fields = null;
        for (var i = 0; i < tx.vout.length; i++) {
            var hex = tx.vout[i].scriptPubKey && tx.vout[i].scriptPubKey.hex;
            if (!hex) continue;
            var parts = _ideaDecodeScript(hex);
            var f = _ideaExtractMAP(parts);
            if (f) { fields = f; break; }
        }
        if (!fields) return;

        /* Features */
        var feats = [];
        for (var n = 1; n <= 6; n++) {
            var v = fields['feature_' + n];
            if (v) feats.push(v);
        }
        if (feats.length) {
            var wrap = card.querySelector('.idea-features');
            if (wrap) {
                wrap.innerHTML = '';
                var h = document.createElement('h4');
                h.textContent = 'Features';
                wrap.appendChild(h);
                var ol = document.createElement('ol');
                feats.forEach(function (feat) {
                    var li = document.createElement('li');
                    li.textContent = feat;
                    ol.appendChild(li);
                });
                wrap.appendChild(ol);
                wrap.style.display = '';
            }
        }

        /* Image strip — icon + ss1..ss4 from MAP fields */
        var imgMap = {
            ico: fields['icon_txid'] || '',
            ss1: fields['ss1_txid']  || '',
            ss2: fields['ss2_txid']  || '',
            ss3: fields['ss3_txid']  || '',
            ss4: fields['ss4_txid']  || ''
        };
        var strip = card.querySelector('.idea-img-strip');
        if (strip) {
            Object.keys(imgMap).forEach(function (key) {
                var txidVal = imgMap[key];
                if (!txidVal || txidVal.length < 64) return;
                var slot = strip.querySelector('[data-slot="' + key + '"]');
                if (!slot) return;

                if (key === 'ico') {
                    /* ico — src on existing icon-wrapper img; zoom/pan already set
                       at card build time from /api/ideas fields */
                    var icoImg = slot.querySelector('.icon-wrapper img');
                    if (!icoImg) return;
                    icoImg.src = 'https://ordfs.network/' + txidVal;
                    icoImg.onload = function () {
                        slot.classList.remove('slot-empty');
                        strip.classList.add('has-images');
                        var icoWrap = slot.querySelector('.icon-wrapper');
                        if (icoWrap) {
                            icoWrap.style.transform = '';
                            var slotW = slot.offsetWidth;
                            var wrapW = icoWrap.offsetWidth;
                            if (slotW && wrapW) {
                                icoWrap.style.transformOrigin = 'top left';
                                icoWrap.style.transform = 'scale(' + (slotW / wrapW) + ')';
                            }
                        }
                    };
                } else {
                    /* ss1-ss4 — create img, apply zoom/pan/alt from MAP fields */
                    var ssNum  = key.slice(2);   /* '1','2','3','4' */
                    var ssZoom = fields['ss' + ssNum + '_zoom']     || '1';
                    var ssPanX = fields['ss' + ssNum + '_pan_x']    || '0';
                    var ssPanY = fields['ss' + ssNum + '_pan_y']    || '0';
                    var ssAlt  = fields['ss' + ssNum + '_alt_text'] || key;

                    var ssImg = document.createElement('img');
                    ssImg.src = 'https://ordfs.network/' + txidVal;
                    ssImg.alt = ssAlt;
                    if (ssZoom && ssZoom !== '1') ssImg.style.setProperty('--icon-zoom', ssZoom);
                    if (ssPanX && ssPanX !== '0') ssImg.style.setProperty('--icon-pan-x', ssPanX);
                    if (ssPanY && ssPanY !== '0') ssImg.style.setProperty('--icon-pan-y', ssPanY);
                    ssImg.onload = function () {
                        slot.classList.remove('slot-empty');
                        strip.classList.add('has-images');
                    };
                    slot.appendChild(ssImg);
                }
            });
        }
    }).catch(function () {
        /* WoC fetch failures are non-fatal */
    }).then(function () {
        card.dataset.featuresLoaded  = 'true';
        card.dataset.featuresLoading = 'false';
    });
}


/* ============================================================
   ACCORDION TOGGLE — event delegation
   ============================================================ */
document.addEventListener('click', function (e) {
    var header = e.target.closest('.idea-header');
    if (!header) return;
    var card = header.closest('.idea-card');
    if (!card) return;
    var body = card.querySelector('.idea-body');
    var opening = !card.classList.contains('is-open');
    card.classList.toggle('is-open');
    if (body) {
        if (opening) {
            body.style.maxHeight = body.scrollHeight + 'px';
            body.addEventListener('transitionend', function onOpen() {
                body.removeEventListener('transitionend', onOpen);
                if (card.classList.contains('is-open')) {
                    body.style.maxHeight = 'none';
                }
            });
        } else {
            body.style.maxHeight = body.scrollHeight + 'px';
            requestAnimationFrame(function () {
                body.style.maxHeight = '0';
            });
        }
    }
    if (opening && card.classList.contains('is-on-chain')) {
        fetchIdeaFeatures(card);
    }
});


/* ============================================================
   IMAGE EXPAND / COLLAPSE — macOS-style spring animation
   ============================================================ */
document.addEventListener('click', function (e) {
    var slot = e.target.closest('.idea-img-slot');
    if (!slot || slot.classList.contains('slot-empty')) return;

    var card     = slot.closest('.idea-card');
    var body     = card && card.querySelector('.idea-body');
    var strip    = card && card.querySelector('.idea-img-strip');
    var expanded = card && card.querySelector('.idea-img-expanded');
    if (!card || !body || !strip || !expanded) return;

    if (expanded.dataset.activeSlot === slot.dataset.slot && expanded.style.display !== 'none') {
        _collapseIdeaImg(expanded);
        return;
    }

    expanded.className = 'idea-img-expanded';
    expanded.style.marginLeft = '';
    expanded.dataset.activeSlot = slot.dataset.slot;
    expanded.innerHTML = '';

    if (slot.dataset.slot === 'ico') {
        var srcWrap = slot.querySelector('.icon-wrapper');
        if (!srcWrap) return;
        var clonedWrap = srcWrap.cloneNode(true);
        clonedWrap.style.transform = '';
        clonedWrap.style.transformOrigin = 'top left';
        expanded.appendChild(clonedWrap);
        requestAnimationFrame(function () {
            var expW  = expanded.offsetWidth;
            var wrapW = clonedWrap.offsetWidth;
            if (expW && wrapW) {
                clonedWrap.style.transform = 'scale(' + (expW / wrapW) + ')';
            }
        });
    } else {
        var img = slot.querySelector('img');
        if (!img) return;
        /* Clone preserves inline CSS custom properties (--icon-zoom/pan-x/pan-y)
           so the expanded image inherits the exact mini configuration —
           single source of truth, no field re-reading. */
        expanded.appendChild(img.cloneNode(true));
    }

    expanded.style.display = '';
    expanded.classList.add('is-opening');
    expanded.addEventListener('animationend', function onOpened() {
        expanded.removeEventListener('animationend', onOpened);
        expanded.classList.remove('is-opening');
    });
});

document.addEventListener('click', function (e) {
    if (e.target.closest('.idea-img-slot') || e.target.closest('.idea-img-expanded')) return;
    document.querySelectorAll('.idea-img-expanded').forEach(function (expanded) {
        if (expanded.style.display !== 'none') {
            _collapseIdeaImg(expanded);
        }
    });
});

function _collapseIdeaImg(expanded) {
    expanded.classList.add('is-closing');
    expanded.addEventListener('animationend', function onClosed() {
        expanded.removeEventListener('animationend', onClosed);
        expanded.classList.remove('is-closing');
        expanded.style.display = 'none';
        expanded.dataset.activeSlot = '';
    });
}
