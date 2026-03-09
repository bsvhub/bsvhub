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

  /* fixScaleSpacing — previously compensated for transform:scale() not
     affecting layout. Now that mobile uses zoom (which DOES affect layout)
     the scroll container sees the correct height natively. Kept for
     backwards compatibility with call sites in other scripts. */
  function fixScaleSpacing() {
    var cs = document.getElementById("content-scale");
    if (cs) cs.style.marginBottom = "";
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
