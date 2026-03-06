/* ============================================================
   SEARCH.JS — Icon grid search with debounce
   ------------------------------------------------------------
   Dependencies (must load before this file):
     scroll.js  → clearDoubleTapSelection()
     layout.js  → fixScaleSpacing()
============================================================ */

const searchBox   = document.getElementById("search-box");
const resultSec   = document.getElementById("search-results");
const excludedTabs = ["about-section", "tip-section", "contact-section"];

let _searchTimer;
searchBox.addEventListener("input", () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
        clearDoubleTapSelection();
        const q = searchBox.value.toLowerCase();

        // Clear previous results
        resultSec.innerHTML = "";

        // Empty query — hide results and return
        if (!q) {
            resultSec.classList.remove("active");
            requestAnimationFrame(() => {
                if (typeof fixScaleSpacing === "function") fixScaleSpacing();
            });
            return;
        }

        // Deactivate current tab and buttons
        document.querySelectorAll(".tab-content").forEach(sec =>
            sec.classList.remove("active")
        );
        document.querySelectorAll(".tab-btn").forEach(btn =>
            btn.classList.remove("active")
        );

        const grid       = document.createElement("ul");
        grid.className   = "icon-grid";
        const foundItems = [];

        // Search through all tab sections
        document.querySelectorAll(".tab-content").forEach(sec => {
            if (excludedTabs.includes(sec.id)) return;

            sec.querySelectorAll(".icon-wrapper").forEach(icon => {

                // 1. TEXT — visible label under icon
                const txt = icon.querySelector(".icon-text")?.textContent.toLowerCase() || "";

                // 2. TOOLTIP — data-tooltip attribute
                const tooltip = (icon.dataset.tooltip || "").toLowerCase();

                // 3. HREF — link URL
                const link = icon.closest("a");
                const href = link ? (link.getAttribute("href") || "").toLowerCase() : "";

                // 4. ALT — image alt text
                const mainImg = icon.querySelector("img:not([class*='icon-badge-pos'])");
                const alt     = mainImg ? (mainImg.getAttribute("alt") || "").toLowerCase() : "";

                // 5. TAB — parent section ID
                const tab = sec.id.toLowerCase();

                // 6. INFO — badge filenames
                const badges = Array.from(icon.querySelectorAll("[class*='icon-badge-pos']"));
                const info   = badges.map(b => {
                    const src = b.getAttribute("src") || "";
                    return src.split("/").pop().replace(".png", "").toLowerCase();
                }).join(" ");

                // Match logic
                if (
                    txt.includes(q)     ||
                    tooltip.includes(q) ||
                    href.includes(q)    ||
                    alt.includes(q)     ||
                    tab.includes(q)     ||
                    info.includes(q)
                ) {
                    const alreadyAdded = foundItems.some(item => item.href === href);
                    if (!alreadyAdded) {
                        foundItems.push({
                            text:    txt,
                            href:    href,
                            element: icon.closest("li").cloneNode(true)
                        });
                    }
                }
            });
        });

        // Sort alphabetically and display
        if (foundItems.length > 0) {
            foundItems.sort((a, b) => a.text.localeCompare(b.text));
            foundItems.forEach(item => grid.appendChild(item.element));
            resultSec.appendChild(grid);
            resultSec.classList.add("active");
        } else {
            resultSec.classList.remove("active");
        }

        requestAnimationFrame(() => {
            if (typeof fixScaleSpacing === "function") fixScaleSpacing();
        });

    }, 150);
});
