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
    if (cosC <= 0) return null;
    return [
      P.ox + P.R * Math.cos(lat) * Math.sin(dl),
      P.oy - P.R * (P.cosLat0 * Math.sin(lat) - P.sinLat0 * Math.cos(lat) * Math.cos(dl))
    ];
  }

  function trace(points, ctx, close) {
    var started = false, drew = false;
    for (var i = 0; i < points.length; i++) {
      var p = project(points[i][0], points[i][1]);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else { ctx.lineTo(p[0], p[1]); }
      drew = true;
    }
    if (close && drew) ctx.closePath();
    return drew;
  }

  // Engraving hatch: parallel ruling, the way a plate is cut.
  function hatch(color, spacing, angle, width) {
    var c = document.createElement("canvas");
    var n = spacing * 4;
    c.width = c.height = n;
    var g = c.getContext("2d");
    g.strokeStyle = color;
    g.lineWidth = width;
    g.translate(n / 2, n / 2);
    g.rotate(angle);
    g.translate(-n / 2, -n / 2);
    for (var y = -n; y < n * 2; y += spacing) {
      g.beginPath();
      g.moveTo(-n, y);
      g.lineTo(n * 2, y);
      g.stroke();
    }
    return cx.createPattern(c, "repeat");
  }

  function draw() {
    if (!rings) return;
    var size = el.clientWidth || 40;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, size, size);

    var now = new Date();
    var sun = subSolar(now);
    P.lon0 = sun.lon * rad;
    var lat0 = sun.lat * 0.5 * rad;
    P.sinLat0 = Math.sin(lat0);
    P.cosLat0 = Math.cos(lat0);
    P.R = size / 2 - 0.75;
    P.ox = size / 2;
    P.oy = size / 2;

    var ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#F3F0E8";
    // Below roughly 60px the plate cannot hold ruling: it turns to noise, so
    // the drawing is reduced to clean line work at that size.
    var detailed = size * dpr >= 120;
    var gratStep = detailed ? 30 : 45;

    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.strokeStyle = ink;

    // Everything is drawn inside the disc.
    cx.save();
    cx.beginPath();
    cx.arc(P.ox, P.oy, P.R, 0, 6.283);
    cx.clip();

    // Graticule
    cx.globalAlpha = detailed ? 0.16 : 0.13;
    cx.lineWidth = 0.4;
    cx.beginPath();
    for (var lon = -180; lon < 180; lon += gratStep) {
      var mer = [];
      for (var la = -80; la <= 80; la += 4) mer.push([lon, la]);
      trace(mer, cx, false);
    }
    for (var lat = -gratStep; lat <= gratStep; lat += gratStep) {
      var par = [];
      for (var lo = -180; lo <= 180; lo += 4) par.push([lo, lat]);
      trace(par, cx, false);
    }
    cx.stroke();

    // Land
    cx.beginPath();
    var any = false;
    for (var i = 0; i < rings.length; i++) if (trace(rings[i], cx, true)) any = true;
    if (any) {
      if (detailed) {
        cx.save();
        cx.clip();
        var step = Math.max(2, Math.round(2.4 * dpr)) / dpr;
        cx.globalAlpha = 0.7;
        cx.fillStyle = hatch(ink, step, -Math.PI / 4, 0.5);
        cx.fillRect(0, 0, size, size);
        cx.restore();
      } else {
        cx.globalAlpha = 0.5;
        cx.fillStyle = ink;
        cx.fill("evenodd");
      }
      cx.globalAlpha = detailed ? 0.85 : 0.8;
      cx.lineWidth = 0.5;
      cx.stroke();
    }

    // Volume: the limb away from the sun falls off.
    var grad = cx.createRadialGradient(
      P.ox - P.R * 0.2, P.oy - P.R * 0.2, P.R * 0.1,
      P.ox, P.oy, P.R
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.2)");
    grad.addColorStop(1, "rgba(0,0,0,0.65)");
    cx.globalAlpha = 1;
    cx.fillStyle = grad;
    cx.fillRect(0, 0, size, size);
    cx.restore();

    // Rim
    cx.globalAlpha = 0.7;
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
