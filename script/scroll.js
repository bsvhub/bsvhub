/* ============================================================
   SCROLL.JS — Tooltip, Marquee, BSV Price, BTC Price, F&G Index & Mobile Double-Tap
   ------------------------------------------------------------
   1.  TOOLTIP STATE
   2.  BSV PRICE FETCH (localStorage fallback, refresh every 10 min)
   3.  BTC PRICE FETCH (localStorage fallback, refresh every 10 min)
   4.  FEAR & GREED INDEX FETCH (localStorage fallback, 1hr cache)
   5.  INITIALISE — load all feeds then build marquee
   6.  DEFAULT TOOLTIP (MARQUEE)
   7.  SET TOOLTIP TEXT
   8.  DESKTOP HOVER TOOLTIPS (event delegation)
   9.  MOBILE DOUBLE-TAP (event delegation)
   10. CLEAR SELECTION HELPERS
   11. AUTO-CLEAR TRIGGERS
   12. TOOLTIP HEIGHT TRANSITION HANDLER
============================================================ */

/* ============================================================
   1 — TOOLTIP STATE
============================================================ */
const tooltipBox        = document.getElementById("tooltip-display");
let defaultTooltipMessage = "Loading...";
let revertTimeout         = null;
let lastTappedLink        = null;

/* ============================================================
   2 — BSV PRICE FETCH
   Checks localStorage first — only calls API if cached value
   is older than 10 minutes. Falls back to stale cache if API
   fails. No setInterval — cache TTL handles refresh timing.
============================================================ */
let bsvPricePrefix = "";

const BSV_CACHE_KEY      = "bsv_last_price";
const BSV_CACHE_TIME_KEY = "bsv_last_fetch";
const BSV_TTL_MS         = 10 * 60 * 1000;   // 10 minutes

async function fetchBSVPrice() {
    // Use cached value if it is less than 10 minutes old
    const lastFetch = parseInt(localStorage.getItem(BSV_CACHE_TIME_KEY) || "0");
    const isFresh   = (Date.now() - lastFetch) < BSV_TTL_MS;

    if (isFresh) {
        const cachedPrice = localStorage.getItem(BSV_CACHE_KEY);
        if (cachedPrice) {
            bsvPricePrefix = `— BSV $${cachedPrice} —`;
            showDefaultTooltip();
            return;
        }
    }

    // Cache expired or missing — fetch fresh data
    try {
        const res   = await fetch("https://api.whatsonchain.com/v1/bsv/main/exchangerate");
        const data  = await res.json();
        const price = parseFloat(data.rate).toFixed(2);
        localStorage.setItem(BSV_CACHE_KEY,      price);
        localStorage.setItem(BSV_CACHE_TIME_KEY, Date.now());
        bsvPricePrefix = `— BSV $${price} —`;
    } catch {
        // API failed — use localStorage regardless of age
        const cached = localStorage.getItem(BSV_CACHE_KEY);
        bsvPricePrefix = cached ? `— BSV $${cached} —` : "— BSV $? —";
    }
    showDefaultTooltip();
}

/* ============================================================
   3 — BTC PRICE FETCH
   Checks localStorage first — only calls API if cached value
   is older than 10 minutes. Falls back to stale cache if API
   fails. No setInterval — cache TTL handles refresh timing.
   API: https://api.coinbase.com/v2/prices/BTC-USD/spot
============================================================ */
let btcPricePrefix = "";

const BTC_CACHE_KEY      = "btc_last_price";
const BTC_CACHE_TIME_KEY = "btc_last_fetch";
const BTC_TTL_MS         = 10 * 60 * 1000;   // 10 minutes

async function fetchBTCPrice() {
    // Use cached value if it is less than 10 minutes old
    const lastFetch = parseInt(localStorage.getItem(BTC_CACHE_TIME_KEY) || "0");
    const isFresh   = (Date.now() - lastFetch) < BTC_TTL_MS;

    if (isFresh) {
        const cachedPrice = localStorage.getItem(BTC_CACHE_KEY);
        if (cachedPrice) {
            btcPricePrefix = `— BTC $${cachedPrice} —`;
            showDefaultTooltip();
            return;
        }
    }

    // Cache expired or missing — fetch fresh data
    try {
        const res   = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot");
        const data  = await res.json();
        const price = parseFloat(data.data.amount).toFixed(2);
        localStorage.setItem(BTC_CACHE_KEY,      price);
        localStorage.setItem(BTC_CACHE_TIME_KEY, Date.now());
        btcPricePrefix = `— BTC $${price} —`;
    } catch {
        // API failed — use localStorage regardless of age
        const cached = localStorage.getItem(BTC_CACHE_KEY);
        btcPricePrefix = cached ? `— BTC $${cached} —` : "— BTC $? —";
    }
    showDefaultTooltip();
}

/* ============================================================
   4 — FEAR & GREED INDEX FETCH
   The index updates periodically so we cache for 1 hour.
   Falls back to last value stored in localStorage.

   API: https://api.alternative.me/fng/
   Returns: value (0-100) + value_classification
     0-24   Extreme Fear
     25-49  Fear
     50     Neutral
     51-74  Greed
     75-100 Extreme Greed

   Display format:  F&G 40 Fear
============================================================ */
let fgiPrefix = "";

const FGI_CACHE_KEY       = "fgi_last_value";
const FGI_CACHE_CLASS_KEY = "fgi_last_class";
const FGI_CACHE_TIME_KEY  = "fgi_last_fetch";
const FGI_TTL_MS          = 1 * 60 * 60 * 1000;   // 1 hour

async function fetchFearGreed() {
    // Use cached value if it is less than 1 hour old
    const lastFetch = parseInt(localStorage.getItem(FGI_CACHE_TIME_KEY) || "0");
    const isFresh   = (Date.now() - lastFetch) < FGI_TTL_MS;

    if (isFresh) {
        const cachedVal   = localStorage.getItem(FGI_CACHE_KEY);
        const cachedClass = localStorage.getItem(FGI_CACHE_CLASS_KEY);
        if (cachedVal && cachedClass) {
            fgiPrefix = `— F&G ${cachedVal} ${cachedClass} —`;
            showDefaultTooltip();
            return;
        }
    }

    // Cache expired or missing — fetch fresh data
    try {
        const res         = await fetch("https://api.alternative.me/fng/");
        const data        = await res.json();
        const entry       = data.data[0];
        const val         = entry.value;
        const cls         = entry.value_classification;   // e.g. "Extreme Fear"
        localStorage.setItem(FGI_CACHE_KEY,       val);
        localStorage.setItem(FGI_CACHE_CLASS_KEY, cls);
        localStorage.setItem(FGI_CACHE_TIME_KEY,  Date.now());
        fgiPrefix = `— F&G ${val} ${cls} —`;
    } catch {
        // API failed — use localStorage regardless of age
        const cachedVal   = localStorage.getItem(FGI_CACHE_KEY);
        const cachedClass = localStorage.getItem(FGI_CACHE_CLASS_KEY);
        fgiPrefix = (cachedVal && cachedClass)
            ? `— F&G ${cachedVal} ${cachedClass} —`
            : "— F&G ? —";
    }
    showDefaultTooltip();
}

/* ============================================================
   5 — INITIALISE
   Load tooltip-message.txt first, then fetch all data feeds
   in parallel so the marquee builds as fast as possible.
============================================================ */
fetch("tooltip-message.txt")
    .then(r => r.text())
    .then(t => {
        defaultTooltipMessage = t.trim();
        showDefaultTooltip();                                              // show text immediately
        Promise.all([fetchBSVPrice(), fetchBTCPrice(), fetchFearGreed()]); // feeds load in parallel
    })
    .catch(() => {
        showDefaultTooltip();
        Promise.all([fetchBSVPrice(), fetchBTCPrice(), fetchFearGreed()]);
    });

/* ============================================================
   6 — DEFAULT TOOLTIP (MARQUEE)
   Format each loop unit:
     — BSV $xx.xx —  — BTC $xxxxx —  — F&G xx Class —   [message text]
   Each call rebuilds the marquee with the latest prefix values.
============================================================ */
function showDefaultTooltip() {
    const sep = "\u00A0\u00A0\u00A0••\u00A0\u00A0\u00A0";

    const parts = [defaultTooltipMessage];
    if (bsvPricePrefix) parts.push(bsvPricePrefix.replace(/^—\s*|\s*—$/g, "").trim());
    if (btcPricePrefix) parts.push(btcPricePrefix.replace(/^—\s*|\s*—$/g, "").trim());
    if (fgiPrefix)      parts.push(fgiPrefix.replace(/^—\s*|\s*—$/g, "").trim());

    const unit = parts.join(sep) + sep;

    // Step 1 — render ONE copy off-screen to measure its real pixel width
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
    probe.textContent = unit;
    tooltipBox.appendChild(probe);
    const unitPx = probe.getBoundingClientRect().width;
    tooltipBox.removeChild(probe);

    // Step 2 — fill screen width with enough copies + 2 extra buffer
    const copies = Math.ceil(tooltipBox.clientWidth / unitPx) + 2;
    const repeated = Array(copies).fill(unit).join("");

    // Step 3 — animate exactly one unit width in pixels — seamless on any screen
    tooltipBox.innerHTML = `<span>${repeated}</span>`;
    tooltipBox.classList.add("marquee");
    tooltipBox.classList.remove("expanded");

    const span = tooltipBox.querySelector("span");
    if (span) {
        const SCROLL_SPEED = 0.02;   // 👈 seconds per pixel — lower = faster, higher = slower
		const duration = Math.max(10, unitPx * SCROLL_SPEED);
        span.style.setProperty("--unit-px", `-${unitPx}px`);
        span.style.animationDuration = `${duration}s`;
    }
}

/* ============================================================
   7 — SET TOOLTIP TEXT
============================================================ */
function setTooltipText(text) {
    if (revertTimeout) clearTimeout(revertTimeout);

    if (text) {
        tooltipBox.innerHTML = text;
        tooltipBox.classList.remove("marquee");
        tooltipBox.classList.add("expanded");
    } else {
        revertTimeout = setTimeout(showDefaultTooltip, 2000);
    }

    requestAnimationFrame(() => {
        if (typeof positionContent === "function") positionContent();
    });
}

/* ============================================================
   8 — DESKTOP HOVER TOOLTIPS (event delegation)
============================================================ */
document.addEventListener("mouseenter", (e) => {
    if (!e.target || typeof e.target.closest !== "function") return;
    if (isMobileMode()) return;
    const wrap = e.target.closest(".icon-wrapper[data-tooltip]");
    if (wrap) setTooltipText(wrap.dataset.tooltip);
}, true);

document.addEventListener("mouseleave", (e) => {
    if (!e.target || typeof e.target.closest !== "function") return;
    if (isMobileMode()) return;
    const wrap = e.target.closest(".icon-wrapper[data-tooltip]");
    if (wrap) setTooltipText("");
}, true);

/* ============================================================
   9 — MOBILE DOUBLE-TAP (event delegation)
   Three explicit cases — no ambiguous state:
     Case A: tapping the ALREADY selected icon  → navigate
     Case B: tapping a DIFFERENT icon           → switch selection
     Case C: tapping with nothing selected      → first tap
============================================================ */
document.addEventListener("click", (e) => {
    if (!isMobileMode()) return;

    const wrap = e.target.closest(".icon-wrapper");
    if (!wrap) return;

    const link = wrap.closest("a");
    if (!link) return;

    // Case A — second tap on the same icon → let browser navigate
    if (link === lastTappedLink) {
        clearDoubleTapSelection();
        return;  // no e.preventDefault() — browser follows the link
    }

    // Cases B & C — new icon tapped → always block navigation
    e.preventDefault();

    // Clear any existing selection cleanly before setting new one
    if (lastTappedLink) {
        lastTappedLink.classList.remove("mobile-selected");
        lastTappedLink = null;
    }

    // Select the new icon
    link.classList.add("mobile-selected");
    lastTappedLink = link;
    setTooltipText(wrap.dataset.tooltip || wrap.textContent || "Tap again to open");

}, true);

/* ============================================================
   10 — CLEAR SELECTION HELPER
============================================================ */
function clearDoubleTapSelection() {
    if (lastTappedLink) {
        lastTappedLink.classList.remove("mobile-selected");
        lastTappedLink = null;
        setTooltipText("");
    }
}

/* ============================================================
   11 — AUTO-CLEAR TRIGGERS
   NOTE: window blur deliberately removed — on mobile it fires
   too readily (address bar, focus shifts) and was wiping the
   selection immediately after it was set.
============================================================ */
document.addEventListener("pointerdown", (e) => {
    if (!isMobileMode()) return;
    if (!e.target.closest(".icon-wrapper")) clearDoubleTapSelection();
}, { capture: true });

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearDoubleTapSelection();
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearDoubleTapSelection();
});

/* ============================================================
   12 — TOOLTIP HEIGHT TRANSITION HANDLER
============================================================ */
tooltipBox.addEventListener("transitionend", (e) => {
    if (e.propertyName === "max-height" || e.propertyName === "padding") {
        if (typeof positionContent === "function") positionContent();
    }
});
