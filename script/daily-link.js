/* ============================================================
   daily-link.js — Daily header link + overlay
   ------------------------------------------------------------
   PURPOSE : Sets the BSVhub.io logo link to today's daily URL
             and opens it inside a full-viewport iframe overlay
             (reuses Section 13 / up-link CSS pattern).
   INPUTS  : DOM element #daily-link must exist in the HTML.
   OUTPUTS : Sets #daily-link href; injects #daily-link-overlay
             section into the DOM; wires click + close handlers.
   DEPENDS : unified.css Section 13 (.up-link-wrap, .up-link-close);
             #up-link section must exist for correct DOM insertion.
   NOTES   : Overlay DOM is built here — index.html stays clean.
             Lazy-loads the iframe on first click only.
   VERSION : 200
   ============================================================ */

(function () {
    /* ── CONFIG ─────────────────────────────────────────────── */
    var BASE_URL = "https://hummingbox-dnev6xbilq-uc.a.run.app/";

    /* ── Daily URL — UTC-12 date so the link is consistent
          for all users regardless of local timezone ─────────── */
    var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Etc/GMT+12",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    var yyyy = parts.find(function (p) { return p.type === "year";  }).value;
    var mm   = parts.find(function (p) { return p.type === "month"; }).value;
    var dd   = parts.find(function (p) { return p.type === "day";   }).value;

    var dailyUrl = BASE_URL + yyyy + "-" + mm + "-" + dd;

    /* Set href — keeps right-click "open in new tab" working */
    var link = document.getElementById("daily-link");
    if (link) link.href = dailyUrl;

    /* ── Build overlay DOM ───────────────────────────────────── */
    var overlay = document.createElement("section");
    overlay.id        = "daily-link-overlay";
    overlay.className = "tab-content";

    var wrap = document.createElement("div");
    wrap.className = "up-link-wrap";

    /* Close button — reuses .up-link-close style from Section 13 */
    var closeBtn = document.createElement("img");
    closeBtn.id        = "daily-link-close";
    closeBtn.className = "up-link-close";
    closeBtn.src       = "icon/close.svg";
    closeBtn.alt       = "Close";
    closeBtn.title     = "Close";

    /* Iframe — lazy: src stays about:blank until first click */
    var frame = document.createElement("iframe");
    frame.id              = "daily-link-frame";
    frame.src             = "about:blank";
    frame.title           = "Daily Link";
    frame.allowFullscreen = true;
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");

    wrap.appendChild(closeBtn);
    wrap.appendChild(frame);
    overlay.appendChild(wrap);

    /* Insert after #up-link so z-index stacking context is correct
       (must be outside #content-area, same as #up-link) */
    var upLink = document.getElementById("up-link");
    if (upLink && upLink.parentNode) {
        upLink.parentNode.insertBefore(overlay, upLink.nextSibling);
    } else {
        /* WHY fallback: defensive in case DOM order changes */
        document.body.appendChild(overlay);
    }

    /* ── Click handler — intercept logo click ───────────────── */
    var loaded = false;
    if (link) {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            /* Lazy-load iframe on first click only */
            if (!loaded) {
                loaded = true;
                frame.src = dailyUrl;
            }
            overlay.classList.add("active");
        });
    }

    /* ── Close button ───────────────────────────────────────── */
    closeBtn.addEventListener("click", function () {
        overlay.classList.remove("active");
    });
})();
