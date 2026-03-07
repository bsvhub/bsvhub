/* ============================================================
   COUNTER.JS — Visitor counter via CounterAPI (plain text)
   ------------------------------------------------------------
   No external dependencies. Increments on each page load and
   injects the count as plain text into #visit-counter.
============================================================ */

(function () {
  function loadCounter() {
    const counterSpan = document.getElementById("visit-counter");
    if (counterSpan) {
      fetch("https://api.counterapi.dev/v1/bsvhubio/visits/up")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          counterSpan.textContent = data.count.toLocaleString();
        })
        .catch(function () {
          counterSpan.textContent = "—";
        });
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
