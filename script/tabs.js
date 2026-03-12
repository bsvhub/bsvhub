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
        if (typeof clearDoubleTapSelection === "function") clearDoubleTapSelection();
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
        if (typeof clearDoubleTapSelection === "function") clearDoubleTapSelection();
        resetSearch();
        activateTab(link.dataset.target, link);
    })
);

/* ============================================================
   COPY BUTTON — audio setup, clipboard + sound
   Audio element created here so all copy button logic lives
   in one place. The <audio> tag in index.html can be removed.
   Uses a hidden textarea + execCommand("copy") so clipboard
   managers reliably intercept it (navigator.clipboard is async
   and many managers miss it).
============================================================ */
const _copySfx = document.createElement("audio");
_copySfx.id  = "copy-sfx";
_copySfx.src = "styles/assets/copy.mp3";
document.body.appendChild(_copySfx);

document.addEventListener("click", (e) => {
    if (e.target.id !== "copy-tip-btn") return;

    const address = (document.getElementById("tip-address") || {}).textContent || "";
    if (!address) return;

    /* execCommand approach — synchronous, caught by all clipboard managers */
    const ta = document.createElement("textarea");
    ta.value = address.trim();
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);

    /* Play sound — reset to start first so rapid clicks always replay */
    _copySfx.currentTime = 0;
    _copySfx.play();
});
