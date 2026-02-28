/* ============================================================
   SCROLL.JS — Tooltip, Marquee, BSV Price, F&G Index & Mobile Double-Tap
   ------------------------------------------------------------
   1.  TOOLTIP STATE
   2.  BSV PRICE FETCH (localStorage fallback, refresh every 5 min)
   3.  FEAR & GREED INDEX FETCH (localStorage fallback, 24hr cache)
   4.  INITIALISE — load both feeds then build marquee
   5.  DEFAULT TOOLTIP (MARQUEE)
   6.  SET TOOLTIP TEXT
   7.  DESKTOP HOVER TOOLTIPS (event delegation)
   8.  MOBILE DOUBLE-TAP (event delegation)
   9.  CLEAR SELECTION HELPERS
   10. AUTO-CLEAR TRIGGERS
   11. TOOLTIP HEIGHT TRANSITION HANDLER
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
   3 — FEAR & GREED INDEX FETCH
   The index only updates once per day so we cache for 24 hours.
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
const FGI_TTL_MS          = 24 * 60 * 60 * 1000;   // 24 hours

async function fetchFearGreed() {
    // Use cached value if it is less than 24 hours old
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
   4 — INITIALISE
   Load tooltip-message.txt first, then fetch both data feeds
   in parallel so the marquee builds as fast as possible.
============================================================ */
fetch("tooltip-message.txt")
    .then(r => r.text())
    .then(t => {
        defaultTooltipMessage = t.trim();
        showDefaultTooltip();                           // show text immediately
        Promise.all([fetchBSVPrice(), fetchFearGreed()]); // feeds load in parallel
    })
    .catch(() => {
        showDefaultTooltip();
        Promise.all([fetchBSVPrice(), fetchFearGreed()]);
    });

/* ============================================================
   5 — DEFAULT TOOLTIP (MARQUEE)
   Format each loop unit:
     — BSV $xx.xx —  — F&G xx Class —   [message text]
   Each call rebuilds the marquee with the latest prefix values.
============================================================ */
function showDefaultTooltip() {
    const separator = "\u00A0\u00A0\u00A0•\u00A0\u00A0\u00A0";

    // Only include prefixes that have loaded
    const prefixParts = [bsvPricePrefix, fgiPrefix].filter(Boolean);
    const prefix      = prefixParts.length
        ? prefixParts.join("\u00A0\u00A0") + "\u00A0\u00A0\u00A0"
        : "";

    const unit     = `${prefix}${defaultTooltipMessage}`;
    const repeated = Array(5).fill(unit).join(separator);

    tooltipBox.innerHTML = `<span>${repeated}</span>`;
    tooltipBox.classList.add("marquee");
    tooltipBox.classList.remove("expanded");

    const span = tooltipBox.querySelector("span");
    if (span) {
        const duration = Math.max(10, unit.length * 0.15);
        span.style.animationDuration = `${duration}s`;
    }
}

/* ============================================================
   6 — SET TOOLTIP TEXT
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
   7 — DESKTOP HOVER TOOLTIPS (event delegation)
============================================================ */
document.addEventListener("mouseenter", (e) => {
    if (isMobileMode()) return;
    const wrap = e.target.closest(".icon-wrapper[data-tooltip]");
    if (wrap) setTooltipText(wrap.dataset.tooltip);
}, true);

document.addEventListener("mouseleave", (e) => {
    if (isMobileMode()) return;
    const wrap = e.target.closest(".icon-wrapper[data-tooltip]");
    if (wrap) setTooltipText("");
}, true);

/* ============================================================
   8 — MOBILE DOUBLE-TAP (event delegation)
   First tap  → show tooltip
   Second tap → navigate + reset tooltip to default
============================================================ */
document.addEventListener("click", (e) => {
    if (!isMobileMode()) return;

    const wrap = e.target.closest(".icon-wrapper");
    if (!wrap) return;

    const link = wrap.closest("a");
    if (!link) return;

    // Clear previous selection if a different icon was tapped
    if (lastTappedLink && lastTappedLink !== link) {
        lastTappedLink.classList.remove("mobile-selected");
    }

    // First tap — show tooltip
    if (!link.classList.contains("mobile-selected")) {
        e.preventDefault();
        link.classList.add("mobile-selected");
        lastTappedLink = link;
        setTooltipText(wrap.dataset.tooltip || wrap.textContent || "Tap again to open");
        return;
    }

    // Second tap — navigate and reset tooltip
    clearDoubleTapSelection();
}, true);

/* ============================================================
   9 — CLEAR SELECTION HELPER
============================================================ */
function clearDoubleTapSelection() {
    if (lastTappedLink) {
        lastTappedLink.classList.remove("mobile-selected");
        lastTappedLink = null;
        setTooltipText("");
    }
}

/* ============================================================
   10 — AUTO-CLEAR TRIGGERS
============================================================ */
document.addEventListener("pointerdown", (e) => {
    if (!isMobileMode()) return;
    if (!e.target.closest(".icon-wrapper")) clearDoubleTapSelection();
}, { capture: true });

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearDoubleTapSelection();
});

window.addEventListener("blur", clearDoubleTapSelection);

document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearDoubleTapSelection();
});

/* ============================================================
   11 — TOOLTIP HEIGHT TRANSITION HANDLER
============================================================ */
tooltipBox.addEventListener("transitionend", (e) => {
    if (e.propertyName === "max-height" || e.propertyName === "padding") {
        if (typeof positionContent === "function") positionContent();
    }
});
