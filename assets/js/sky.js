// Faint sky layer.
// Draws the stars actually above the visitor right now: real catalogue
// positions (J2000, to magnitude 5.0), rotated by local sidereal time.
// Location is approximated from the browser's time zone, never requested.
(function () {
  var host = document.getElementById("sky-layer");
  if (!host) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.createElement("canvas");
  canvas.className = "sky-canvas";
  host.appendChild(canvas);
  var cx = canvas.getContext("2d");

  // Approximate observer position without a permission prompt.
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

  function observer() {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (ZONES[tz]) return { lat: ZONES[tz][0], lon: ZONES[tz][1] };
    // Fallback: longitude from the UTC offset, mid-northern latitude.
    var lon = -new Date().getTimezoneOffset() / 4;
    return { lat: 40, lon: Math.max(-180, Math.min(180, lon)) };
  }

  // Greenwich mean sidereal time in degrees.
  function gmst(date) {
    var jd = date.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
  }

  var obs = observer();
  var adaptive = host.dataset.adaptive === "true";
  var showStars = host.dataset.stars === "true";
  var starVisibility = 1;
  var twinkle = !reduced;

  // Sun position (low-precision NOAA formulae, ample for tinting a background).
  function sunAltitude(date, lat, lon) {
    var jd = date.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    var L = (280.460 + 0.9856474 * d) % 360;
    var g = ((357.528 + 0.9856003 * d) % 360) * rad;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var eps = (23.439 - 0.0000004 * d) * rad;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var ha = (gmst(date) + lon) * rad - ra;
    var L2 = lat * rad;
    return Math.asin(
      Math.sin(L2) * Math.sin(dec) + Math.cos(L2) * Math.cos(dec) * Math.cos(ha)
    ) / rad;
  }

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  // Near-black throughout; only the temperature of the black changes.
  var NIGHT = [7, 9, 14];      // cool, deep
  var TWILIGHT = [18, 12, 10]; // ember
  var DAY = [15, 15, 14];      // neutral graphite

  function tint(alt) {
    var c;
    if (alt <= -18) c = NIGHT;
    else if (alt <= -4) c = mix(NIGHT, TWILIGHT, (alt + 18) / 14);
    else if (alt <= 8) c = mix(TWILIGHT, DAY, (alt + 4) / 12);
    else c = DAY;
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }

  function applyAmbience() {
    var alt = sunAltitude(new Date(), obs.lat, obs.lon);
    if (adaptive) {
      document.documentElement.style.setProperty("--bg", tint(alt));
    }
    // Stars belong to the night: fade them out as the sun climbs.
    starVisibility = Math.max(0, Math.min(1, (-alt - 2) / 10));
    if (host) host.style.opacity = (0.85 * starVisibility).toFixed(3);
  }

  var stars = null;
  var rad = Math.PI / 180;

  var painted = [];   // ekrandaki yıldızlar: konum, boy, parlaklık, sönme ritmi

  function compute() {
    if (!stars) return;
    var w = host.clientWidth, h = host.clientHeight;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var lst = (gmst(new Date()) + obs.lon) * rad;
    var latR = obs.lat * rad;
    var sinLat = Math.sin(latR), cosLat = Math.cos(latR);
    var R = Math.max(w, h) * 0.72;
    var ox = w / 2, oy = h * 0.52;

    painted = [];
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var ha = lst - s[0] * rad;
      var dec = s[1] * rad;
      var sinDec = Math.sin(dec), cosDec = Math.cos(dec);
      var sinAlt = sinLat * sinDec + cosLat * cosDec * Math.cos(ha);
      if (sinAlt <= 0.02) continue;
      var altR = Math.asin(sinAlt);
      var az = Math.atan2(
        -Math.sin(ha) * cosDec,
        cosDec * Math.cos(ha) * sinLat - sinDec * cosLat
      );
      var r = R * Math.tan((Math.PI / 2 - altR) / 2);
      var x = ox + r * Math.sin(az);
      var y = oy - r * Math.cos(az);
      if (x < -8 || x > w + 8 || y < -8 || y > h + 8) continue;

      var mag = s[2];
      painted.push({
        x: x,
        y: y,
        size: Math.max(0.5, (5.2 - mag) * 0.46),
        alpha: Math.max(0.12, Math.min(0.95, (5.6 - mag) / 5.2)) * Math.min(1, sinAlt * 2.4),
        // Scintillation is strongest low on the horizon and for faint stars,
        // which is also how the eye actually sees it.
        amp: Math.min(0.55, (1 - sinAlt) * 0.42 + (mag / 5) * 0.16),
        speed: 0.7 + Math.random() * 1.9,
        phase: Math.random() * 6.283
      });
    }
  }

  function render(t) {
    var w = canvas.width, h = canvas.height;
    cx.clearRect(0, 0, w, h);
    var ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#F3F0E8";
    cx.fillStyle = ink;
    for (var i = 0; i < painted.length; i++) {
      var p = painted[i];
      var flicker = twinkle ? 1 + p.amp * Math.sin(t * p.speed + p.phase) : 1;
      cx.globalAlpha = Math.max(0, Math.min(1, p.alpha * flicker));
      cx.beginPath();
      cx.arc(p.x, p.y, p.size, 0, 6.283);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  var last = 0;
  function loop(ts) {
    if (document.hidden) { requestAnimationFrame(loop); return; }
    if (ts - last > 55) {            // ~18 fps, gözle akıcı, pilde ucuz
      last = ts;
      render(ts / 1000);
    }
    requestAnimationFrame(loop);
  }

  function draw() {
    compute();
    render(performance.now() / 1000);
  }

  var pending;
  addEventListener("resize", function () {
    clearTimeout(pending);
    pending = setTimeout(draw, 200);
  });

  applyAmbience();
  setInterval(applyAmbience, 60000);

  if (!showStars) return;

  fetch("/assets/data/stars.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      stars = d.stars;
      draw();
      // Positions only need refreshing now and then: the sky turns 15° an hour.
      setInterval(compute, 30000);
      if (twinkle) requestAnimationFrame(loop);
    })
    .catch(function () {});
})();
