# -*- coding: utf-8 -*-
"""Extra cover-hero kernel NC clips — distinct delivery_cases not already on cover.

Reuses path_from_rows / render_clip from gen_unique_anims + encode from gen_kernel_anims.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from gen_kernel_anims import FFMPEG, LAUNCH, OUT  # noqa: E402
from gen_unique_anims import render_clip  # noqa: E402

DELIVERY = LAUNCH / "revision2" / "delivery_cases"

# Cover playlist already heavy on:
# fresnel_adaptive, mla_*, fiveaxis_turn, xyzb_cylinder, surface_sts,
# dcut, micro_delivery, roll, offaxis_xzc, profile_virtual
JOBS = [
    dict(
        name="fresnel_fullr_stable",
        nc=DELIVERY / "01_fresnel48_fullr" / "stable.nc",
        family="XZB",
        title="菲涅尔全R稳定 · XZB",
        subtitle="交付案例 01 · B轴稳定法向",
        view="xz",
        caption="XZB · 菲涅尔全R稳定法向",
    ),
    dict(
        name="fresnel_nc_adaptive",
        nc=DELIVERY / "01_fresnel48_fullr" / "adaptive.nc",
        family="XZB",
        title="菲涅尔全R自适应 · XZB",
        subtitle="交付案例 01 · 交付NC刀轨（非接触JSON）",
        view="xz",
        caption="XZB · 菲涅尔全R自适应刀轨",
    ),
    dict(
        name="doe66_xzb",
        nc=DELIVERY / "03_doe66" / "XZB.nc",
        family="XZB",
        title="DOE66 尖刀车削 · XZB",
        subtitle="交付案例 03 · V尖 CONTINUOUS",
        view="xz",
        caption="XZB · DOE66 尖刀连续车削",
    ),
    dict(
        name="doe66_xyzb",
        nc=DELIVERY / "03_doe66" / "XYZB.nc",
        family="XYZB",
        title="DOE66 尖刀刨削 · XYZB",
        subtitle="交付案例 03 · XYZB_PLANING",
        view="3d",
        caption="XYZB · DOE66 尖刀刨削",
    ),
    dict(
        name="xyzb_ruling",
        nc=DELIVERY / "08_surface_ruling" / "XYZB" / "program.nc",
        family="XYZB",
        title="自由曲面 XYZB 刨削",
        subtitle="交付案例 08 · 圆刃金刚石",
        view="3d",
        caption="XYZB · 自由曲面刨削",
    ),
    dict(
        name="roll_delivery",
        nc=DELIVERY / "16_roll1062" / "Roll1062.nc",
        family="XZC",
        title="光辊斜槽 · XZC",
        subtitle="交付案例 16 · HDL2600 D80×L120",
        view="3d",
        caption="XZC · 光辊斜槽慢刀",
    ),
    dict(
        name="surface_xz_fts",
        nc=DELIVERY / "07_surface_servo" / "XZ_FTS" / "XZC.nc",
        family="XZ",
        title="轴对称快刀基线 · XZ",
        subtitle="交付案例 07 · XZ_FTS 基带",
        view="xz",
        caption="XZ · 曲面轴对称快刀基线",
    ),
    dict(
        name="dcut_wall",
        nc=LAUNCH / "dcut_real" / "wall_optical_cam159" / "preview.nc",
        family="XZC",
        title="D-CUT 壁面内腔 · XZC",
        subtitle="真实内核 wall_optical_cam159",
        view="3d",
        caption="XZC · D-CUT 壁面内腔",
    ),
]


def main():
    print("ffmpeg", FFMPEG.exists(), FFMPEG)
    print("out", OUT)
    ok, fail = [], []
    for j in JOBS:
        name = j["name"]
        nc = j["nc"]
        print("===", name, "===")
        if not nc.exists():
            print("FAIL missing", nc)
            fail.append((name, f"missing {nc}"))
            continue
        try:
            out = render_clip(
                name,
                nc,
                j["family"],
                j["title"],
                j["subtitle"],
                n=j.get("n", 52),
                fps=j.get("fps", 16),
                view=j.get("view", "3d"),
            )
            if out is None:
                fail.append((name, "too few pts / skipped"))
            else:
                ok.append((name, out.name, j["caption"], out.stat().st_size))
        except Exception as e:
            print("FAIL", name, e)
            fail.append((name, str(e)))

    print("\n=== COVER_EXPAND SUMMARY ===")
    for name, fname, cap, sz in ok:
        print(f"OK  {fname:36} {sz/1e6:.2f}MB  | {cap}")
    for name, err in fail:
        print(f"FAIL {name}: {err}")
    print("COVER_EXPAND_DONE", f"ok={len(ok)} fail={len(fail)}")
    return 0 if not fail else 1


if __name__ == "__main__":
    raise SystemExit(main())
