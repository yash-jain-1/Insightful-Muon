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
      document.dispatchEvent(new CustomEvent('fire:toggle', { detail: { lit } }));
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
      g.fillStyle = getComputedStyle(dissolve.parentElement).backgroundColor;
      const rand = seeded('dissolve');
      for (let y = 0; y < H; y++) {
        const p = ((y + 1) / H) ** 1.6; // denser towards the footer
        for (let x = 0; x < W; x++) if (rand() < p) g.fillRect(x, y, 1, 1);
      }
    };
    paint();
    window.addEventListener('resize', paint);
    document.addEventListener('theme:change', paint);
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
      document.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: root.dataset.theme } }));
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

  // ── Mascot ─────────────────────────────────────────────────
  // A black blob cat (from the reference board) that trails the cursor,
  // looks where you point and reacts to what happens on the page. It never
  // takes clicks (pointer-events: none) and screen readers skip it.
  const cfgEl = document.getElementById('mascot-config');
  if (cfgEl) {
    let cfg = {};
    try {
      cfg = JSON.parse(cfgEl.textContent);
    } catch (e) {}
    const lines = cfg.lines || {};
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const follows = cfg.follow !== false && finePointer && !reduceMotion.matches;

    // 12x12 sprite. # = fur. Ears get an extra row when perked.
    const BODY = [
      '............',
      '.#........#.',
      '.##......##.',
      '.###....###.',
      '.##########.',
      '############',
      '############',
      '############',
      '############',
      '############',
      '.##########.',
      '..##....##..',
    ];
    const EYES = [
      [2, 6],
      [8, 6],
    ]; // top-left of each 2x2 eye
    const S = 4; // screen pixels per sprite pixel

    const el = document.createElement('div');
    el.className = 'mascot' + (follows ? '' : ' parked');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="mascot-bubble"></div><canvas width="12" height="12"></canvas>';
    document.body.appendChild(el);
    const cv = el.querySelector('canvas');
    const g = cv.getContext('2d');
    const bubble = el.querySelector('.mascot-bubble');

    const state = {
      x: window.innerWidth - 80,
      y: window.innerHeight - 80,
      tx: window.innerWidth - 80,
      ty: window.innerHeight - 80,
      mx: window.innerWidth / 2,
      my: window.innerHeight / 2,
      eyes: 'open', // open | closed | happy | star | dizzy
      eyesUntil: 0,
      perkUntil: 0,
      hop: 0,
      last: performance.now(),
      frame: 0,
      asleep: false,
    };
    const isBlack = () => document.documentElement.dataset.theme === 'dark';

    let bubbleTimer;
    const say = (key, extra = '') => {
      const text = lines[key];
      if (!text) return;
      bubble.textContent = text + extra;
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 1800);
    };
    const mood = (eyes, ms) => {
      state.eyes = eyes;
      state.eyesUntil = performance.now() + ms;
    };
    const hop = () => {
      if (!reduceMotion.matches) state.hop = 8;
    };
    const wake = () => {
      state.last = performance.now();
      if (state.asleep) {
        state.asleep = false;
        bubble.classList.remove('show');
        mood('open', 0);
        say('wake');
        hop();
      }
    };

    const draw = () => {
      const now = performance.now();
      if (state.eyesUntil && now > state.eyesUntil) {
        state.eyes = 'open';
        state.eyesUntil = 0;
      }
      g.clearRect(0, 0, 12, 12);
      g.fillStyle = '#0a0a0a';
      BODY.forEach((row, y) =>
        [...row].forEach((c, x) => {
          if (c === '#') g.fillRect(x, y, 1, 1);
        }),
      );
      if (now < state.perkUntil) {
        g.fillRect(1, 0, 1, 1);
        g.fillRect(10, 0, 1, 1);
      }
      const eyeCol = isBlack() ? getComputedStyle(document.documentElement).getPropertyValue('--highlight') : '#ffffff';
      const blink = state.eyes === 'open' && state.frame % 48 < 2;
      const eyes = state.asleep ? 'closed' : blink ? 'closed' : state.eyes;
      // where to look: towards the pointer
      const r = el.getBoundingClientRect();
      const lx = state.mx > r.left + r.width / 2 ? 1 : 0;
      const ly = state.my > r.top + r.height / 2 ? 1 : 0;
      EYES.forEach(([ex, ey]) => {
        g.fillStyle = eyeCol;
        if (eyes === 'open') {
          g.fillRect(ex, ey, 2, 2);
          g.fillStyle = '#0a0a0a';
          g.fillRect(ex + lx, ey + ly, 1, 1);
        } else if (eyes === 'closed') {
          g.fillRect(ex, ey + 1, 2, 1);
        } else if (eyes === 'happy') {
          g.fillRect(ex, ey, 2, 1);
        } else if (eyes === 'star') {
          g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--highlight');
          g.fillRect(ex, ey, 2, 2);
          g.fillStyle = '#ffffff';
          g.fillRect(ex + 1, ey, 1, 1);
        } else if (eyes === 'dizzy') {
          const f = (state.frame >> 2) % 2;
          g.fillRect(ex + f, ey, 1, 1);
          g.fillRect(ex + 1 - f, ey + 1, 1, 1);
        }
      });
    };

    // Move at a steady pixel pace toward a spot just below-right of the pointer.
    const tick = () => {
      state.frame++;
      const now = performance.now();
      if (follows) {
        const dx = state.tx - state.x;
        const dy = state.ty - state.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) {
          const v = Math.min(d, 2 + d * 0.06);
          state.x += (dx / d) * v;
          state.y += (dy / d) * v;
          if (state.hop <= 0 && state.frame % 10 === 0) state.hop = 4; // little walking hops
        }
        el.style.transform = `translate(${Math.round(state.x / S) * S}px, ${Math.round(state.y / S) * S - (state.hop > 0 ? S * Math.ceil(state.hop / 4) : 0)}px)`;
      } else if (state.hop > 0) {
        el.style.transform = `translateY(${-S * Math.ceil(state.hop / 4)}px)`;
      } else {
        el.style.transform = '';
      }
      if (state.hop > 0) state.hop--;
      if (!state.asleep && now - state.last > 10000) {
        state.asleep = true;
        bubble.textContent = 'zZz';
        bubble.classList.add('show', 'sleepy');
      }
      if (!state.asleep) bubble.classList.remove('sleepy');
      if (state.frame % 5 === 0) draw(); // ~12 fps sprite, like a game
      requestAnimationFrame(tick);
    };

    // Pointer tracking + shake detection
    let lastX = 0,
      lastDir = 0,
      flips = [];
    window.addEventListener(
      'pointermove',
      (e) => {
        state.mx = e.clientX;
        state.my = e.clientY;
        state.tx = Math.min(window.innerWidth - 56, e.clientX + 22);
        state.ty = Math.min(window.innerHeight - 56, e.clientY + 22);
        wake();
        const dir = Math.sign(e.clientX - lastX);
        if (dir && dir !== lastDir && Math.abs(e.clientX - lastX) > 8) {
          const now = performance.now();
          flips = flips.filter((t) => now - t < 700);
          flips.push(now);
          if (flips.length >= 6 && state.eyes !== 'dizzy') {
            mood('dizzy', 1600);
            say('dizzy');
            flips = [];
          }
          lastDir = dir;
        }
        lastX = e.clientX;
      },
      { passive: true },
    );

    // Reactions to the page
    let lastLink = null;
    document.addEventListener('pointerover', (e) => {
      const card = e.target.closest('.feature, .card, .stat');
      if (card && !card.contains(e.relatedTarget)) {
        mood('star', 1400);
        if (!card.dataset.seen) {
          card.dataset.seen = '1';
          say('project');
        }
      }
      const link = e.target.closest('a, button');
      if (link && link !== lastLink) {
        lastLink = link;
        state.perkUntil = performance.now() + 900;
        if (!card) say('link');
      }
      if (!link) lastLink = null;
    });
    document.addEventListener('pointerdown', (e) => {
      wake();
      const r = el.getBoundingClientRect();
      const near = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < 48;
      if (near) {
        mood('happy', 1600);
        say('pet', ' <3');
      }
      hop();
    });
    document.addEventListener('fire:toggle', (e) => {
      mood(e.detail.lit ? 'happy' : 'dizzy', 1400);
      say(e.detail.lit ? 'relight' : 'douse');
      hop();
    });
    document.addEventListener('theme:change', (e) => say(e.detail.theme === 'dark' ? 'dark' : 'light'));
    document.addEventListener('copy', () => {
      mood('happy', 1200);
      say('copy');
    });
    window.addEventListener('scroll', () => (state.last = performance.now()), { passive: true });
    const end = document.querySelector('#contact');
    if (end && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          mood('happy', 2000);
          say('bottom', ' <3');
          hop();
          io.disconnect();
        }
      });
      io.observe(end);
    }

    draw();
    requestAnimationFrame(tick);
    setTimeout(() => say('hello'), 1200);
  }
})();
