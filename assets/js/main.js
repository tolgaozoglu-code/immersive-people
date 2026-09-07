const toggle = document.getElementById('menu-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}


// Hero ambient dust
(function () {
  var cv = document.querySelector('.hero-dust');
  if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cx = cv.getContext('2d');
  function size() { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; }
  size(); addEventListener('resize', size);
  var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#F3F0E8';
  var N = 46, P = [];
  for (var i = 0; i < N; i++) P.push({
    x: Math.random(), y: Math.random(),
    r: 0.4 + Math.random() * 1.5,
    s: 0.00012 + Math.random() * 0.00045,
    dx: (Math.random() - 0.5) * 0.00008,
    o: 0.08 + Math.random() * 0.35,
    ph: Math.random() * 6.28
  });
  var t = 0;
  (function loop() {
    t += 0.008;
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.fillStyle = ink;
    for (var j = 0; j < N; j++) {
      var p = P[j];
      p.y -= p.s; p.x += p.dx + Math.sin(t + p.ph) * 0.00006;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
      cx.globalAlpha = p.o * (0.75 + 0.25 * Math.sin(t * 1.6 + p.ph));
      cx.beginPath();
      cx.arc(p.x * cv.width, p.y * cv.height, p.r, 0, 7);
      cx.fill();
    }
    requestAnimationFrame(loop);
  })();
})();


// Media archive: load embeds only on demand
document.querySelectorAll('.media-video').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var src = btn.getAttribute('data-embed');
    if (!src) return;
    var f = document.createElement('iframe');
    f.src = src;
    f.title = btn.getAttribute('aria-label') || 'Video';
    f.allow = 'autoplay; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    f.className = 'media-embed';
    btn.replaceWith(f);
  });
});
