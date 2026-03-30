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
   NOTES   : Follows the daily-link.js / broken-log overlay pattern.
             Lazy-loads iframe src on first click per unique URL.
             A second click on a different tile swaps the src.
   VERSION : 101
   ============================================================ */

(function () {

    /* ── CONFIG ─────────────────────────────────────────────── */
    var CLOSE_ICON    = "icon/close.svg";
    var FRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads";

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
    var lastTab = "app";   // tab to restore when overlay is closed
    var lastBtn = null;

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

        /* Remember the current active tab so close can restore it.
           WHY: activateTab stores no history itself; we must track it. */
        var activeTab = document.querySelector(".tab-btn.active");
        if (activeTab) {
            lastTab = activeTab.dataset.target || "app";
            lastBtn = activeTab;
        }

        var url = a.href;

        /* Swap src only when opening a different URL — avoids reload */
        if (frame.src !== url) {
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
