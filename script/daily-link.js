(function () {
  const baseUrl = "https://hummingbox-dnev6xbilq-uc.a.run.app/";

  // Get current date in UTC-12
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Etc/GMT+12",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const yyyy = parts.find(p => p.type === "year").value;
  const mm   = parts.find(p => p.type === "month").value;
  const dd   = parts.find(p => p.type === "day").value;

  document.getElementById("daily-link").href =
    `${baseUrl}${yyyy}-${mm}-${dd}`;
})();
