(() => {
  "use strict";

  const canvas = document.getElementById("bg-mla");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let data = null;
  let idx = 0;
  let ncIdx = 0;
  let raf = 0;
  let last = 0;

  const COL = {
    trail: "rgba(57, 255, 20, 0.55)",
    trailDim: "rgba(57, 255, 20, 0.12)",
    tip: "#e2183f",
    tipGlow: "rgba(226, 24, 63, 0.45)",
    lens: "rgba(89, 198, 232, 0.22)",
    nc: "rgba(0, 240, 255, 0.55)",
    ncDim: "rgba(146, 163, 177, 0.35)",
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(p) {
    const b = data.bounds;
    const pad = 0.12;
    const sx = (W * (1 - 2 * pad)) / Math.max(b.xmax - b.xmin, 1e-6);
    const sy = (H * (1 - 2 * pad)) / Math.max(b.ymax - b.ymin, 1e-6);
    const s = Math.min(sx, sy) * 0.92;
    const cx = (b.xmin + b.xmax) * 0.5;
    const cy = (b.ymin + b.ymax) * 0.5;
    // isometric-ish: X right, Y up-left, Z vertical screen nudge
    const x = (p.x - cx) * s;
    const y = (p.y - cy) * s;
    const z = ((p.z - b.zmin) / Math.max(b.zmax - b.zmin, 1e-6) - 0.5) * s * 0.35;
    const isoX = (x - y) * 0.866;
    const isoY = (x + y) * 0.35 - z;
    return [W * 0.58 + isoX, H * 0.52 + isoY];
  }

  function drawFrame() {
    if (!data) return;
    const path = data.path;
    const n = path.length;
    if (!n) return;

    ctx.clearRect(0, 0, W, H);

    // soft vignette gradient already in CSS; draw lens footprints faintly
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const c of data.centres) {
      const [px, py] = project({ x: c.x, y: c.y, z: data.bounds.zmin });
      const g = ctx.createRadialGradient(px, py, 2, px, py, 28);
      g.addColorStop(0, "rgba(89,198,232,0.10)");
      g.addColorStop(1, "rgba(89,198,232,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // completed trail
    const show = Math.max(2, idx);
    const trailStart = Math.max(0, show - 900);
    ctx.lineWidth = 1.15;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let moved = false;
    for (let i = trailStart; i < show; i++) {
      const p = path[i];
      const [x, y] = project(p);
      if (!moved || p.kind === 0) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = COL.trailDim;
    ctx.stroke();

    // hot recent trail
    const hotStart = Math.max(0, show - 140);
    ctx.beginPath();
    moved = false;
    for (let i = hotStart; i < show; i++) {
      const p = path[i];
      const [x, y] = project(p);
      if (!moved || p.kind === 0) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = COL.trail;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // tool tip
    const tip = path[Math.min(show, n - 1)];
    const [tx, ty] = project(tip);
    ctx.beginPath();
    ctx.fillStyle = COL.tipGlow;
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = COL.tip;
    ctx.arc(tx, ty, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // NC ticker — no captions, only program lines
    const nc = data.nc || [];
    if (nc.length) {
      const lines = 9;
      const baseY = H - 28 - lines * 15;
      ctx.font = "12px JetBrains Mono, ui-monospace, monospace";
      ctx.textAlign = "left";
      for (let i = 0; i < lines; i++) {
        const li = (ncIdx + i) % nc.length;
        const active = i === lines - 3;
        ctx.fillStyle = active ? COL.nc : COL.ncDim;
        const text = String(nc[li]).slice(0, 72);
        ctx.fillText(text, 18, baseY + i * 15);
      }
    }
  }

  function tick(t) {
    if (!data) return;
    if (!last) last = t;
    const dt = Math.min(48, t - last);
    last = t;
    if (!reduce) {
      const steps = Math.max(1, Math.floor(dt / 16) * 3);
      idx = (idx + steps) % data.path.length;
      if (idx % 18 === 0) ncIdx = (ncIdx + 1) % Math.max(data.nc.length, 1);
    }
    drawFrame();
    raf = requestAnimationFrame(tick);
  }

  async function boot() {
    resize();
    window.addEventListener("resize", () => {
      resize();
      drawFrame();
    });
    try {
      const res = await fetch("assets/data/mla66_bg_web.json", { cache: "force-cache" });
      data = await res.json();
      idx = 0;
      ncIdx = 0;
      raf = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("MLA bg load failed", err);
    }
  }

  boot();
})();
