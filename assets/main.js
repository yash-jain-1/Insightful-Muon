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
    let w, h, cool, heat, image, running = false, visible = true, lit = true, last = 0;

    const resize = () => {
      w = Math.max(1, Math.ceil(canvas.clientWidth / px));
      h = Math.max(1, Math.ceil(canvas.clientHeight / px));
      canvas.width = w;
      canvas.height = h;
      heat = new Uint8Array(w * h);
      // Cool faster on short canvases so the flames still taper to red at the top.
      cool = Math.max(2, (2 * HOT) / (h * 0.8));
      image = ctx.createImageData(w, h);
      setSource(lit ? HOT : 0);
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
            const cooled = v - ((Math.random() * cool) | 0);
            heat[Math.max(0, src - r + 1 - w)] = cooled > 0 ? cooled : 0;
          }
        }
      }
    };

    const draw = () => {
      const d = image.data;
      // Skip the white-hot source row; it reads as a hard line.
      for (let i = 0; i < heat.length - w; i++) {
        const v = heat[i];
        const [r, g, b] = PALETTE[v];
        const o = i * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b;
        // Coldest colour is transparent so the page shows through.
        d[o + 3] = v === 0 ? 0 : Math.min(255, v * 24);
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
      setSource(lit ? HOT : 0);
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
