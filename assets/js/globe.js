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
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var breath = 1;
  var spin = 0;

  // Major cities, used only to place lights on the night side.
  var CITIES = [
    [41.0,29.0],[51.5,-0.1],[48.9,2.4],[52.5,13.4],[40.4,-3.7],[41.9,12.5],
    [55.8,37.6],[59.3,18.1],[52.4,4.9],[38.0,23.7],[30.0,31.2],[6.5,3.4],
    [-26.2,28.0],[-1.3,36.8],[25.2,55.3],[24.7,46.7],[35.7,51.4],[28.6,77.2],
    [19.1,72.9],[13.1,80.3],[23.8,90.4],[13.8,100.5],[1.35,103.8],[-6.2,106.8],
    [14.6,121.0],[31.2,121.5],[39.9,116.4],[22.3,114.2],[37.6,127.0],[35.7,139.7],
    [-33.9,151.2],[-37.8,145.0],[-36.8,174.8],[40.7,-74.0],[34.1,-118.2],[41.9,-87.6],
    [19.4,-99.1],[4.7,-74.1],[-12.0,-77.0],[-34.6,-58.4],[-23.6,-46.6],[45.5,-73.6]
  ];

  // Each visit is a fresh impression from the plate: the ruling is re-cut at a
  // slightly different angle and weight, the way no two prints are identical.

  // The visitor's approximate position, from the time zone. No prompt.
  var ZONES = {
    "Europe/Istanbul": [41.0, 29.0], "Europe/London": [51.5, -0.1],
    "Europe/Paris": [48.9, 2.4], "Europe/Berlin": [52.5, 13.4],
    "Europe/Madrid": [40.4, -3.7], "Europe/Rome": [41.9, 12.5],
    "Europe/Amsterdam": [52.4, 4.9], "Europe/Moscow": [55.8, 37.6],
    "America/New_York": [40.7, -74.0], "America/Chicago": [41.9, -87.6],
    "America/Denver": [39.7, -105.0], "America/Los_Angeles": [34.1, -118.2],
    "America/Sao_Paulo": [-23.6, -46.6], "America/Mexico_City": [19.4, -99.1],
    "Asia/Dubai": [25.2, 55.3], "Asia/Tokyo": [35.7, 139.7],
    "Asia/Shanghai": [31.2, 121.5], "Asia/Singapore": [1.35, 103.8],
    "Asia/Kolkata": [19.1, 72.9], "Asia/Seoul": [37.6, 127.0],
    "Australia/Sydney": [-33.9, 151.2], "Africa/Johannesburg": [-26.2, 28.0],
    "Africa/Cairo": [30.0, 31.2], "Africa/Lagos": [6.5, 3.4]
  };
  var here = (function () {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (ZONES[tz]) return { lat: ZONES[tz][0], lon: ZONES[tz][1] };
    return { lat: 40, lon: Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4)) };
  })();

  // Direction cosines in view space; z > 0 means the point faces us.
  function viewVector(lonDeg, latDeg) {
    var lon = lonDeg * rad, lat = latDeg * rad, dl = lon - P.lon0;
    return {
      x: Math.cos(lat) * Math.sin(dl),
      y: P.cosLat0 * Math.sin(lat) - P.sinLat0 * Math.cos(lat) * Math.cos(dl),
      z: P.sinLat0 * Math.sin(lat) + P.cosLat0 * Math.cos(lat) * Math.cos(dl)
    };
  }

  var seed = Math.random();
  function rnd(n) {                       // stable pseudo-random per index
    var t = (n * 1103515245 + seed * 1e9) >>> 0;
    t = (t ^ (t >>> 15)) * 2246822507;
    t = (t ^ (t >>> 13)) * 3266489909;
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  }
  var plate = {
    angle: -Math.PI / 4 + (seed - 0.5) * 0.5,
    spacing: 2.2 + (seed - 0.5) * 0.7,
    weight: 0.45 + seed * 0.2,
    wobble: (seed - 0.5) * 0.8
  };

  function sunAltAt(date, lat, lon) {
    var jd = date.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    var L = (280.460 + 0.9856474 * d) % 360;
    var g = ((357.528 + 0.9856003 * d) % 360) * rad;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var eps = (23.439 - 0.0000004 * d) * rad;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var ha = (gmst(date) + lon) * rad - ra;
    return Math.asin(
      Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)
    ) / rad;
  }


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

  function trace(points, ctx, close, wobble) {
    var started = false, drew = false;
    for (var i = 0; i < points.length; i++) {
      var p = project(points[i][0], points[i][1]);
      if (!p) { started = false; continue; }
      if (wobble) {
        // A cut line, not a printed one: the burin never runs perfectly true.
        p[0] += (rnd(i * 7 + points.length) - 0.5) * wobble;
        p[1] += (rnd(i * 13 + points.length) - 0.5) * wobble;
      }
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
    // The visitor's meridian faces us, so their place is always in view; the
    // day/night division sweeps across it in real time instead.
    P.lon0 = (here.lon + spin) * rad;
    var lat0 = here.lat * 0.55 * rad;
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
    // Land is described only by its cut outline.
    cx.beginPath();
    var any = false;
    var wob = 0.3 + Math.abs(plate.wobble) * 0.45;
    for (var i = 0; i < rings.length; i++) if (trace(rings[i], cx, true, wob)) any = true;
    if (any) {
      cx.globalAlpha = 0.9;
      cx.lineWidth = 0.6;
      cx.stroke();
    }
    cx.globalAlpha = 1;

    // Daylight falls from wherever the sun actually is.
    var sv = viewVector(sun.lon, sun.lat);
    var lx = P.ox + P.R * sv.x * 1.1;
    var ly = P.oy - P.R * sv.y * 1.1;
    var behind = sv.z < 0;
    var grad = cx.createRadialGradient(lx, ly, P.R * 0.1, lx, ly, P.R * 2.0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.45, behind ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.18)");
    grad.addColorStop(1, behind ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.62)");
    cx.globalAlpha = 1;
    cx.fillStyle = grad;
    cx.fillRect(0, 0, size, size);

    // City lights, over the shadow so the night side actually glows.
    cx.fillStyle = ink;
    for (var c = 0; c < CITIES.length; c++) {
      var la2 = CITIES[c][0], lo2 = CITIES[c][1];
      var pt = project(lo2, la2);
      if (!pt) continue;
      var alt = sunAltAt(now, la2, lo2);
      if (alt > -4) continue;
      var darkness = Math.min(1, (-alt - 4) / 10);
      cx.globalAlpha = Math.min(1, (0.4 + 0.55 * darkness) * breath);
      cx.beginPath();
      cx.arc(pt[0], pt[1], detailed ? 1.0 : 0.85, 0, 6.283);
      cx.fill();
    }

    // The visitor's own position.
    var v = viewVector(here.lon, here.lat);
    if (v.z > 0.02) {
      var hx = P.ox + P.R * v.x, hy = P.oy - P.R * v.y;
      cx.fillStyle = "#E4483C";
      cx.globalAlpha = Math.min(1, 0.28 * breath);
      cx.beginPath();
      cx.arc(hx, hy, 3.2, 0, 6.283);
      cx.fill();
      cx.globalAlpha = Math.min(1, 0.95 * breath);
      cx.beginPath();
      cx.arc(hx, hy, detailed ? 1.5 : 1.3, 0, 6.283);
      cx.fill();
    }
    cx.globalAlpha = 1;
    cx.restore();

    // Rim
    cx.globalAlpha = 0.7;
    cx.lineWidth = 0.7;
    cx.beginPath();
    cx.arc(P.ox, P.oy, P.R, 0, 6.283);
    cx.stroke();
    cx.globalAlpha = 1;
  }

  // The globe turns gently on its own; the light stays where the sun is.
  var lastFrame = 0;
  function animate(ts) {
    requestAnimationFrame(animate);
    if (document.hidden) return;
    if (ts - lastFrame < 66) return;          // 15 fps
    lastFrame = ts;
    spin = (ts / 1000) * 2.4;                 // one turn every 150 seconds
    breath = 1 + 0.07 * Math.sin(ts / 2600);
    draw();
  }

  fetch("/assets/data/land.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      rings = d.rings;
      draw();
      setInterval(draw, 60000);
      if (!reduced) requestAnimationFrame(animate);
      addEventListener("resize", draw);
    })
    .catch(function () { el.style.display = "none"; });
})();
