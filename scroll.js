/* ============================================================
   SCROLL.JS — Tooltip, Marquee, BSV Price & Mobile Double-Tap
   ------------------------------------------------------------
   1. TOOLTIP STATE
   2. BSV PRICE FETCH (with localStorage fallback)
   3. DEFAULT TOOLTIP (MARQUEE)
   4. SET TOOLTIP TEXT
   5. DESKTOP HOVER TOOLTIPS (event delegation)
   6. MOBILE DOUBLE-TAP (event delegation)
   7. CLEAR SELECTION HELPERS
   8. AUTO-CLEAR TRIGGERS
   9. TOOLTIP HEIGHT TRANSITION HANDLER
============================================================ */

/* ============================================================
   1 — TOOLTIP STATE
============================================================ */
const tooltipBox = document.getElementById("tooltip-display");
let defaultTooltipMessage = "Loading...";
let revertTimeout = null;
let lastTappedLink = null;

/* ============================================================
   2 — BSV PRICE FETCH (with localStorage fallback)
============================================================ */
let bsvPricePrefix = "";

async function fetchBSVPrice() {
    try {
        const res = await fetch('https://api.whatsonchain.com/v1/bsv/main/exchangerate');
        const data = await res.json();
        const price = parseFloat(data.rate).toFixed(2);
        localStorage.setItem('bsv_last_price', price);
        localStorage.setItem('bsv_last_fetch', Date.now());
        bsvPricePrefix = `— BSV $${price} —`;
    } catch (e) {
        const cached = localStorage.getItem('bsv_last_price');
        bsvPricePrefix = cached ? `— BSV $${cached} —` : `— BSV $? —`;
    }
    // Refresh marquee with updated price
    showDefaultTooltip();
}

// Refresh price every 5 minutes while page is open
setInterval(fetchBSVPrice, 5 * 60 * 1000);

/* ============================================================
   3 — DEFAULT TOOLTIP (MARQUEE)
   Loads tooltip-message.txt, then fetches BSV price.
   Marquee format: "— BSV $xx.xx —   [message]" × 5
============================================================ */
fetch("tooltip-message.txt")
    .then(r => r.text())
    .then(t => {
        defaultTooltipMessage = t.trim();
        showDefaultTooltip();   // show message immediately
        fetchBSVPrice();        // fetch price and refresh marquee
    })
    .catch(() => {
        showDefaultTooltip();
        fetchBSVPrice();
    });

function showDefaultTooltip() {
    const separator = "\u00A0\u00A0\u00A0•\u00A0\u00A0\u00A0";
    const unit = bsvPricePrefix
        ? `${bsvPricePrefix}\u00A0\u00A0\u00A0${defaultTooltipMessage}`
        : defaultTooltipMessage;
    const repeated = Array(5).fill(unit).join(separator);
    tooltipBox.innerHTML = `<span>${repeated}</span>`;
    tooltipBox.classList.add("marquee");
    tooltipBox.classList.remove("expanded");

    const span = tooltipBox.querySelector('span');
    if (span) {
        const textLength = unit.length;
        const duration = Math.max(10, textLength * 0.15);
        span.style.animationDuration = `${duration}s`;
    }
}

/* ============================================================
   4 — SET TOOLTIP TEXT
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

    // Re-measure layout after tooltip change
    requestAnimationFrame(() => {
        if (typeof positionContent === "function") positionContent();
    });
}

/* ============================================================
   5 — DESKTOP HOVER TOOLTIPS (event delegation)
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
   6 — MOBILE DOUBLE-TAP (event delegation)
   First tap  → show tooltip
   Second tap → navigate + reset tooltip to default
============================================================ */
document.addEventListener("click", (e) => {
    if (!isMobileMode()) return;

    const wrap = e.target.closest(".icon-wrapper");
    if (!wrap) return;

    const link = wrap.closest("a");
    if (!link) return;

    // Clear previous selection if different icon tapped
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
   7 — CLEAR SELECTION HELPER
============================================================ */
function clearDoubleTapSelection() {
    if (lastTappedLink) {
        lastTappedLink.classList.remove("mobile-selected");
        lastTappedLink = null;
        setTooltipText("");
    }
}

/* ============================================================
   8 — AUTO-CLEAR TRIGGERS
============================================================ */
document.addEventListener('pointerdown', (e) => {
    if (!isMobileMode()) return;
    const isIconArea = e.target.closest('.icon-wrapper');
    if (!isIconArea) clearDoubleTapSelection();
}, { capture: true });

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearDoubleTapSelection();
});

window.addEventListener('blur', clearDoubleTapSelection);

document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearDoubleTapSelection();
});

/* ============================================================
   9 — TOOLTIP HEIGHT TRANSITION HANDLER
============================================================ */
tooltipBox.addEventListener("transitionend", (e) => {
    if (e.propertyName === "max-height" || e.propertyName === "padding") {
        if (typeof positionContent === "function") positionContent();
    }
});
