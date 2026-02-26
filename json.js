/* ============================================================
   json.js — Unified JSON loader
   ------------------------------------------------------------
   Fetches all three data files in parallel and builds every
   dynamic section of the page:
     1. about.json  → About / Tip / Contact header sections
     2. list.json   → Icon-grid tab sections
     3. ideas.json  → App Ideas accordion cards
   ============================================================ */

Promise.all([
    fetch("about.json").then(function (r) { return r.json(); }),
    fetch("list.json").then(function (r) { return r.json(); }),
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
