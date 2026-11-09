(() => {
  "use strict";

  const canvas = document.getElementById("bg-mla");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let topPad = 58;
  let data = null;
  let idx = 0;
  let ncIdx = 0;
  let last = 0;

  const COL = {
    trail: "rgba(57, 255, 20, 0.62)",
    trailDim: "rgba(57, 255, 20, 0.16)",
    tip: "#e2183f",
    tipGlow: "rgba(226, 24, 63, 0.5)",
    nc: "rgba(0, 240, 255, 0.62)",
    ncDim: "rgba(146, 163, 177, 0.38)",
  };

  function headerHeight() {
    const top = document.querySelector(".topbar");
    return top ? Math.ceil(top.getBoundingClientRect().height) : 58;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    topPad = headerHeight();
    W = window.innerWidth;
    H = Math.max(1, window.innerHeight - topPad);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.top = topPad + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(p) {
    const b = data.bounds;
    const pad = 0.08;
    const sx = (W * (1 - 2 * pad)) / Math.max(b.xmax - b.xmin, 1e-6);
    const sy = (H * (1 - 2 * pad)) / Math.max(b.ymax - b.ymin, 1e-6);
    const s = Math.min(sx, sy) * 1.05;
    const cx = (b.xmin + b.xmax) * 0.5;
    const cy = (b.ymin + b.ymax) * 0.5;
    const x = (p.x - cx) * s;
    const y = (p.y - cy) * s;
    const z = ((p.z - b.zmin) / Math.max(b.zmax - b.zmin, 1e-6) - 0.5) * s * 0.38;
    const isoX = (x - y) * 0.866;
    const isoY = (x + y) * 0.35 - z;
    return [W * 0.52 + isoX, H * 0.48 + isoY];
  }

  function strokeTrail(len, color, width) {
    const path = data.path;
    const n = path.length;
    if (n < 2 || len < 2) return;
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
      const [x, y] = project(p);
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

  function drawFrame() {
    if (!data) return;
    const path = data.path;
    const n = path.length;
    if (!n) return;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const c of data.centres) {
      const [px, py] = project({ x: c.x, y: c.y, z: data.bounds.zmin });
      const g = ctx.createRadialGradient(px, py, 1, px, py, 34);
      g.addColorStop(0, "rgba(89,198,232,0.14)");
      g.addColorStop(1, "rgba(89,198,232,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    strokeTrail(1100, COL.trailDim, 1.2);
    strokeTrail(160, COL.trail, 1.75);

    const tip = path[idx % n];
    const [tx, ty] = project(tip);
    ctx.beginPath();
    ctx.fillStyle = COL.tipGlow;
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = COL.tip;
    ctx.arc(tx, ty, 2.8, 0, Math.PI * 2);
    ctx.fill();

    const nc = data.nc || [];
    if (nc.length) {
      const lines = 8;
      const baseY = H - 22 - lines * 14;
      ctx.font = "11px JetBrains Mono, ui-monospace, monospace";
      ctx.textAlign = "left";
      for (let i = 0; i < lines; i++) {
        const li = (ncIdx + i) % nc.length;
        ctx.fillStyle = i === lines - 3 ? COL.nc : COL.ncDim;
        ctx.fillText(String(nc[li]).slice(0, 68), 16, baseY + i * 14);
      }
    }
  }

  function tick(t) {
    if (!data) return;
    if (!last) last = t;
    const dt = Math.min(48, t - last);
    last = t;
    if (!reduce) {
      const steps = Math.max(1, Math.floor(dt / 16) * 4);
      const n = data.path.length;
      const prev = idx;
      idx = (idx + steps) % n;
      // seamless NC scroll — advance continuously across wrap
      const crossed = steps + (idx < prev ? 1 : 0);
      if (crossed > 0 && (idx % 12 < steps || idx < prev)) {
        ncIdx = (ncIdx + 1) % Math.max(data.nc.length, 1);
      }
    }
    drawFrame();
    requestAnimationFrame(tick);
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
      requestAnimationFrame(tick);
    } catch (err) {
      console.warn("MLA bg load failed", err);
    }
  }

  boot();
})();
