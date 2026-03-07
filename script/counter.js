/* ============================================================
   COUNTER.JS — Visitor counter via CounterAPI (plain text)
   ------------------------------------------------------------
   No external dependencies. Increments on each page load and
   injects the count as plain text into #visit-counter.
============================================================ */

(function () {
  function loadCounter() {
    var counterSpan = document.getElementById("visit-counter");
    if (counterSpan) {
      fetch("https://api.counterapi.dev/v1/bsvhubio/visits/up")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          console.log("CounterAPI response:", data);
          // API may return count under data.value, data.count, or data.data.value
          var count = (data.value !== undefined) ? data.value
                    : (data.count !== undefined) ? data.count
                    : (data.data && data.data.value !== undefined) ? data.data.value
                    : null;
          counterSpan.textContent = count !== null ? Number(count).toLocaleString() : "—";
        })
        .catch(function (err) {
          console.error("CounterAPI error:", err);
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
