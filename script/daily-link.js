/* ============================================================
   daily-link.js — Daily header link
   ------------------------------------------------------------
   PURPOSE : Sets the BSVhub.io logo link to today's daily URL.
             Overlay handling is delegated to iframe-overlay.js.
   INPUTS  : DOM element #daily-link must exist in the HTML.
   OUTPUTS : Sets #daily-link href, data-iframe, and target.
   DEPENDS : iframe-overlay.js (optional — if absent the link
             opens in a new tab via target="_blank" fallback).
   NOTES   : Overlay DOM, lazy-load, close, and Escape key are
             all handled by iframe-overlay.js. This file only
             owns the date logic and the link attributes.
   VERSION : 201
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

    var link = document.getElementById("daily-link");

    /* Set href — keeps right-click "open in new tab" working */
    if (link) link.href = dailyUrl;

    /* WHY data-iframe="true": delegates overlay handling to iframe-overlay.js
       so the logo click uses the same overlay as all other iframe tiles.
       WHY target="_blank": fallback if iframe-overlay.js is absent — link
       opens in a new tab instead of doing nothing. iframe-overlay.js
       intercepts the click with e.preventDefault() so target never fires
       when the overlay script is present. */
    if (link) {
        link.dataset.iframe = "true";
        link.target         = "_blank";
    }

})();
