/* ============================================================
   LAYOUT.JS — Content positioning & mobile scale spacing
   ------------------------------------------------------------
   Keeps #content-area placed directly below #top-ui.
   Exposes two globals used by other scripts:
     positionContent()  — recalculate top offset
     fixScaleSpacing()  — compensate for CSS transform scale
============================================================ */

(function () {
  const content = document.getElementById("content-area");
  const topUI   = document.getElementById("top-ui");

  /* Fix extra blank space below icon-grid when --mobile-scale < 1.
     CSS transforms don't affect layout, so the scroll container sees the
     full pre-transform height. Compensate with a negative margin-bottom
     equal to: naturalHeight × (scale - 1), which is negative when scale < 1. */
  function fixScaleSpacing() {
    const isMobile = document.body.classList.contains("mobile-mode")
                  || document.documentElement.classList.contains("mobile-mode-loading");
    const cs = document.getElementById("content-scale");
    if (!cs) return;
    if (isMobile) {
      const scale = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--mobile-scale")
      ) || 1;
      const activeTab = cs.querySelector(".tab-content.active");
      const height    = activeTab ? activeTab.offsetHeight : cs.offsetHeight;
      cs.style.marginBottom = height * (scale - 1) + "px";
    } else {
      cs.style.marginBottom = "";
    }
  }
  window.fixScaleSpacing = fixScaleSpacing;

  function positionContent() {
    const baseTop = topUI.offsetHeight;

    // Only apply inline top positioning in desktop mode.
    // Mobile mode uses CSS fixed positioning (top: 0).
    const isMobileMode = document.body.classList.contains("mobile-mode")
                       || document.documentElement.classList.contains("mobile-mode-loading");

    if (!isMobileMode) {
      content.style.top = `${baseTop}px`;
    } else {
      content.style.top = "";   // Clear inline style in mobile mode
    }

    document.documentElement.style.setProperty("--top-ui-height", `${baseTop}px`);
    fixScaleSpacing();
  }
  window.positionContent = positionContent;

  let _resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(positionContent, 100);
  });

  requestAnimationFrame(positionContent);
})();
