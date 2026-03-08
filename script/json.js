/* ============================================================
   json.js — Unified JSON loader
   ------------------------------------------------------------
   Fetches all three data files in parallel and builds every
   dynamic section of the page:
     1. about.json  → About / Tip / Contact header sections
     2. list.json   → Icon-grid tab sections
     3. ideas.json  → App Ideas accordion cards
   ============================================================ */

/* ============================================================
   HELPER — setTileColour
   Passes colour1, colour2, opacity from list.json down to the
   CSS ::before layer via custom properties on the <a> element.
   Named colours, hex, rgb, rgba all work natively — no parsing
   needed. CSS handles opacity independently on the ::before layer.
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
    fetch("ideas.json").then(function (r) { return r.json(); })
])
.then(function (results) {
    var about     = results[0];
    var data      = results[1];
    var ideasData = results[2];

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

    /* ── Counters — spans now exist in the DOM ───────────────── */
    /* Link count: data already loaded above, no extra fetch needed */
    var lcEl = document.getElementById("link-counter");
    if (lcEl) lcEl.textContent = Number(data.items.length).toLocaleString();

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
            a.target = "_blank";

            var wrap      = document.createElement("div");
            wrap.className = "icon-wrapper";
            if (item.tooltip) wrap.dataset.tooltip = item.tooltip;
            if (item.zoom)    wrap.style.setProperty("--icon-zoom", item.zoom);

            // ---- colour / opacity --------------------------------
            // colour1, colour2, opacity are all optional JSON fields.
            // setTileColour() sets CSS custom properties on <a> which
            // are read by the ::before colour layer in unified.css.
            // Named colours, hex, rgb, rgba all work natively.
            setTileColour(a, item.colour1, item.colour2, item.opacity);

            // Main icon image
            var img = document.createElement("img");
            img.src = item.img || "";
            img.alt = item.alt || "";
            wrap.appendChild(img);

            // 4-position badge system
            if (item.info) {
                item.info.split(";").forEach(function (badgeFile, index) {
                    if (badgeFile.trim()) {
                        var badge     = document.createElement("img");
                        badge.src     = "icon/" + badgeFile.trim();
                        badge.alt     = "";
                        badge.className = "icon-badge-pos" + (index + 1);
                        wrap.appendChild(badge);
                    }
                });
            }

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
          Source: ideas.json
          Targets the static <section id="ideas"> already in
          the HTML — clears the loading placeholder and fills
          it with accordion cards.
    -------------------------------------------------------- */
    var ideasSec = document.getElementById("ideas");
    if (ideasSec && ideasData.ideas) {
        ideasSec.innerHTML = "";            // clear "Loading ideas…" placeholder

        var wrapper       = document.createElement("div");
        wrapper.className = "ideas-section";

        ideasData.ideas.forEach(function (idea) {
            var card       = document.createElement("div");
            card.className = "idea-card";

            var header       = document.createElement("div");
            header.className = "idea-header";
            header.innerHTML =
                '<span class="idea-title">' + idea.title + '</span>' +
                '<span class="idea-chevron">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                       'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polyline points="6 9 12 15 18 9"/>' +
                  '</svg>' +
                '</span>';

            var body       = document.createElement("div");
            body.className = "idea-body";
            var p          = document.createElement("p");
            p.textContent  = idea.body;
            body.appendChild(p);

            card.appendChild(header);
            card.appendChild(body);
            wrapper.appendChild(card);
        });

        ideasSec.appendChild(wrapper);
    }

    /* --------------------------------------------------------
       4. ACTIVATE DEFAULT TAB (Apps)
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
   ACCORDION TOGGLE — event delegation
   Handles .idea-header clicks on dynamically built cards.
   Registered once here; works regardless of when cards render.
   ============================================================ */
document.addEventListener("click", function (e) {
    var header = e.target.closest(".idea-header");
    if (!header) return;
    var card = header.closest(".idea-card");
    if (card) card.classList.toggle("is-open");
});
