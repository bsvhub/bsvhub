/* ============================================================
   json.js — Unified JSON loader (v1.1)
   ------------------------------------------------------------
   Fetches all data sources in parallel and builds every
   dynamic section of the page:
     1. about.json      → About / Tip / Contact header sections
     2. list.json       → Curated icon-grid tab sections
     3. ideas.json      → App Ideas accordion cards
     4. /api/catalog    → On-chain entries (trusted wallets only);
                          merged with list.json — static entries win on dedup.
   ============================================================ */

/* ============================================================
   OVERLAY CONFIG — user-togglable tile overlay visibility
   Persisted to localStorage. Menu rendered after DOM build.
   ============================================================ */
var _overlayDefaults = {
    clicks: true,
    s0: true,    // slot 0: protocol (BRC-100)
    s1: true,    // slot 1: source (UP-LINK)
    s2: true,    // slot 2: open-src (OPEN-SRC)
    s3: true,    // slot 3: status (ALPHA, BETA, etc.)
    s4: true     // slot 4: reserved
};
var _overlayLabels = {
    clicks: "Click Count",
    s0: "BRC-100",
    s1: "Up-LINK",
    s2: "Open Source",
    s3: "Status",
    s4: "Reserved"
};
var _overlayConfig = (function () {
    try {
        var saved = JSON.parse(localStorage.getItem("overlay-config"));
        if (saved && typeof saved === "object") {
            // merge with defaults so new keys are always present
            var cfg = {};
            for (var k in _overlayDefaults) cfg[k] = saved[k] !== undefined ? saved[k] : _overlayDefaults[k];
            return cfg;
        }
    } catch (e) {}
    return JSON.parse(JSON.stringify(_overlayDefaults));
})();

function _saveOverlayConfig() {
    try { localStorage.setItem("overlay-config", JSON.stringify(_overlayConfig)); } catch (e) {}
}

function _applyOverlayVisibility() {
    var keys = Object.keys(_overlayConfig);
    keys.forEach(function (key) {
        var show = _overlayConfig[key];
        var sel = key === "clicks" ? ".tile-label-clicks" : ".tile-label-" + key;
        var els = document.querySelectorAll(sel);
        for (var i = 0; i < els.length; i++) {
            els[i].style.display = show ? "" : "none";
        }
    });
}

/* ============================================================
   HELPER — setTileColour
   Passes colour1, colour2, opacity from list.json down to the
   CSS ::before layer via custom properties on the <a> element.

   The ::before layer in unified.css reads:
     background: var(--tile-bg, transparent)
     opacity:    var(--tile-opacity, 1)

   Rules:
     colour1 + colour2  → linear-gradient(135deg, c1, c2)
     colour1 only       → solid colour
     neither            → --tile-bg not set (transparent, base shows)
     opacity            → --tile-opacity (0.0–1.0), any CSS colour format
                          including named colours work natively here
============================================================ */
function setTileColour(a, colour1, colour2, opacity) {
    var hasC1 = colour1 && colour1.trim();
    var hasC2 = colour2 && colour2.trim();

    if (!hasC1 && !hasC2) return;   // nothing to set — CSS default applies

    var bg = hasC1 && hasC2
        ? 'linear-gradient(135deg, ' + colour1.trim() + ', ' + colour2.trim() + ')'
        : colour1.trim();

    a.style.setProperty('--tile-bg', bg);

    if (opacity !== undefined && opacity !== null && opacity !== '') {
        a.style.setProperty('--tile-opacity', opacity);
    }
}

/* ── list.json fetch — capture Last-Modified header alongside JSON ── */
var _listLastModified = null;

Promise.all([
    fetch("about.json").then(function (r) { return r.json(); }),
    fetch("list.json").then(function (r) {
        /* Grab the Last-Modified header before consuming the body */
        var lm = r.headers.get("Last-Modified");
        if (lm) {
            var d = new Date(lm);
            if (!isNaN(d)) {
                /* Format: "2nd March 2026" */
                var day    = d.getDate();
                var suffix = (day === 1 || day === 21 || day === 31) ? "st"
                           : (day === 2 || day === 22)               ? "nd"
                           : (day === 3 || day === 23)               ? "rd" : "th";
                var months = ["January","February","March","April","May","June",
                              "July","August","September","October","November","December"];
                _listLastModified = day + suffix + " " + months[d.getMonth()] + " " + d.getFullYear();
            }
        }
        return r.json();
    }),
    fetch("ideas.json").then(function (r) { return r.json(); }),
    /* On-chain catalog — fails silently so a worker outage never breaks the page */
    fetch("/api/catalog").then(function (r) { return r.json(); }).catch(function () { return { items: [] }; }),
    /* Link click stats — single fetch, used to stamp count badges on tiles */
    fetch("/api/link-stats").then(function (r) { return r.json(); }).catch(function () { return { stats: {} }; }),
    /* On-chain ideas — dedicated endpoint, fails silently so the fallback (ideas.json) still renders */
    fetch("/api/ideas").then(function (r) { return r.json(); }).catch(function () { return { items: [] }; })
])
.then(function (results) {
    var about       = results[0];
    var data        = results[1];
    var ideasData   = results[2];
    var catalogData = results[3];   /* { items: [...] } — pre-mapped by /api/catalog */
    var clickStats  = results[4].stats || {};  /* { url: count } map for badge display */
    var chainIdeas  = results[5] || { items: [] };  /* { items: [...] } — raw shape from /api/ideas */

    /* ── Merge on-chain catalog entries into static list.json items ────
       Dedup by href — static list.json always wins so curated entries are
       never displaced by an on-chain submission for the same URL.
       On-chain items come pre-shaped by the worker (same schema as list.json)
       so the tab-building loop below requires no special handling.          */
    var staticHrefs = new Set(data.items.map(function (i) {
        return (i.href || '').toLowerCase();
    }));
    var onChainItems = (catalogData.items || []).filter(function (item) {
        return item && item.href && !staticHrefs.has(item.href.toLowerCase());
    });
    data.items = data.items.concat(onChainItems);

    /* ── Dynamic 'Chain' tab button ─────────────────────────────────────
       WHY: the tab-bar is static HTML; we only inject this button when
       there are entries that need it, so it never appears empty.
       tabs.js has already bound existing buttons — we wire this one manually. */
    var hasChain = onChainItems.some(function (i) { return i.tab === 'chain'; });
    if (hasChain) {
        var tabBar = document.querySelector('nav.tab-bar');
        if (tabBar && !document.querySelector('[data-target="chain"]')) {
            var chainBtn = document.createElement('button');
            chainBtn.className = 'tab-btn';
            chainBtn.dataset.target = 'chain';
            chainBtn.innerHTML = '<span>Chain</span>';
            chainBtn.addEventListener('click', function () { activateTab('chain', chainBtn); });
            /* Insert before the search container — keeps it with the other tab buttons */
            var searchContainer = tabBar.querySelector('.search-container');
            tabBar.insertBefore(chainBtn, searchContainer || null);
        }
    }

    var container = document.getElementById("content-scale");

    /* --------------------------------------------------------
       1. HEADER SECTIONS (About / Tip / Contact)
          Source: about.json
    -------------------------------------------------------- */
    Object.entries(about).forEach(function (entry) {
        var id      = entry[0];
        var section = entry[1];
        var sec = document.createElement("section");
        sec.id        = id + "-section";
        sec.className = "tab-content header-tab-content";
        if (section.html) sec.innerHTML = section.html;
        container.appendChild(sec);
    });

    /* ── Broken-log overlay — delegated to iframe-overlay.js ─────
       WHY here: #broken-log-link only exists after about.json HTML
       is injected above, so attributes must be set at this point.
       WHY target="_blank": fallback if iframe-overlay.js is absent. */
    (function () {
        var logLink = document.getElementById("broken-log-link");
        if (!logLink) return;
        logLink.dataset.iframe = "true";
        logLink.target         = "_blank";
    })();

    /* ── Counters — spans now exist in the DOM ───────────────── */
    /* Link count: data already loaded above, no extra fetch needed */
    var lcEl = document.getElementById("link-counter");
    var _totalLinks = data.items.length;

    /* Visitor count: single fetch on page load via Cloudflare Worker */
    fetch("/api/count")
        .then(function (res) { return res.json(); })
        .then(function (d) {
            var vcEl = document.getElementById("visit-counter");
            if (vcEl) vcEl.textContent = Number(d.count).toLocaleString();
        });

    /* Broken link count */
    fetch("/api/linkcheck")
        .then(function (res) { return res.json(); })
        .then(function (d) {
            var el = document.getElementById("broken-counter");
            if (!el) return;
            var count = d.broken;
            if (lcEl) lcEl.textContent = (_totalLinks - count).toLocaleString();
            el.textContent = count === 0 ? "none ✓" : count;
            if (count > 0) el.style.color = "#ff6b6b";
        })
        .catch(function () {
            var el = document.getElementById("broken-counter");
            if (el) el.textContent = "unavailable";
        });

    /* Overwrite the hardcoded date with the list.json file timestamp.
       Falls back gracefully — if the header isn't available (e.g. some
       hosts strip it) the date from about.json stays as-is.           */
    if (_listLastModified) {
        var el = document.getElementById("last-update-date");
        if (el) el.textContent = _listLastModified;
    }

    /* --------------------------------------------------------
       2. ICON-GRID TAB SECTIONS
          Source: list.json
    -------------------------------------------------------- */

    // Collect all unique tab names
    var tabNames = new Set();
    data.items.forEach(function (item) {
        item.tab.split(";").forEach(function (t) {
            tabNames.add(t.trim());
        });
    });

    tabNames.forEach(function (tabName) {
        var sec = document.createElement("section");
        sec.id        = tabName;
        sec.className = "tab-content";

        var ul = document.createElement("ul");
        ul.className = "icon-grid";

        // Filter + sort items for this tab
        var tabItems = data.items.filter(function (item) {
            return item.tab.split(";").map(function (t) {
                return t.trim();
            }).includes(tabName);
        });

        tabItems.sort(function (a, b) {
            return (a.text || "").toLowerCase()
                .localeCompare((b.text || "").toLowerCase());
        });

        // Build each icon entry
        tabItems.forEach(function (item) {
            var li   = document.createElement("li");
            var a    = document.createElement("a");
            a.href   = item.href || "#";

            /* iframe:true → open in overlay; popup:true → open in popup window;
               else → new tab. iframe takes priority if both are set. */
            if (item.iframe === true) {
                a.dataset.iframe = "true";
                a.target = "_blank";  // WHY: fallback if iframe-overlay.js absent — opens normally
                /* WHY: pass per-entry bg colour to overlay; read on click in iframe-overlay.js.
                   Absent = no attribute set = overlay resets to CSS default automatically. */
                if (item.iframe_bg) {
                    a.dataset.iframeBg = item.iframe_bg;
                }
            } else if (item.popup === true) {
                /* WHY intercept here: window.open() must be called in the click
                   handler to avoid popup blockers — wiring it on the <a> directly
                   keeps it as a direct user-gesture response. */
                (function (url, w, h) {
                    /* CONFIG defaults — used when popup_w / popup_h are absent */
                    var POP_W = 900;
                    var POP_H = 700;
                    var pw = w || POP_W;
                    var ph = h || POP_H;
                    a.addEventListener("click", function (e) {
                        e.preventDefault();
                        window.open(url, "_blank",
                            "width=" + pw + ",height=" + ph +
                            ",toolbar=no,menubar=no,location=no,status=no,resizable=yes");
                    });
                }(item.href, item.popup_w, item.popup_h));
            } else {
                a.target = "_blank";
            }

            var wrap      = document.createElement("div");
            wrap.className = "icon-wrapper";
            if (item.tooltip) wrap.dataset.tooltip = item.tooltip;
            if (item.zoom)    wrap.style.setProperty("--icon-zoom", item.zoom);

            // ---- colour / opacity --------------------------------
            // colour1, colour2, opacity are all optional JSON fields.
            // setTileColour() sets CSS custom properties on <a> which
            // are read by the ::before colour layer in unified.css.
            // Named colours, hex, rgb, rgba all work natively.
            // No-op when nothing is set — CSS default applies.
            setTileColour(a, item.colour1, item.colour2, item.opacity);

            // Pan offset — only set when non-zero so static list.json tiles
            // inherit the CSS default (0) and are completely unaffected.
            // WHY on wrap not on <a>: the transform lives on the <img> inside
            // .icon-wrapper, and CSS custom properties are inherited downward.
            if (item.pan_x && item.pan_x !== '0') {
                wrap.style.setProperty('--icon-pan-x', item.pan_x);
            }
            if (item.pan_y && item.pan_y !== '0') {
                wrap.style.setProperty('--icon-pan-y', item.pan_y);
            }

            // Main icon image
            var img = document.createElement("img");
            img.src = item.img || "";
            img.alt = item.alt || "";
            wrap.appendChild(img);

            // 6-slot text overlay grid
            // LEFT: slots 0,1,2   RIGHT: click-count, slots 3,4
            var slots = (item.info || '').split(';');
            while (slots.length < 5) slots.push('');

            var leftCol  = document.createElement("div");
            leftCol.className = "tile-overlay-left";
            var rightCol = document.createElement("div");
            rightCol.className = "tile-overlay-right";

            // Click counter — always first in right column
            var clickCount = clickStats[item.href] || 0;
            var counterDiv       = document.createElement("div");
            counterDiv.className = "tile-label tile-label-clicks";
            counterDiv.textContent = clickCount || '0';
            counterDiv.dataset.slot = "clicks";
            rightCol.appendChild(counterDiv);

            // Left slots: 0, 1, 2
            [0, 1, 2].forEach(function (i) {
                var val = (slots[i] || '').trim();
                var d       = document.createElement("div");
                d.className = "tile-label tile-label-s" + i;
                d.textContent = val;
                d.dataset.slot = String(i);
                if (!val) d.style.visibility = "hidden";
                leftCol.appendChild(d);
            });

            // Right slots: 3, 4 (after click counter)
            [3, 4].forEach(function (i) {
                var val = (slots[i] || '').trim();
                var d       = document.createElement("div");
                d.className = "tile-label tile-label-s" + i;
                d.textContent = val;
                d.dataset.slot = String(i);
                if (!val) d.style.visibility = "hidden";
                rightCol.appendChild(d);
            });

            wrap.appendChild(leftCol);
            wrap.appendChild(rightCol);

            // Icon label
            var txt       = document.createElement("div");
            txt.className = "icon-text";
            txt.textContent = item.text || "";
            wrap.appendChild(txt);

            a.appendChild(wrap);
            li.appendChild(a);
            ul.appendChild(li);
        });

        sec.appendChild(ul);
        container.appendChild(sec);
    });

    /* --------------------------------------------------------
       2b. 404 REPORTER — intercept icon-grid link clicks
           HEAD-checks the href; if 404, silently reports to
           the Worker. Does not delay or block navigation.
    -------------------------------------------------------- */
    document.getElementById("content-scale").addEventListener("click", function (e) {
        var a = e.target.closest("a[href]");
        if (!a || !a.href || a.href === "#" || a.dataset.target) return;

        var href = a.href;
        var text = (a.querySelector(".icon-text") || {}).textContent || href;

        /* ── Click counter — fire-and-forget POST + live badge update ── */
        fetch("/api/link-click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: href }),
        }).catch(function () {});

        var countEl = a.querySelector(".tile-label-clicks");
        if (countEl) {
            var cur = parseInt(countEl.textContent) || 0;
            countEl.textContent = cur + 1;
        }

        fetch("/api/check-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ href: href }),
        })
            .then(function (res) { return res.json(); })
            .then(function (d) {
                if (d.status === 404) {
                    fetch("/api/report-broken", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ href: href, text: text }),
                    }).catch(function () {});
                } else if (d.status !== "error") {
                    fetch("/api/report-fixed", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ href: href }),
                    }).catch(function () {});
                }
            })
            .catch(function () {});
    });

    /* --------------------------------------------------------
       3. APP IDEAS ACCORDION
          Sources (in priority order):
            1. /api/ideas   — on-chain records via Cloudflare worker
            2. ideas.json   — static fallback for ideas not yet
                              re-submitted through up-link

          On-chain ideas render a rich detail view (description,
          features pulled lazily from WhatsOnChain, developer
          block, upload date). Fallback ideas keep the original
          simple <p> body. Merge dedups by name (case-insensitive)
          so static entries never shadow on-chain entries.
    -------------------------------------------------------- */
    var ideasSec = document.getElementById("ideas");
    if (ideasSec) {
        ideasSec.innerHTML = "";            // clear "Loading ideas…" placeholder

        var wrapper       = document.createElement("div");
        wrapper.className = "ideas-section";

        /* Helper — build the accordion header (title + chevron) */
        function buildHeader(title) {
            var header       = document.createElement("div");
            header.className = "idea-header";
            var titleSpan    = document.createElement("span");
            titleSpan.className = "idea-title";
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

        /* Helper — format a D1 created_at timestamp as "DD MMM YYYY" */
        function formatIdeaDate(ts) {
            if (!ts) return "";
            var d = new Date(ts);
            if (isNaN(d)) return "";
            var months = ["Jan","Feb","Mar","Apr","May","Jun",
                          "Jul","Aug","Sep","Oct","Nov","Dec"];
            return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
        }

        /* Helper — append a dev row to a container only if value is non-empty */
        function appendDevRow(container, label, value) {
            if (!value) return;
            var row = document.createElement("div");
            row.className = "dev-row";
            var lbl = document.createElement("span");
            lbl.className = "dev-label";
            lbl.textContent = label + ":";
            var val = document.createElement("span");
            val.className = "dev-value";
            val.textContent = value;
            row.appendChild(lbl);
            row.appendChild(val);
            container.appendChild(row);
        }

        /* Build a rich on-chain idea card with the detail layout.
           Features are fetched lazily on first expand — see the
           accordion toggle handler further down. */
        function buildOnChainCard(idea) {
            var card = document.createElement("div");
            card.className = "idea-card is-on-chain";
            card.dataset.txid = idea.txid || "";

            card.appendChild(buildHeader(idea.name || "(untitled)"));

            var body = document.createElement("div");
            body.className = "idea-body";

            /* Image strip — 5 slots: ss1, ss2, ico, ss3, ss4.
               Hidden until at least one image loads (filled lazily on first expand). */
            var stripWrap = document.createElement("div");
            stripWrap.className = "idea-img-strip";
            var slotDefs = [
                { key: "ico" },
                { key: "ss1" },
                { key: "ss2" },
                { key: "ss3" },
                { key: "ss4" }
            ];
            slotDefs.forEach(function (def) {
                var slot = document.createElement("div");
                slot.className = "idea-img-slot slot-empty";
                slot.dataset.slot = def.key;
                stripWrap.appendChild(slot);
            });
            /* Expanded image container — injected after the strip when a slot is clicked */
            var expandedWrap = document.createElement("div");
            expandedWrap.className = "idea-img-expanded";
            expandedWrap.style.display = "none";
            body.appendChild(stripWrap);
            body.appendChild(expandedWrap);

            /* Description */
            if (idea.description) {
                var p = document.createElement("p");
                p.textContent = idea.description;
                body.appendChild(p);
            }

            /* Features — empty placeholder, filled lazily on first expand */
            var featsWrap = document.createElement("div");
            featsWrap.className = "idea-features";
            featsWrap.style.display = "none";   // hidden until populated
            body.appendChild(featsWrap);

            /* Developer block — only rendered if at least one field present */
            var hasDev = idea.wallet_id || idea.dev_twitter || idea.dev_github || idea.dev_bio;
            if (hasDev) {
                var devWrap = document.createElement("div");
                devWrap.className = "idea-developer";
                var devHead = document.createElement("h4");
                devHead.textContent = "Developer";
                devWrap.appendChild(devHead);
                appendDevRow(devWrap, "Paymail", idea.wallet_id);
                appendDevRow(devWrap, "Twitter", idea.dev_twitter);
                appendDevRow(devWrap, "Github",  idea.dev_github);
                if (idea.dev_bio) {
                    var bio = document.createElement("p");
                    bio.className = "dev-bio";
                    bio.textContent = idea.dev_bio;
                    devWrap.appendChild(bio);
                }
                body.appendChild(devWrap);
            }

            /* Upload date — from worker created_at */
            var dateStr = formatIdeaDate(idea.created_at);
            if (dateStr) {
                var dateEl = document.createElement("div");
                dateEl.className = "idea-date";
                dateEl.textContent = "Uploaded: " + dateStr;
                body.appendChild(dateEl);
            }

            card.appendChild(body);
            return card;
        }

        /* Build the legacy ideas.json fallback card — title + body only. */
        function buildFallbackCard(idea) {
            var card = document.createElement("div");
            card.className = "idea-card";
            card.appendChild(buildHeader(idea.title));
            var body = document.createElement("div");
            body.className = "idea-body";
            var p = document.createElement("p");
            p.textContent = idea.body;
            body.appendChild(p);
            card.appendChild(body);
            return card;
        }

        /* ── Merge on-chain + fallback ────────────────────────
           On-chain entries take priority. Fallback entries are
           only appended if their title doesn't match an on-chain
           name (case-insensitive).                              */
        var chainItems = (chainIdeas && chainIdeas.items) || [];
        var chainNames = new Set(chainItems.map(function (i) {
            return (i.name || "").toLowerCase().trim();
        }));

        chainItems.forEach(function (idea) {
            wrapper.appendChild(buildOnChainCard(idea));
        });

        var fallback = (ideasData && ideasData.ideas) || [];
        fallback.forEach(function (idea) {
            var key = (idea.title || "").toLowerCase().trim();
            if (!chainNames.has(key)) {
                wrapper.appendChild(buildFallbackCard(idea));
            }
        });

        ideasSec.appendChild(wrapper);
    }

    /* --------------------------------------------------------
       4. OVERLAY TOGGLE MENU
          Gear emoji inserted between 3rd and 4th CRT swatch.
          Dropdown opens above tabs/tooltip layer (z>1000).
    -------------------------------------------------------- */
    (function () {
        var crtBar = document.getElementById("crt-mode-bar");
        if (!crtBar) return;

        var swatches = crtBar.querySelectorAll(".crt-swatch");
        if (swatches.length < 4) return;

        var menuWrap       = document.createElement("div");
        menuWrap.className = "overlay-menu-wrap";

        var btn       = document.createElement("button");
        btn.className = "overlay-menu-btn";
        btn.title     = "Toggle overlays";
        btn.textContent = "\u2699"; // ⚙ gear emoji
        menuWrap.appendChild(btn);

        var dropdown       = document.createElement("div");
        dropdown.className = "overlay-menu-dropdown";

        Object.keys(_overlayConfig).forEach(function (key) {
            var label       = document.createElement("label");
            label.className = "overlay-menu-item";
            var cb       = document.createElement("input");
            cb.type      = "checkbox";
            cb.checked   = _overlayConfig[key];
            cb.dataset.overlayKey = key;
            cb.addEventListener("change", function () {
                _overlayConfig[key] = cb.checked;
                _saveOverlayConfig();
                _applyOverlayVisibility();
            });
            label.appendChild(cb);
            label.appendChild(document.createTextNode(" " + _overlayLabels[key]));
            dropdown.appendChild(label);
        });

        /* Append dropdown as sibling of #tooltip-display inside #top-ui */
        var topUi = document.getElementById("tooltip-display");
        if (topUi && topUi.parentNode) {
            topUi.parentNode.appendChild(dropdown);
        } else {
            document.body.appendChild(dropdown);
        }

        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var isOpen = dropdown.classList.toggle("open");
            if (isOpen) {
                var rect = btn.getBoundingClientRect();
                dropdown.style.top  = (rect.bottom + 4) + "px";
                dropdown.style.left = (rect.left + rect.width / 2 - 70) + "px";
            }
        });
        dropdown.addEventListener("mouseleave", function () {
            dropdown.classList.remove("open");
        });
        document.addEventListener("click", function (e) {
            if (!menuWrap.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });

        /* Insert between 3rd and 4th swatch: [c1][c2][c3] ⚙ [c4][c5][c6] */
        crtBar.insertBefore(menuWrap, swatches[3]);

        _applyOverlayVisibility();
    })();

    /* --------------------------------------------------------
       5. ACTIVATE DEFAULT TAB (Apps)
    -------------------------------------------------------- */
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            var appsBtn = document.querySelector('.tab-btn[data-target="app"]');
            if (appsBtn) activateTab(appsBtn.dataset.target, appsBtn);
            if (typeof positionContent === "function") positionContent();
        });
    });

})
.catch(function (err) { console.error("json.js load error:", err); });


/* ============================================================
   IDEA MEDIA HELPERS — standalone MAP decode (no App.Viewer dep)
   ============================================================ */

/* Decode a hex OP_RETURN script into an array of string parts */
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
        if (op === 0x6a) { parts.push("OP_RETURN"); }
        else if (op === 0x00) { parts.push("OP_0"); }
        else if (op >= 0x01 && op <= 0x4b) {
            try { parts.push(new TextDecoder().decode(rbs(op))); } catch(e) { parts.push(""); }
        } else if (op === 0x4c) {
            var l1 = rb();
            try { parts.push(new TextDecoder().decode(rbs(l1))); } catch(e) { parts.push(""); }
        } else if (op === 0x4d) {
            var lo = rb(), hi = rb(), l2 = lo | (hi << 8);
            try { parts.push(new TextDecoder().decode(rbs(l2))); } catch(e) { parts.push(""); }
        } else { parts.push("OP_" + op.toString(16)); }
    }
    return parts;
}

/* Extract MAP key-value fields from decoded script parts */
var _IDEA_MAP_PREFIX = "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5";
function _ideaExtractMAP(parts) {
    var idx = -1;
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] === _IDEA_MAP_PREFIX) { idx = i; break; }
    }
    if (idx === -1 || parts[idx + 1] !== "SET") return null;
    var fields = {};
    for (var j = idx + 2; j + 1 < parts.length; j += 2) {
        var key = parts[j], val = parts[j + 1];
        if (key === "OP_0") continue;
        if (val === "OP_0") val = "";
        fields[key] = val;
    }
    return fields;
}

/* Rate-limited WoC fetch queue — max 3 requests per second */
var _ideaFetchQueue = [];
var _ideaFetchInFlight = 0;
var _IDEA_FETCH_MAX = 3;

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
    fetch("https://api.whatsonchain.com/v1/bsv/main/tx/" + item.txid)
        .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        })
        .then(item.resolve, item.reject)
        .then(function () {
            _ideaFetchInFlight--;
            /* Respect the 3 req/s limit — drain after 340 ms */
            setTimeout(_ideaDrainQueue, 340);
        });
}


/* ============================================================
   LAZY FEATURE + IMAGE FETCH — on-chain ideas
   Fetches the MAP transaction from WhatsOnChain on first expand,
   extracts features and image txids, and populates the card.
   Cached on the card element so subsequent expands don't refetch.
   Rate-limited to 3 requests/second via _ideaFetchTx queue.
   ============================================================ */
function fetchIdeaFeatures(card) {
    if (!card || card.dataset.featuresLoaded === "true") return;
    if (card.dataset.featuresLoading === "true") return;
    var txid = card.dataset.txid;
    if (!txid) return;

    card.dataset.featuresLoading = "true";

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

        /* ── Features ────────────────────────────────────────── */
        var feats = [];
        for (var n = 1; n <= 6; n++) {
            var v = fields["feature_" + n];
            if (v) feats.push(v);
        }
        if (feats.length) {
            var wrap = card.querySelector(".idea-features");
            if (wrap) {
                wrap.innerHTML = "";
                var h = document.createElement("h4");
                h.textContent = "Features";
                wrap.appendChild(h);
                var ol = document.createElement("ol");
                feats.forEach(function (feat) {
                    var li = document.createElement("li");
                    li.textContent = feat;
                    ol.appendChild(li);
                });
                wrap.appendChild(ol);
                wrap.style.display = "";
            }
        }

        /* ── Image strip — icon + ss1..ss4 from MAP fields ──── */
        var imgMap = {
            ico: fields["icon_txid"] || "",
            ss1: fields["ss1_txid"]  || "",
            ss2: fields["ss2_txid"]  || "",
            ss3: fields["ss3_txid"]  || "",
            ss4: fields["ss4_txid"]  || ""
        };
        var strip = card.querySelector(".idea-img-strip");
        if (strip) {
            Object.keys(imgMap).forEach(function (key) {
                var txidVal = imgMap[key];
                if (!txidVal || txidVal.length < 64) return;
                var slot = strip.querySelector('[data-slot="' + key + '"]');
                if (!slot) return;
                var img = document.createElement("img");
                img.src = "https://ordfs.network/" + txidVal;
                img.alt = key;
                img.onload = function () {
                    slot.classList.remove("slot-empty");
                    strip.classList.add("has-images");
                };
                slot.appendChild(img);
            });
        }
    }).catch(function () {
        /* WoC fetch failures are non-fatal — card still shows
           name, description, dev block, and date. */
    }).then(function () {
        card.dataset.featuresLoaded  = "true";
        card.dataset.featuresLoading = "false";
    });
}


/* ============================================================
   ACCORDION TOGGLE — event delegation
   Handles .idea-header clicks on dynamically built cards.
   Registered once here; works regardless of when cards render.
   On first expand of an on-chain card, triggers the lazy
   feature fetch.
   ============================================================ */
document.addEventListener("click", function (e) {
    var header = e.target.closest(".idea-header");
    if (!header) return;
    var card = header.closest(".idea-card");
    if (!card) return;
    var body = card.querySelector(".idea-body");
    var opening = !card.classList.contains("is-open");
    card.classList.toggle("is-open");
    if (body) {
        if (opening) {
            /* Measure natural height then animate to it */
            body.style.maxHeight = body.scrollHeight + "px";
            /* After transition ends, switch to 'none' so content-driven
               changes (images loading, expand) never need recalculating */
            body.addEventListener("transitionend", function onOpen() {
                body.removeEventListener("transitionend", onOpen);
                if (card.classList.contains("is-open")) {
                    body.style.maxHeight = "none";
                }
            });
        } else {
            /* Snap back from 'none' to a concrete value before animating to 0 */
            body.style.maxHeight = body.scrollHeight + "px";
            requestAnimationFrame(function () {
                body.style.maxHeight = "0";
            });
        }
    }
    if (opening && card.classList.contains("is-on-chain")) {
        fetchIdeaFeatures(card);
    }
});


/* ============================================================
   IMAGE EXPAND / COLLAPSE — macOS-style spring animation
   Delegated from document — works for all dynamically built cards.
   Clicking a populated slot expands it to 50% card width.
   Clicking expanded image (or same slot again) collapses it.
   ============================================================ */
document.addEventListener("click", function (e) {
    var slot = e.target.closest(".idea-img-slot");
    if (!slot || slot.classList.contains("slot-empty")) return;

    var card        = slot.closest(".idea-card");
    var body        = card && card.querySelector(".idea-body");
    var strip       = card && card.querySelector(".idea-img-strip");
    var expanded    = card && card.querySelector(".idea-img-expanded");
    if (!card || !body || !strip || !expanded) return;

    /* If already showing this slot — collapse */
    if (expanded.dataset.activeSlot === slot.dataset.slot && expanded.style.display !== "none") {
        _collapseIdeaImg(expanded);
        return;
    }

    /* Build / replace expanded image */
    var img = slot.querySelector("img");
    if (!img) return;

    expanded.className = "idea-img-expanded";
    expanded.style.marginLeft = slot.offsetLeft + "px";
    expanded.dataset.activeSlot = slot.dataset.slot;
    expanded.innerHTML = "";
    var bigImg = document.createElement("img");
    bigImg.src = img.src;
    bigImg.alt = img.alt;
    expanded.appendChild(bigImg);
    expanded.style.display = "";
    expanded.classList.add("is-opening");
    expanded.addEventListener("animationend", function onOpened() {
        expanded.removeEventListener("animationend", onOpened);
        expanded.classList.remove("is-opening");
    });
});

/* Collapse when clicking outside the strip / expanded area */
document.addEventListener("click", function (e) {
    if (e.target.closest(".idea-img-slot") || e.target.closest(".idea-img-expanded")) return;
    document.querySelectorAll(".idea-img-expanded").forEach(function (expanded) {
        if (expanded.style.display !== "none") {
            _collapseIdeaImg(expanded);
        }
    });
});

function _collapseIdeaImg(expanded) {
    expanded.classList.add("is-closing");
    expanded.addEventListener("animationend", function onClosed() {
        expanded.removeEventListener("animationend", onClosed);
        expanded.classList.remove("is-closing");
        expanded.style.display = "none";
        expanded.dataset.activeSlot = "";
    });
}
