(() => {
  "use strict";

  const DATA_URL = "assets/data/mla66_bg_web.json";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COL = {
    trail: "rgba(57, 255, 20, 0.62)",
    trailDim: "rgba(57, 255, 20, 0.16)",
    tip: "#e2183f",
    tipGlow: "rgba(226, 24, 63, 0.5)",
    mark: "rgba(238, 243, 247, 0.92)",
  };

  let data = null;
  let idx = 0;
  let last = 0;
  const views = [];

  function headerHeight() {
    const top = document.querySelector(".topbar");
    return top ? Math.ceil(top.getBoundingClientRect().height) : 58;
  }

  function makeView(canvas, opts) {
    const ctx = canvas.getContext("2d", { alpha: true });
    const view = {
      canvas,
      ctx,
      opts: opts || {},
      W: 0,
      H: 0,
      dpr: 1,
      topPad: 0,
    };
    views.push(view);
    return view;
  }

  function resizeView(view) {
    const { canvas, ctx, opts } = view;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (opts.fullPage) {
      view.topPad = headerHeight();
      view.W = window.innerWidth;
      view.H = Math.max(1, window.innerHeight - view.topPad);
      canvas.style.top = view.topPad + "px";
      canvas.style.left = "0";
      canvas.style.right = "0";
      canvas.style.bottom = "0";
      canvas.style.width = "100%";
      canvas.style.height = view.H + "px";
    } else {
      view.topPad = 0;
      const rect = canvas.parentElement.getBoundingClientRect();
      view.W = Math.max(1, Math.floor(rect.width));
      view.H = Math.max(1, Math.floor(rect.height));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
    canvas.width = Math.floor(view.W * view.dpr);
    canvas.height = Math.floor(view.H * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function project(view, p) {
    const b = data.bounds;
    const pad = optsPad(view);
    const sx = (view.W * (1 - 2 * pad)) / Math.max(b.xmax - b.xmin, 1e-6);
    const sy = (view.H * (1 - 2 * pad)) / Math.max(b.ymax - b.ymin, 1e-6);
    const s = Math.min(sx, sy) * (view.opts.scale || 1.05);
    const cx = (b.xmin + b.xmax) * 0.5;
    const cy = (b.ymin + b.ymax) * 0.5;
    const x = (p.x - cx) * s;
    const y = (p.y - cy) * s;
    const z = ((p.z - b.zmin) / Math.max(b.zmax - b.zmin, 1e-6) - 0.5) * s * 0.38;
    const isoX = (x - y) * 0.866;
    const isoY = (x + y) * 0.35 - z;
    const ox = view.W * (view.opts.ox || 0.52);
    const oy = view.H * (view.opts.oy || 0.48);
    return [ox + isoX, oy + isoY];
  }

  function optsPad(view) {
    return view.opts.pad != null ? view.opts.pad : 0.08;
  }

  function strokeTrail(view, len, color, width) {
    const path = data.path;
    const n = path.length;
    if (n < 2 || len < 2) return;
    const { ctx } = view;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    let moved = false;
    let prevI = -1;
    for (let k = len; k >= 0; k--) {
      const i = (idx - k + n * 4) % n;
      const p = path[i];
      const [x, y] = project(view, p);
      const wrapJump = prevI >= 0 && ((prevI > i && prevI - i > n / 2) || (i > prevI && i - prevI > n / 2));
      if (!moved || p.kind === 0 || wrapJump) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevI = i;
    }
    ctx.stroke();
  }

  function drawView(view) {
    if (!data) return;
    const path = data.path;
    const n = path.length;
    if (!n) return;
    const { ctx, W, H } = view;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const c of data.centres) {
      const [px, py] = project(view, { x: c.x, y: c.y, z: data.bounds.zmin });
      const g = ctx.createRadialGradient(px, py, 1, px, py, 34);
      g.addColorStop(0, "rgba(89,198,232,0.14)");
      g.addColorStop(1, "rgba(89,198,232,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    strokeTrail(view, 1100, COL.trailDim, 1.2);
    strokeTrail(view, 160, COL.trail, 1.75);

    const tip = path[idx % n];
    const [tx, ty] = project(view, tip);
    ctx.beginPath();
    ctx.fillStyle = COL.tipGlow;
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = COL.tip;
    ctx.arc(tx, ty, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Only brand word — no NC captions
    if (view.opts.mark !== false) {
      ctx.font = `600 ${Math.max(14, Math.round(H * 0.035))}px "Space Grotesk", "Noto Sans SC", sans-serif`;
      ctx.fillStyle = COL.mark;
      ctx.textAlign = "left";
      ctx.fillText("OpticsCAM", 16, 28);
    }
  }

  function tick(t) {
    if (!data) return;
    if (!last) last = t;
    const dt = Math.min(48, t - last);
    last = t;
    if (!reduce) {
      const steps = Math.max(1, Math.floor(dt / 16) * 4);
      idx = (idx + steps) % data.path.length;
    }
    views.forEach(drawView);
    requestAnimationFrame(tick);
  }

  async function boot() {
    const pageCanvas = document.getElementById("bg-mla");
    const heroCanvas = document.getElementById("hero-mla");
    if (pageCanvas) makeView(pageCanvas, { fullPage: true, scale: 1.05, ox: 0.52, oy: 0.48 });
    if (heroCanvas) makeView(heroCanvas, { fullPage: false, scale: 1.15, ox: 0.5, oy: 0.52, pad: 0.06 });

    const resizeAll = () => views.forEach((v) => { resizeView(v); drawView(v); });
    resizeAll();
    window.addEventListener("resize", resizeAll);

    try {
      const res = await fetch(DATA_URL, { cache: "force-cache" });
      data = await res.json();
      idx = 0;
      requestAnimationFrame(tick);
    } catch (err) {
      console.warn("MLA bg load failed", err);
    }
  }

  boot();
})();
