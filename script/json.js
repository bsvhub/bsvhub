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
    /* On-chain catalog — fails silently so a worker outage never breaks the page */
    fetch("/api/catalog").then(function (r) { return r.json(); }).catch(function () { return { items: [] }; }),
    /* Link click stats — single fetch, used to stamp count badges on tiles */
    fetch("/api/link-stats").then(function (r) { return r.json(); }).catch(function () { return { stats: {} }; })
])
.then(function (results) {
    var about       = results[0];
    var data        = results[1];
    var catalogData = results[2];   /* { items: [...] } — pre-mapped by /api/catalog */
    var clickStats  = results[3].stats || {};  /* { url: count } map for badge display */

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

            // 6-slot text overlay grid — built by tile-render.js
            buildSlotOverlay(wrap, item.info, clickStats, item.href);

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
       3. OVERLAY TOGGLE MENU
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

