/* ============================================================
   TABS.JS — Tab system, header links, search reset & copy sound
   ------------------------------------------------------------
   Dependencies (must load before this file):
     scroll.js  → clearDoubleTapSelection()
     layout.js  → positionContent()
============================================================ */

const tabButtons  = document.querySelectorAll(".tab-btn");
const headerLinks = document.querySelectorAll(".header-text-link:not(#mobile-toggle)");

/* ============================================================
   RESET SEARCH
   Clears input, hides results, resets layout.
============================================================ */
function resetSearch() {
    const resultSec = document.getElementById("search-results");
    const searchBox = document.getElementById("search-box");

    searchBox.value = "";                  // clear input
    resultSec.innerHTML = "";              // clear results
    resultSec.classList.remove("active"); // hide results

    document.querySelectorAll(".tab-content").forEach(sec =>
        sec.classList.remove("active")
    );

    requestAnimationFrame(() => {
        if (typeof positionContent === "function") positionContent();
    });
}

/* ============================================================
   ACTIVATE TAB
============================================================ */
function activateTab(targetId, source) {
    tabButtons.forEach(b => b.classList.remove("active"));
    headerLinks.forEach(h => h.classList.remove("active"));

    if (source) source.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(sec =>
        sec.classList.remove("active")
    );

    const sec = document.getElementById(targetId);
    if (sec) sec.classList.add("active");

    // Desktop: scroll window
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Mobile: scroll content-area directly (handles scaled content)
    const contentArea = document.getElementById("content-area");
    if (contentArea) contentArea.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   TAB BUTTON CLICKS
============================================================ */
tabButtons.forEach(btn =>
    btn.addEventListener("click", () => {
        clearDoubleTapSelection();
        resetSearch();
        activateTab(btn.dataset.target, btn);
    })
);

/* ============================================================
   HEADER LINK CLICKS
============================================================ */
headerLinks.forEach(link =>
    link.addEventListener("click", (e) => {
        e.preventDefault();
        clearDoubleTapSelection();
        resetSearch();
        activateTab(link.dataset.target, link);
    })
);

/* ============================================================
   COPY BUTTON SOUND
============================================================ */
document.addEventListener("click", (e) => {
    if (e.target.id === "copy-tip-btn") {
        document.getElementById("copy-sfx").play();
    }
});
