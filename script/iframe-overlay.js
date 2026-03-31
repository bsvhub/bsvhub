/* ============================================================
   iframe-overlay.js — Inline iframe overlay plugin
   ------------------------------------------------------------
   PURPOSE : Intercepts clicks on icon tiles flagged with
             data-iframe="true" (set by json.js when list.json
             item has "iframe": true) and opens the link inside
             a full-viewport iframe overlay instead of a new tab.
   INPUTS  : Icon <a> elements with data-iframe="true" in the DOM.
   OUTPUTS : Injects #iframe-overlay section; wires click, close,
             and Escape-key handlers.
   DEPENDS : unified.css Section 13 (.up-link-wrap, .up-link-close);
             #up-link section must exist for correct DOM insertion;
             window.activateTab() from tabs.js.
   NOTES   : daily-link.js delegates to this module via data-iframe="true".
             Lazy-loads iframe src on first click per unique URL.
             A second click on a different tile swaps the src.
             Per-tile bg colour override via data-iframe-bg attribute.
   VERSION : 105
   ============================================================ */

(function () {

    /* ── CONFIG ─────────────────────────────────────────────── */
    var CLOSE_ICON    = "icon/close.svg";
    var FRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads";
    /* DEFAULT_BG: .up-link-wrap CSS default is rgba(0,0,0,0.8).
       Reset via wrap.style.background = "" so the stylesheet rule wins —
       no need to redeclare the value here. */

    /* ── Build overlay DOM ───────────────────────────────────── */
    var overlay = document.createElement("section");
    overlay.id        = "iframe-overlay";
    overlay.className = "tab-content";

    var wrap = document.createElement("div");
    wrap.className = "up-link-wrap";

    /* Close button — reuses .up-link-close style from Section 13 */
    var closeBtn = document.createElement("img");
    closeBtn.id        = "iframe-overlay-close";
    closeBtn.className = "up-link-close";
    closeBtn.src       = CLOSE_ICON;
    closeBtn.alt       = "Close";
    closeBtn.title     = "Close";

    /* Iframe — lazy: src stays about:blank until first click */
    var frame = document.createElement("iframe");
    frame.id    = "iframe-overlay-frame";
    frame.src   = "about:blank";
    frame.title = "Inline view";
    frame.allowFullscreen = true;
    frame.setAttribute("sandbox", FRAME_SANDBOX);

    wrap.appendChild(closeBtn);
    wrap.appendChild(frame);
    overlay.appendChild(wrap);

    /* Insert after #up-link so z-index stacking context is correct
       (must be outside #content-area, same as all other overlays) */
    var upLink = document.getElementById("up-link");
    if (upLink && upLink.parentNode) {
        upLink.parentNode.insertBefore(overlay, upLink.nextSibling);
    } else {
        /* WHY fallback: defensive in case DOM order changes */
        document.body.appendChild(overlay);
    }

    /* ── State ───────────────────────────────────────────────── */
    /* WHY read from DOM: active at load may not be "app". WHY check both
       selectors: about/tip/contact are header-text-links, not tab buttons —
       checking only .tab-btn.active misses them and falls back to "app". */
    var _initBtn = document.querySelector(".tab-btn.active, .header-text-link.active");
    var lastTab  = _initBtn ? (_initBtn.dataset.target || "app") : "app";
    var lastBtn  = _initBtn || null;

    /* ── Helper — close the overlay ─────────────────────────── */
    function closeOverlay() {
        overlay.classList.remove("active");
        /* Restore the tab that was active before opening */
        if (typeof activateTab === "function") {
            activateTab(lastTab, lastBtn);
        }
    }

    /* ── Event delegation — catch any data-iframe tile click ─── */
    document.addEventListener("click", function (e) {
        var a = e.target.closest("a[data-iframe='true']");
        if (!a) return;

        e.preventDefault();

        /* Remember the current active section so close can restore it.
           WHY check both: about/tip/contact use header-text-links not tab
           buttons — .tab-btn.active alone misses them, returning wrong tab. */
        var activeEl = document.querySelector(".tab-btn.active, .header-text-link.active");
        if (activeEl) {
            lastTab = activeEl.dataset.target || "app";
            lastBtn = activeEl;
        }

        var url = a.href;

        /* WHY always reset: same overlay reused across tiles. Tile A (custom bg)
           then tile B (no bg) must revert to CSS default — "" removes the inline
           style so .up-link-wrap background takes over automatically. */
        var bgColour = a.dataset.iframeBg || "";
        wrap.style.background = bgColour;

        /* Swap src only when opening a different URL — avoids reload */
        if (frame.src !== url) {
            /* WHY hide before src change: iframe briefly shows previous page
               while new src loads — hiding it prevents the flash. Shown again
               on load event. Same-URL reopens skip this (no src change). */
            frame.style.visibility = "hidden";
            frame.addEventListener("load", function onLoad() {
                frame.removeEventListener("load", onLoad);
                frame.style.visibility = "";
            });
            frame.src = url;
        }

        overlay.classList.add("active");
    });

    /* ── Close button ───────────────────────────────────────── */
    closeBtn.addEventListener("click", closeOverlay);

    /* ── Escape key closes overlay ──────────────────────────── */
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlay.classList.contains("active")) {
            closeOverlay();
        }
    });

})();
