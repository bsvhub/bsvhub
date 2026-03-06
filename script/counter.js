/* ============================================================
   COUNTER.JS — Visitor counter iframe injection
   ------------------------------------------------------------
   No external dependencies.
============================================================ */

(function () {
    function loadCounter() {
        const counterSpan = document.getElementById("visit-counter");
        if (counterSpan) {
            const iframe = document.createElement("iframe");
            iframe.style.border        = "none";
            iframe.style.width         = "100%";
            iframe.style.height        = "30px";
            iframe.style.verticalAlign = "middle";
            iframe.style.display       = "block";
            iframe.style.marginTop     = "10px";
            counterSpan.appendChild(iframe);

            const iframeDoc = iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write('<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:monospace;font-size:2rem;color:#ffd700;text-align:center;"><script src="https://counter.websiteout.com/js/7/6/0/0"><\/script></body></html>');
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
