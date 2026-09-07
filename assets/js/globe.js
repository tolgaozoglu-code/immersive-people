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

  // Projection helpers -------------------------------------------------
  var P = { R: 0, ox: 0, oy: 0, sinLat0: 0, cosLat0: 1, lon0: 0 };

  function project(lonDeg, latDeg) {
    var lon = lonDeg * rad, lat = latDeg * rad;
    var dl = lon - P.lon0;
    var cosC = P.sinLat0 * Math.sin(lat) + P.cosLat0 * Math.cos(lat) * Math.cos(dl);
    if (cosC <= 0) return null;                       // far side of the globe
    return [
      P.ox + P.R * Math.cos(lat) * Math.sin(dl),
      P.oy - P.R * (P.cosLat0 * Math.sin(lat) - P.sinLat0 * Math.cos(lat) * Math.cos(dl))
    ];
  }

  function stroke(points, ctx, close) {
    var started = false;
    ctx.beginPath();
    for (var i = 0; i < points.length; i++) {
      var p = project(points[i][0], points[i][1]);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else { ctx.lineTo(p[0], p[1]); }
    }
    if (close) ctx.closePath();
    ctx.stroke();
  }

  function draw() {
    if (!rings) return;
    var size = el.clientWidth || 28;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, size, size);

    var now = new Date();
    var sun = subSolar(now);
    P.lon0 = sun.lon * rad;                 // the meridian facing the sun
    var lat0 = sun.lat * 0.5 * rad;
    P.sinLat0 = Math.sin(lat0);
    P.cosLat0 = Math.cos(lat0);
    P.R = size / 2 - 0.75;
    P.ox = size / 2;
    P.oy = size / 2;

    var ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#F3F0E8";
    cx.strokeStyle = ink;
    cx.lineJoin = "round";
    cx.lineCap = "round";

    // Engraved plate: the sphere is described by lines, not by fill.
    cx.globalAlpha = 0.20;
    cx.lineWidth = 0.4;
    for (var lon = -180; lon < 180; lon += 30) {          // meridians
      var mer = [];
      for (var la = -90; la <= 90; la += 4) mer.push([lon, la]);
      stroke(mer, cx, false);
    }
    for (var lat = -60; lat <= 60; lat += 30) {           // parallels
      var par = [];
      for (var lo = -180; lo <= 180; lo += 4) par.push([lo, lat]);
      stroke(par, cx, false);
    }
    cx.globalAlpha = 0.30;
    var eq = [];
    for (var lo2 = -180; lo2 <= 180; lo2 += 4) eq.push([lo2, 0]);
    stroke(eq, cx, false);

    // Coastlines, drawn as an outline rather than a mass.
    cx.globalAlpha = 0.85;
    cx.lineWidth = 0.55;
    for (var i = 0; i < rings.length; i++) stroke(rings[i], cx, true);

    // The unlit half sits back a little.
    cx.save();
    cx.beginPath();
    cx.arc(P.ox, P.oy, P.R, 0, 6.283);
    cx.clip();
    var grad = cx.createRadialGradient(P.ox, P.oy, P.R * 0.2, P.ox, P.oy, P.R);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.6)");
    cx.fillStyle = grad;
    cx.globalAlpha = 1;
    cx.fillRect(0, 0, size, size);
    cx.restore();

    // Plate rim
    cx.globalAlpha = 0.6;
    cx.lineWidth = 0.7;
    cx.beginPath();
    cx.arc(P.ox, P.oy, P.R, 0, 6.283);
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
