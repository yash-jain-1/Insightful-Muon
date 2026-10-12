(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── DOOM fire ───────────────────────────────────────────────
  // The PSX DOOM fire: a bottom row of white-hot pixels that spreads
  // upward, cooling and drifting sideways at random.
  // https://fabiensanglard.net/doom_fire_psx/
  const PALETTE = [
    [7, 7, 7], [31, 7, 7], [47, 15, 7], [71, 15, 7], [87, 23, 7], [103, 31, 7],
    [119, 31, 7], [143, 39, 7], [159, 47, 7], [175, 63, 7], [191, 71, 7], [199, 71, 7],
    [223, 79, 7], [223, 87, 7], [223, 87, 7], [215, 95, 7], [215, 95, 7], [215, 103, 15],
    [207, 111, 15], [207, 119, 15], [207, 127, 15], [207, 135, 23], [199, 135, 23],
    [199, 143, 23], [199, 151, 31], [191, 159, 31], [191, 159, 31], [191, 167, 39],
    [191, 167, 39], [191, 175, 47], [183, 175, 47], [183, 183, 47], [183, 183, 55],
    [207, 207, 111], [223, 223, 159], [239, 239, 199], [255, 255, 255],
  ];
  const HOT = PALETTE.length - 1;

  const canvas = document.querySelector('canvas.fire');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const px = Math.max(2, Number(canvas.dataset.pixel) || 6);
    let w, h, top, heat, image, running = false, visible = true, lit = true, last = 0;

    const resize = () => {
      w = Math.max(1, Math.ceil(canvas.clientWidth / px));
      h = Math.max(1, Math.ceil(canvas.clientHeight / px));
      canvas.width = w;
      canvas.height = h;
      heat = new Uint8Array(w * h);
      // Classic decay loses ~1 level every 2 rows, so size the heat scale to
      // the canvas: flames then die out a bit past halfway up.
      top = Math.max(8, Math.round(h * 0.27));
      image = ctx.createImageData(w, h);
      setSource(lit ? top : 0);
      // Pre-warm so the first frame is already a full fire.
      for (let i = 0; i < h * 2; i++) step();
      draw();
    };

    const setSource = (v) => heat.fill(v, (h - 1) * w);

    const step = () => {
      for (let x = 0; x < w; x++) {
        for (let y = 1; y < h; y++) {
          const src = y * w + x;
          const v = heat[src];
          if (v === 0) {
            heat[src - w] = 0;
          } else {
            const r = Math.round(Math.random() * 3) & 3;
            heat[Math.max(0, src - r + 1 - w)] = v - (r & 1);
          }
        }
      }
    };

    const draw = () => {
      const d = image.data;
      // Skip the white-hot source row; it reads as a hard line.
      for (let i = 0; i < heat.length - w; i++) {
        const v = Math.round((heat[i] * HOT) / top);
        const [r, g, b] = PALETTE[v];
        const o = i * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b;
        // Coldest colour is transparent so the page shows through.
        d[o + 3] = v === 0 ? 0 : Math.min(255, v * 64);
      }
      ctx.putImageData(image, 0, 0);
    };

    const loop = (t) => {
      if (!running) return;
      if (t - last > 1000 / 30) {
        step();
        draw();
        last = t;
      }
      requestAnimationFrame(loop);
    };

    const update = () => {
      const should = visible && !document.hidden && !reduceMotion.matches;
      if (should && !running) {
        running = true;
        requestAnimationFrame(loop);
      } else if (!should) {
        running = false;
      }
    };

    // Click the fire to douse it, click again to relight.
    canvas.addEventListener('click', () => {
      lit = !lit;
      setSource(lit ? top : 0);
      if (reduceMotion.matches) {
        for (let i = 0; i < h * 2; i++) step();
        draw();
      }
    });

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      update();
    }).observe(canvas);
    document.addEventListener('visibilitychange', update);
    reduceMotion.addEventListener?.('change', update);
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    resize();
    update();
  }

  // ── Pixelated images ───────────────────────────────────────
  // Each .pixelate image gets a low-res canvas laid over it; hovering
  // or focusing the card reveals the real image underneath.
  const pixelate = (imgEl) => {
    const blocks = 48;
    const ratio = imgEl.naturalHeight / imgEl.naturalWidth || 1;
    const c = document.createElement('canvas');
    c.width = blocks;
    c.height = Math.max(1, Math.round(blocks * ratio));
    c.className = 'pixel-cover';
    c.setAttribute('aria-hidden', 'true');
    c.getContext('2d').drawImage(imgEl, 0, 0, c.width, c.height);
    imgEl.parentElement.classList.add('has-pixels');
    imgEl.after(c);
  };
  document.querySelectorAll('img.pixelate').forEach((el) => {
    if (el.complete && el.naturalWidth) pixelate(el);
    else el.addEventListener('load', () => pixelate(el), { once: true });
  });

  // ── Generated pixel covers ──────────────────────────────────
  // Featured projects without an image get a mirrored pixel pattern,
  // seeded by the title so it never changes between visits.
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff6a1a';
  const rgb = (hex) => {
    const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const seeded = (str) => {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  };
  document.querySelectorAll('.feature-img.gen').forEach((el) => {
    const rand = seeded(el.dataset.seed || 'x');
    const W = 32, H = 20;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.className = 'gen-canvas';
    const g = c.getContext('2d');
    const [r, gr, b] = rgb(accent);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W / 2; x++) {
        // denser towards the bottom, like embers
        if (rand() > 0.18 + (y / H) * 0.5) continue;
        const k = 0.15 + rand() * 0.85 * (y / H + 0.3);
        g.fillStyle = `rgba(${r},${gr},${b},${Math.min(1, k).toFixed(2)})`;
        g.fillRect(x, y, 1, 1);
        g.fillRect(W - 1 - x, y, 1, 1);
      }
    }
    el.prepend(c);
  });

  // ── Active nav link ─────────────────────────────────────────
  const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
  if (navLinks.length && 'IntersectionObserver' in window) {
    const byId = Object.fromEntries(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          navLinks.forEach((a) => a.removeAttribute('aria-current'));
          byId[e.target.id]?.setAttribute('aria-current', 'true');
        }),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    document.querySelectorAll('main > section[id]').forEach((s) => spy.observe(s));
  }

  // ── Section reveal ─────────────────────────────────────────
  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.section').forEach((s) => {
      s.classList.add('reveal');
      io.observe(s);
    });
  }
})();
