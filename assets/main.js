(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── DOOM fire ───────────────────────────────────────────────
  // The PSX DOOM fire: a bottom row of white-hot pixels that spreads
  // upward, cooling and drifting sideways at random.
  // https://fabiensanglard.net/doom_fire_psx/
  // Banded pixel-art palette (from the fire pins on the reference board):
  // transparent, then red, orange, amber, yellow, white-hot.
  const BANDS = [null, [255, 26, 26], [255, 106, 0], [255, 176, 0], [255, 238, 0], [255, 255, 240]];
  const PALETTE = Array.from({ length: 37 }, (_, i) => BANDS[Math.min(BANDS.length - 1, Math.floor((i / 36) * (BANDS.length - 0.01)))]);
  const HOT = PALETTE.length - 1;

  const canvas = document.querySelector('canvas.fire');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const px = Math.max(2, Number(canvas.dataset.pixel) || 6);
    // wind: -1 blows left (the original), 1 right, 0 straight up with flicker
    const wind = { left: -1, right: 1 }[canvas.dataset.wind] ?? 0;
    let w, h, top, heat, image, running = false, visible = true, lit = true, last = 0;

    const resize = () => {
      w = Math.max(1, Math.ceil(canvas.clientWidth / px));
      h = Math.max(1, Math.ceil(canvas.clientHeight / px));
      canvas.width = w;
      canvas.height = h;
      heat = new Uint8Array(w * h);
      // Heat drops ~1 level per row, so size the heat scale to the canvas:
      // flames then reach most of the way up.
      top = Math.max(8, Math.round(h * 0.9));
      image = ctx.createImageData(w, h);
      setSource(lit ? top : 0);
      // Pre-warm so the first frame is already a full fire.
      for (let i = 0; i < h * 2; i++) step();
      draw();
    };

    const setSource = (v) => heat.fill(v, (h - 1) * w);

    // Filipe Deschamps' version of the spread step
    // (github.com/filipedeschamps/doom-fire-algorithm): each pixel takes the
    // heat of the one below minus a random 0-2, shifted sideways by that
    // same amount, which is what bends the flames in the wind.
    const step = () => {
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h - 1; y++) {
          const i = y * w + x;
          const decay = (Math.random() * 3) | 0;
          const v = heat[i + w] - decay;
          const shift = wind === 0 ? decay - 1 : wind * decay;
          const dst = i + shift;
          if (dst >= 0 && dst < heat.length - w) heat[dst] = v > 0 ? v : 0;
        }
      }
    };

    const draw = () => {
      const d = image.data;
      for (let i = 0; i < heat.length; i++) {
        const v = Math.round((heat[i] * HOT) / top);
        const c = PALETTE[v];
        const o = i * 4;
        if (!c) {
          d[o + 3] = 0; // coolest band is transparent so the card shows through
          continue;
        }
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
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
    // light pixels on the accent background
    const [r, gr, b] = [255, 255, 255];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W / 2; x++) {
        // denser towards the bottom, like embers
        if (rand() > 0.04 + (y / H) ** 2 * 0.45) continue;
        const k = 0.12 + rand() * 0.5 * (y / H + 0.2);
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

  // ── Pixel-dissolve edge above the footer ─────────────────
  const dissolve = document.querySelector('canvas.dissolve');
  if (dissolve) {
    const block = 8;
    const paint = () => {
      const W = Math.ceil(dissolve.clientWidth / block);
      const H = Math.ceil(dissolve.clientHeight / block);
      dissolve.width = W;
      dissolve.height = H;
      const g = dissolve.getContext('2d');
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
      const rand = seeded('dissolve');
      for (let y = 0; y < H; y++) {
        const p = ((y + 1) / H) ** 1.6; // denser towards the footer
        for (let x = 0; x < W; x++) if (rand() < p) g.fillRect(x, y, 1, 1);
      }
    };
    paint();
    window.addEventListener('resize', paint);
  }

  // ── Theme toggle ────────────────────────────────────────────
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    const root = document.documentElement;
    const current = () =>
      root.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const sync = () => {
      root.dataset.theme = current();
      toggle.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    };
    sync();
    toggle.addEventListener('click', () => {
      root.dataset.theme = current() === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('theme', root.dataset.theme);
      } catch (e) {}
      sync();
    });
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
