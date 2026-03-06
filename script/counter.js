/* ============================================================
   COUNTER.JS — Visitor counter iframe injection
   ------------------------------------------------------------
   No external dependencies.
============================================================ */

(function () {
  function loadCounter() {
    const counterSpan = document.getElementById("visit-counter");
    if (counterSpan) {
      // Ensure the counter box aligns cleanly with surrounding text
      counterSpan.style.display = "inline-flex";
      counterSpan.style.alignItems = "baseline";   // align to text baseline
      counterSpan.style.justifyContent = "center";
      counterSpan.style.minWidth = "64px";         // optional: avoids layout shift when script loads
      counterSpan.style.lineHeight = "1";          // tighter box so the iframe sits nicely

      const iframe = document.createElement("iframe");
      iframe.style.border        = "none";
      iframe.style.display       = "inline-block"; // inline context for vertical-align/baseline
      iframe.style.width         = "auto";         // do not stretch to container width
      iframe.style.height        = "30px";         // a touch shorter than before (tweak as needed)
      iframe.style.verticalAlign = "baseline";     // align with text baseline
      iframe.style.margin        = "0";            // remove top margin
      iframe.style.transform = "translate(-98px, -5px)"; // left 200px, up 5px
      // If you want a tad more visual balance, you can also add:
      // iframe.style.marginLeft = "4px";

      counterSpan.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:monospace;font-size:2rem;color:#ffd700;text-align:center;"><script type="text/javascript" src="https://counter.websiteout.com/js/12/6/101/1"></script></body></html>');
      iframeDoc.close();
    } else {
      setTimeout(loadCounter, 100);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadCounter);
  } else {
    loadCounter();
  }
})();
