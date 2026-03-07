(function () {
  fetch("/api/count")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var el = document.getElementById("visit-counter");
      if (el) el.textContent = Number(data.count).toLocaleString();
    });

  fetch("/list.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var el = document.getElementById("link-counter");
      if (el) el.textContent = Number(data.items.length).toLocaleString();
    });
})();
