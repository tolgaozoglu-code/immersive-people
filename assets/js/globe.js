// A small globe beside the wordmark.
// Real coastlines, turned to the longitude that faces the sun right now, with
// the true day/night division. One turn per day, so it is accurate rather than
// animated: what you see is where the daylight actually is.
(function () {
  var el = document.getElementById("globe");
  if (!el) return;

  var canvas = document.createElement("canvas");
  el.appendChild(canvas);
  var cx = canvas.getContext("2d");
  var rad = Math.PI / 180;
  var rings = null;

  function gmst(date) {
    var jd = date.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
  }

  // Sub-solar point: the spot on Earth with the sun straight overhead.
  function subSolar(date) {
    var jd = date.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    var L = (280.460 + 0.9856474 * d) % 360;
    var g = ((357.528 + 0.9856003 * d) % 360) * rad;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var eps = (23.439 - 0.0000004 * d) * rad;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / rad;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam)) / rad;
    var lon = ((ra - gmst(date)) % 360 + 540) % 360 - 180;
    return { lat: dec, lon: lon };
  }

  function draw() {
    if (!rings) return;
    var size = el.clientWidth || 26;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, size, size);

    var now = new Date();
    var sun = subSolar(now);
    var lon0 = sun.lon;                    // daylight faces the viewer
    var lat0 = sun.lat * 0.5 * rad;        // slight seasonal tilt
    var R = size / 2 - 0.5;
    var ox = size / 2, oy = size / 2;
    var sinLat0 = Math.sin(lat0), cosLat0 = Math.cos(lat0);
    var ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#F3F0E8";

    // Ocean disc
    cx.beginPath();
    cx.arc(ox, oy, R, 0, 6.283);
    cx.fillStyle = ink;
    cx.globalAlpha = 0.16;
    cx.fill();
    cx.globalAlpha = 1;

    // Land, orthographic projection
    cx.fillStyle = ink;
    cx.globalAlpha = 0.85;
    for (var i = 0; i < rings.length; i++) {
      var ring = rings[i];
      var started = false;
      cx.beginPath();
      for (var j = 0; j < ring.length; j++) {
        var lon = ring[j][0] * rad, lat = ring[j][1] * rad;
        var dl = lon - lon0 * rad;
        var cosC = sinLat0 * Math.sin(lat) + cosLat0 * Math.cos(lat) * Math.cos(dl);
        if (cosC <= 0) { started = false; continue; }   // far side
        var x = ox + R * Math.cos(lat) * Math.sin(dl);
        var y = oy - R * (cosLat0 * Math.sin(lat) - sinLat0 * Math.cos(lat) * Math.cos(dl));
        if (!started) { cx.moveTo(x, y); started = true; } else { cx.lineTo(x, y); }
      }
      cx.closePath();
      cx.fill();
    }
    cx.globalAlpha = 1;

    // Night side: the hemisphere away from the sub-solar point.
    cx.save();
    cx.beginPath();
    cx.arc(ox, oy, R, 0, 6.283);
    cx.clip();
    var grad = cx.createRadialGradient(ox, oy, R * 0.15, ox, oy, R);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.62, "rgba(0,0,0,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0.8)");
    cx.fillStyle = grad;
    cx.fillRect(0, 0, size, size);
    cx.restore();

    // Rim
    cx.beginPath();
    cx.arc(ox, oy, R, 0, 6.283);
    cx.strokeStyle = ink;
    cx.globalAlpha = 0.35;
    cx.lineWidth = 0.6;
    cx.stroke();
    cx.globalAlpha = 1;
  }

  fetch("/assets/data/land.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      rings = d.rings;
      draw();
      setInterval(draw, 60000);   // Earth turns 0.25° a minute
      addEventListener("resize", draw);
    })
    .catch(function () { el.style.display = "none"; });
})();
