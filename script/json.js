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
   HELPER — applyOpacityToColor
   Embeds an opacity (0.0–1.0) into a CSS colour string.
   Handles: #rgb  #rrggbb  rgb()  rgba()
   Named colours / other formats are returned unchanged.
============================================================ */
function applyOpacityToColor(color, opacity) {
    color = color.trim();

    // #rgb → #rrggbb shorthand expand then fall through
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
        color = '#' + color[1] + color[1]
                    + color[2] + color[2]
                    + color[3] + color[3];
    }

    // #rrggbb
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        var r = parseInt(color.slice(1, 3), 16);
        var g = parseInt(color.slice(3, 5), 16);
        var b = parseInt(color.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
    }

    // rgb(r,g,b) → rgba(r,g,b,opacity)
    if (/^rgb\(/.test(color)) {
        return color.replace('rgb(', 'rgba(').replace(')', ',' + opacity + ')');
    }

    // rgba(r,g,b,a) → replace existing alpha
    if (/^rgba\(/.test(color)) {
        return color.replace(/,\s*[\d.]+\s*\)$/, ',' + opacity + ')');
    }

    // Unrecognised format (named colour, hsl, etc.) — return unchanged
    return color;
}

/* ============================================================
   HELPER — buildIconBackground
   Combines colour1, colour2, and opacity into a CSS background
   string to apply to the icon tile <a> element.

   Rules:
     colour1 + colour2          → linear-gradient (135deg)
     colour1 only               → solid colour
     neither + opacity only     → default tile colour with new alpha
     opacity not set            → colours used as-is (no alpha change)
     nothing set                → returns null (CSS default applies)
============================================================ */
var DEFAULT_ICON_COLOUR = [121, 139, 178];   // matches CSS rgba(121,139,178,0.5)

function buildIconBackground(colour1, colour2, opacity) {
    var hasC1      = colour1 && colour1.trim();
    var hasC2      = colour2 && colour2.trim();
    var hasOpacity = (opacity !== undefined && opacity !== null && opacity !== '');
    var alpha      = hasOpacity ? parseFloat(opacity) : null;

    // Nothing specified — let CSS default handle it
    if (!hasC1 && !hasC2 && !hasOpacity) return null;

    // Apply opacity to colours if provided
    var c1 = hasC1 ? (alpha !== null ? applyOpacityToColor(colour1, alpha) : colour1.trim()) : null;
    var c2 = hasC2 ? (alpha !== null ? applyOpacityToColor(colour2, alpha) : colour2.trim()) : null;

    if (c1 && c2) {
        // Two colours → gradient
        return 'linear-gradient(135deg, ' + c1 + ', ' + c2 + ')';
    }

    if (c1) {
        // One colour → solid
        return c1;
    }

    // Opacity only → apply to the default tile colour
    return 'rgba(' + DEFAULT_ICON_COLOUR[0] + ','
                   + DEFAULT_ICON_COLOUR[1] + ','
                   + DEFAULT_ICON_COLOUR[2] + ','
                   + alpha + ')';
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
            var count = Math.max(0, d.broken - 1); // subtract 1 for permanent test entry
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
            // buildIconBackground() returns null when nothing is set,
            // leaving the CSS default background intact.
            var bg = buildIconBackground(item.colour1, item.colour2, item.opacity);
            if (bg) a.style.background = bg;

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

        fetch(href, { method: "HEAD" })
            .then(function (r) {
                if (r.status === 404) {
                    // Report broken
                    fetch("/api/report-broken", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ href: href, text: text }),
                    }).catch(function () {});
                } else {
                    // Link is healthy — remove from log if it was there
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
