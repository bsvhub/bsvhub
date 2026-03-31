/* ============================================================
   MOBILE.JS — Mobile / desktop mode toggle
   ------------------------------------------------------------
   Dependencies (must load before this file):
     scroll.js  → clearDoubleTapSelection()
     layout.js  → positionContent()
============================================================ */

const mobileToggle = document.getElementById("mobile-toggle");
const wrapper      = document.getElementById("page-wrapper");

/* ============================================================
   STATE CAPTURE / RESTORE — preserves active tab across toggle
============================================================ */
function captureUIState() {
    return {
        activeTabBtn:    document.querySelector(".tab-btn.active"),
        activeHeaderLink: document.querySelector(".header-text-link.active"),
        activeSection:   document.querySelector(".tab-content.active")
    };
}

function restoreUIState(state) {
    const hasSomething = state.activeTabBtn || state.activeHeaderLink || state.activeSection;
    if (!hasSomething) return;

    document.querySelectorAll(".tab-btn, .header-text-link")
        .forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-content")
        .forEach(sec => sec.classList.remove("active"));

    if (state.activeTabBtn)     state.activeTabBtn.classList.add("active");
    if (state.activeHeaderLink) state.activeHeaderLink.classList.add("active");
    if (state.activeSection)    state.activeSection.classList.add("active");
}

/* ============================================================
   ENABLE / DISABLE MOBILE MODE
============================================================ */
function enableMobileMode(state) {
    document.body.classList.add("mobile-mode");
    localStorage.setItem("ui-mode", "mobile");
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            restoreUIState(state);
            if (typeof positionContent === "function") positionContent();
            /* fixScaleSpacing is called inside positionContent above, but
               that runs synchronously while restoreUIState may have just
               finished its clear-then-restore cycle. A deferred call via
               setTimeout(0) ensures the browser has completed layout for
               the restored active section before we measure its height.   */
            setTimeout(function () {
                if (typeof fixScaleSpacing === "function") fixScaleSpacing();
            }, 0);
        });
    });
}

function disableMobileMode(state) {
    document.body.classList.remove("mobile-mode");
    localStorage.setItem("ui-mode", "desktop");
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            restoreUIState(state);
            if (typeof positionContent === "function") positionContent();
        });
    });
}

/* ============================================================
   FADE TRANSITION
============================================================ */
function swapModeWithFade(enableMobile) {
    wrapper.classList.add("fading");
    setTimeout(() => {
        const state = captureUIState();
        if (enableMobile) enableMobileMode(state);
        else              disableMobileMode(state);
        wrapper.style.visibility = "visible";
    }, 50);
    setTimeout(() => {
        wrapper.classList.remove("fading");
    }, 200);
}

/* ============================================================
   TOGGLE BUTTON HANDLER
============================================================ */
if (mobileToggle) {
    mobileToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof clearDoubleTapSelection === "function") clearDoubleTapSelection();
        mobileToggle.classList.add("blink");
        setTimeout(() => mobileToggle.classList.remove("blink"), 150);
        mobileToggle.classList.remove("active");
        const enableMobile = !document.body.classList.contains("mobile-mode");
        swapModeWithFade(enableMobile);
    });
}

/* ============================================================
   RESTORE MODE ON PAGE LOAD
============================================================ */
window.addEventListener("load", () => {
    // Transfer mobile-mode from <html> to <body> if set early
    if (document.documentElement.classList.contains("mobile-mode-loading")) {
        document.documentElement.classList.remove("mobile-mode-loading");
        enableMobileMode(captureUIState());
        return;
    }

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
                           .test(navigator.userAgent) || (window.innerWidth <= 1024);
    const savedMode = localStorage.getItem("ui-mode");

    if (!savedMode) {
        if (isMobileDevice) enableMobileMode(captureUIState());
    } else if (savedMode === "mobile") {
        enableMobileMode(captureUIState());
    }
});

/* ============================================================
   FONT READINESS & BFCACHE RESTORE
============================================================ */
window.addEventListener("load", () => {
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (typeof positionContent === "function") positionContent();
        });
    }
});

window.addEventListener("pageshow", () => {
    if (typeof positionContent === "function") positionContent();
});
