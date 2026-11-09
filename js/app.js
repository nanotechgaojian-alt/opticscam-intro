(() => {
  "use strict";

  const slides = [...document.querySelectorAll(".slide")];
  const sideNav = document.getElementById("side-nav");
  const crumb = document.getElementById("crumb");
  const curEl = document.getElementById("cur");
  const totalEl = document.getElementById("total");
  const bar = document.getElementById("bar");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const clickFx = document.getElementById("click-fx");
  const wipe = document.querySelector(".page-wipe");
  const wipePath = document.getElementById("wipe-path");

  let index = 0;
  let busy = false;
  const total = slides.length;
  const PLAY_RATE = 0.48;
  totalEl.textContent = String(total).padStart(2, "0");

  const titles = slides.map((s) => s.dataset.title || "章节");

  const NAV_ICONS = [
    `<svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4v10l-8 4-8-4V8z" stroke="currentColor" stroke-width="1.5"/><path d="M12 12v8M4 8l8 4 8-4" stroke="currentColor" stroke-width="1.2" opacity=".55"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.4"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h6v10H4zM14 7h6v10h-6z" stroke="currentColor" stroke-width="1.5"/><path d="M10 12h4" stroke="currentColor" stroke-width="1.4"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><path d="M3 18c4-12 14-12 18 0" stroke="currentColor" stroke-width="1.6"/><path d="M3 18h18" stroke="currentColor" stroke-width="1.2" opacity=".45"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h6l3-6 3 12 2-6h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><path d="M4 18V6M4 18h16" stroke="currentColor" stroke-width="1.5"/><path d="M7 14l4-5 3 3 5-7" stroke="currentColor" stroke-width="1.5"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 9h6M7 12h10M7 15h8" stroke="currentColor" stroke-width="1.3"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14v4H5zM5 13h14v4H5z" stroke="currentColor" stroke-width="1.5"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none"><path d="M6 18V8l6-3 6 3v10l-6 3z" stroke="currentColor" stroke-width="1.5"/><path d="M6 8l6 3 6-3" stroke="currentColor" stroke-width="1.2" opacity=".5"/></svg>`,
  ];

  /* Sidebar */
  titles.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="nav-ico">${NAV_ICONS[i] || NAV_ICONS[0]}</span><span class="nav-copy"><small>${String(i + 1).padStart(2, "0")}</small>${t}</span>`;
    if (i === 0) b.classList.add("is-on");
    b.addEventListener("click", (e) => {
      pulse(e);
      goTo(i);
    });
    sideNav.appendChild(b);
  });

  function markReveals(slide) {
    const roots = slide.querySelectorAll(".split-left, .cover-copy, .cases-layout > .sec-label, .cases-layout > h2, .close-copy, .compare-left");
    roots.forEach((el) => el.classList.add("reveal"));
    slide.querySelectorAll(".choice-list, .choice-grid, .aside-fill, .stat-row, .btn-row, .case-tabs").forEach((el) => {
      el.classList.add("reveal");
    });
  }
  slides.forEach(markReveals);

  function ensureMediaHud(stage) {
    if (!stage || stage.querySelector(".media-hud")) return;
    const hud = document.createElement("div");
    hud.className = "media-hud";
    hud.textContent = "KERNEL NC · LIVE";
    stage.appendChild(hud);
    stage.classList.add("is-live");
  }
  document.querySelectorAll(".media-stage, .cover-media").forEach(ensureMediaHud);

  function syncChrome() {
    curEl.textContent = String(index + 1).padStart(2, "0");
    bar.style.width = `${((index + 1) / total) * 100}%`;
    crumb.textContent = titles[index];
    sideNav.querySelectorAll("button").forEach((b, i) => b.classList.toggle("is-on", i === index));
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
    // pause videos on hidden slides, play on active
    slides.forEach((s, i) => {
      s.querySelectorAll("video").forEach((v) => {
        v.playbackRate = PLAY_RATE;
        v.removeAttribute("poster");
        if (i === index) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
      // re-trigger reveal on active
      if (i === index) {
        s.querySelectorAll(".reveal").forEach((el) => {
          el.style.animation = "none";
          void el.offsetWidth;
          el.style.animation = "";
        });
      }
    });
  }

  /* Page transition with GSAP — overlay never keeps pointer-events */
  function goTo(next) {
    if (busy || next === index || next < 0 || next >= total) return;
    busy = true;
    const from = index;
    const dir = next > from ? 1 : -1;
    // safety: never leave UI locked if timeline fails
    const unlock = setTimeout(() => { busy = false; gsap.set(wipe, { opacity: 0 }); }, 2000);

    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(unlock);
        busy = false;
        gsap.set(wipe, { opacity: 0 });
      },
    });

    gsap.set(wipe, { opacity: 1 });
    tl.to(wipePath, {
      duration: 0.35,
      ease: "power3.in",
      attr: {
        d: dir > 0
          ? "M 0 0 H 100 V 100 H 0 Z"
          : "M 100 0 H 0 V 100 H 100 Z",
      },
    })
      .add(() => {
        slides[from].classList.remove("is-active");
        slides[next].classList.add("is-active");
        index = next;
        syncChrome();
        // reset wipe path opposite side
        gsap.set(wipePath, {
          attr: {
            d: dir > 0 ? "M 100 0 H 100 V 100 H 100 Z" : "M 0 0 H 0 V 100 H 0 Z",
          },
        });
      })
      .to(wipePath, {
        duration: 0.45,
        ease: "power3.out",
        attr: {
          d: dir > 0
            ? "M 100 0 H 100 V 100 H 100 Z"
            : "M 0 0 H 0 V 100 H 0 Z",
        },
      });
  }

  prevBtn.addEventListener("click", (e) => { pulse(e); goTo(index - 1); });
  nextBtn.addEventListener("click", (e) => { pulse(e); goTo(index + 1); });
  document.getElementById("btn-fs").addEventListener("click", (e) => {
    pulse(e, true);
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "f" || e.key === "F") {
      document.getElementById("btn-fs").click();
    }
  });

  /* Global delegated actions */
  document.addEventListener("click", (e) => {
    const gotoBtn = e.target.closest("[data-goto]");
    if (gotoBtn) {
      pulse(e, true);
      goTo(Number(gotoBtn.dataset.goto));
      return;
    }

    const choice = e.target.closest(".choice, .case-card");
    if (choice) {
      pulse(e, choice.classList.contains("is-on") === false);
      activateChoice(choice);
      return;
    }

    const tab = e.target.closest(".case-tabs .tab");
    if (tab) {
      pulse(e, true);
      activateCaseTab(tab);
    }
  });

  function activateChoice(btn) {
    const panel = btn.closest("[data-panel]")?.dataset.panel
      || btn.closest(".case-pane") && "cases";
    if (!panel) return;

    const group = btn.parentElement;
    group.querySelectorAll(".choice, .case-card").forEach((el) => {
      el.classList.toggle("is-on", el === btn);
    });

    const stage = document.querySelector(`[data-stage="${panel}"]`);
    const body = document.querySelector(`[data-body-for="${panel}"]`);
    if (body && btn.dataset.body) body.textContent = btn.dataset.body;

    if (!stage) return;
    setStageMedia(stage, btn.dataset.media, btn.dataset.video, btn.dataset.caption);
  }

  function setStageMedia(stage, media, video, caption) {
    const cap = stage.querySelector(".media-caption");
    if (cap && caption) cap.textContent = caption;

    // Prefer video — keep stage dark during swap; never assign PPT as poster
    // (that caused white flash). PPT image colors stay original when shown as img.
    if (video) {
      stage.querySelector("img")?.remove();
      let v = stage.querySelector("video");
      if (!v) {
        v = document.createElement("video");
        v.controls = true;
        v.muted = true;
        v.autoplay = true;
        v.loop = true;
        v.playsInline = true;
        stage.insertBefore(v, cap || null);
      }
      stage.classList.add("has-video");
      v.removeAttribute("poster");
        v.style.background = "#0c1218";
      const applyRate = () => { v.playbackRate = PLAY_RATE; };
      const prev = v.querySelector("source");
      if (prev && prev.getAttribute("src") === video) {
        v.play().then(applyRate).catch(() => {});
        return;
      }
      // Crossfade on dark stage: hide only after next frame is ready
      const nextSrc = video;
      let done = false;
      const commit = () => {
        if (done) return;
        done = true;
        v.pause();
        while (v.firstChild) v.removeChild(v.firstChild);
        const s1 = document.createElement("source");
        s1.src = nextSrc;
        s1.type = "video/mp4";
        v.appendChild(s1);
        v.load();
        v.playbackRate = PLAY_RATE;
        v.play().then(applyRate).catch(() => {});
      };
      const probe = document.createElement("video");
      probe.muted = true;
      probe.preload = "auto";
      probe.src = nextSrc;
      if (probe.readyState >= 2) commit();
      else {
        probe.onloadeddata = commit;
        probe.onerror = commit;
        setTimeout(commit, 700);
      }
      return;
    }

    // image only — original PPT colors (no recolor)
    stage.querySelector("video")?.remove();
    stage.classList.remove("has-video");
    let img = stage.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = caption || "";
      stage.insertBefore(img, cap || null);
    }
    img.style.background = "#070b10";
    if (media) img.src = media;
  }

  function activateCaseTab(tab) {
    const key = tab.dataset.key;
    const wrap = tab.closest(".cases-layout");
    wrap.querySelectorAll(".case-tabs .tab").forEach((t) => t.classList.toggle("is-on", t === tab));
    wrap.querySelectorAll(".case-pane").forEach((p) => {
      p.classList.toggle("is-on", p.dataset.pane === key);
    });
    const first = wrap.querySelector(`.case-pane.is-on .case-card`);
    if (first) activateChoice(first);
  }

  /* Click pulse */
  function pulse(e, alt = false) {
    const d = document.createElement("span");
    d.className = "burst" + (alt ? " alt" : "");
    d.style.left = (e.clientX || window.innerWidth / 2) + "px";
    d.style.top = (e.clientY || window.innerHeight / 2) + "px";
    clickFx.appendChild(d);
    setTimeout(() => d.remove(), 560);
  }

  /* Touch swipe */
  let tx = null;
  document.querySelector(".slides").addEventListener("touchstart", (e) => {
    tx = e.changedTouches[0].clientX;
  }, { passive: true });
  document.querySelector(".slides").addEventListener("touchend", (e) => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx;
    tx = null;
    if (Math.abs(dx) < 60) return;
    goTo(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* Cover hero: seamless playlist of case animations */
  const hero = document.getElementById("hero-reel");
  const heroCap = document.getElementById("hero-caption");
  if (hero && hero.dataset.playlist) {
    const playlist = hero.dataset.playlist.split(",").map((s) => s.trim()).filter(Boolean);
    let hi = 0;
    const labels = {
      "kernel_fresnel_adaptive.mp4": "菲涅尔自适应 · XZB",
      "kernel_mla_spiral.mp4": "MLA 螺旋铣削 · XYZABC",
      "kernel_mla_raster.mp4": "MLA 法向光栅 · XYZB",
      "kernel_mla_sts.mp4": "MLA 整面慢刀 · XZC",
      "kernel_fiveaxis_turn.mp4": "自由曲面五轴车削 · XYZBC",
      "kernel_xyzb_cylinder.mp4": "非球面柱面刨削 · XYZB",
      "kernel_surface_sts.mp4": "自由曲面慢刀 · XZC",
      "kernel_dcut.mp4": "D-CUT 内腔 · XZC",
      "kernel_micro_delivery.mp4": "外圆菲涅尔六轴 · XYZABC",
      "kernel_roll.mp4": "光辊螺旋槽 · 新参数",
      "kernel_offaxis_xzc.mp4": "离轴非球面 · XZC",
      "kernel_profile_virtual.mp4": "虚拟中心轮廓 · XZC",
    };
    const loadHero = (i) => {
      hi = ((i % playlist.length) + playlist.length) % playlist.length;
      const src = playlist[hi];
      const name = src.split("/").pop();
      hero.pause();
      hero.innerHTML = "";
      const s = document.createElement("source");
      s.src = src;
      s.type = "video/mp4";
      hero.appendChild(s);
      hero.removeAttribute("poster");
      hero.playbackRate = PLAY_RATE;
      hero.load();
      hero.play().then(() => { hero.playbackRate = PLAY_RATE; }).catch(() => {});
      if (heroCap) heroCap.textContent = `案例连续回放 · ${labels[name] || name} · ${hi + 1}/${playlist.length}`;
    };
    hero.loop = false;
    hero.addEventListener("ended", () => loadHero(hi + 1));
    hero.addEventListener("error", () => loadHero(hi + 1));
    loadHero(0);
  }

  /* Init wipe path */
  gsap.set(wipePath, { attr: { d: "M 0 0 H 0 V 100 H 0 Z" } });
  syncChrome();

  // Ensure first choice bodies match default
  document.querySelectorAll(".choice.is-on, .case-card.is-on").forEach((btn) => {
    const panel = btn.closest("[data-panel]")?.dataset.panel
      || (btn.closest(".case-pane") ? "cases" : null);
    if (!panel) return;
    const body = document.querySelector(`[data-body-for="${panel}"]`);
    if (body && btn.dataset.body) body.textContent = btn.dataset.body;
  });
})();
