# -*- coding: utf-8 -*-
"""Build 6x6 hexagonal concave MLA spiral-mill toolpath JSON via OpticsCAM kernels.

Uses OpticsCAM honeycomb_centers + accel_engine.mla_asphere_z for concave base
and concave unit lenses; spiral milling strategy (outer→inner) with XYZABC-style
motion words for the live web background.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

OCAM = Path(r"C:\Users\92087\Downloads\OpticsCAM_v2.0.120_WINDOWS\OpticsCAM_v2.0.120_WINDOWS")
sys.path.insert(0, str(OCAM))

from dksh_fresnel_cam import accel_engine as ae  # noqa: E402
from dksh_fresnel_cam.lens_array.Standalone_Lens_Array_Tool import (  # noqa: E402
    honeycomb_centers,
)

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "assets" / "data" / "mla66_bg.json"
OUT_NC = ROOT / "assets" / "data" / "mla66_bg.nc"


def asphere_z(r: float, R: float, K: float) -> float:
    vec = ae.pack_asphere_coeff_vector([], order=1)
    z = ae.mla_asphere_z(float(r), float(R), float(K), vec)
    if z is None or not math.isfinite(float(z)):
        # Analytic sphere/conic fallback
        c = 1.0 / R if abs(R) > 1e-12 else 0.0
        disc = 1.0 - (1.0 + K) * (c * r) ** 2
        if disc < 0:
            return 0.0
        return float((c * r * r) / (1.0 + math.sqrt(max(disc, 0.0))))
    return float(z)


def unit_normal(xy, z_fn, eps=1e-4):
    x, y = xy
    r = math.hypot(x, y)
    z0 = z_fn(r)
    zx = (z_fn(math.hypot(x + eps, y)) - z_fn(math.hypot(x - eps, y))) / (2 * eps)
    zy = (z_fn(math.hypot(x, y + eps)) - z_fn(math.hypot(x, y - eps))) / (2 * eps)
    n = np.array([-zx, -zy, 1.0], float)
    n /= max(np.linalg.norm(n), 1e-12)
    return n


def spiral_xy(radius: float, pitch: float, pt_step: float):
    """Archimedean spiral outer→inner in XY of the unit disk."""
    if radius <= 1e-6:
        return [(0.0, 0.0)]
    pts = []
    r = radius
    th = 0.0
    while r > pitch * 0.35:
        circ = max(2.0 * math.pi * max(r, 1e-6), pt_step)
        dth = pt_step / max(r, 1e-6)
        nseg = max(8, int(math.ceil(circ / pt_step)))
        for _ in range(nseg):
            pts.append((r * math.cos(th), r * math.sin(th)))
            th += dth
            r = max(0.0, r - pitch * dth / (2.0 * math.pi))
            if r <= pitch * 0.35:
                break
        if r <= pitch * 0.35:
            break
    pts.append((0.0, 0.0))
    return pts


def main():
    # Geometry — concave base + concave microlenses (dish toward +Z tool)
    rows = cols = 6
    pitch = 1.15  # mm centre spacing
    py = pitch * math.sqrt(3.0) / 2.0
    centres = honeycomb_centers(rows, cols, pitch, py, 0.0, 0.0)
    assert len(centres) == 36

    R_base = -120.0  # concave substrate
    K_base = -0.5
    R_lens = -2.8  # concave unit lens
    K_lens = -1.0
    aperture = 0.48  # unit clear aperture radius (mm)
    tool_r = 0.05
    pitch_spiral = 0.045
    pt_step = 0.04

    def base_z(r):
        return asphere_z(r, R_base, K_base)

    def lens_delta(r):
        # unit sag relative to rim (concave dish)
        z = asphere_z(r, R_lens, K_lens)
        z_rim = asphere_z(aperture, R_lens, K_lens)
        return z - z_rim

    path = []
    nc_lines = []
    nc_lines.append("( OpticsCAM 2.0.159 )")
    nc_lines.append("( MLA 6x6 honeycomb · concave base · concave units · spiral mill )")
    nc_lines.append("( Axis contract XYZABC )")
    nc_lines.append("G52 G63 G71 G103 G40 G18 G90 G144")
    nc_lines.append("G54")
    nc_lines.append("T0101")
    nc_lines.append("G18 G40 G94")
    nc_lines.append("M03S[#544]")
    nc_lines.append("G01 C0. A0. F800")

    # Sort centres spiral-outward for nicer background draw
    centres_sorted = sorted(centres, key=lambda p: (math.hypot(p[0], p[1]), math.atan2(p[1], p[0])))

    for li, (cx, cy) in enumerate(centres_sorted):
        nc_lines.append(f"( LENS {li + 1:02d} / 36  CX={cx:+.4f} CY={cy:+.4f} )")
        # rapid above unit
        z_safe = base_z(math.hypot(cx, cy)) + 0.6
        nc_lines.append(f"G00 X{cx + aperture:.4f} Y{cy:.4f} Z{z_safe:.4f}")
        path.append({"x": cx + aperture, "y": cy, "z": z_safe, "kind": 0, "lens": li})

        spiral = spiral_xy(aperture, pitch_spiral, pt_step)
        first_cut = True
        for ux, uy in spiral:
            wx = cx + ux
            wy = cy + uy
            r_unit = math.hypot(ux, uy)
            r_base = math.hypot(wx, wy)
            z_surf = base_z(r_base) + lens_delta(r_unit)
            # tool-normal offset along surface normal (ball approx)
            n = unit_normal((wx, wy), lambda rr: base_z(rr) + (
                lens_delta(math.hypot(wx - cx, wy - cy)) if math.hypot(wx - cx, wy - cy) <= aperture + 1e-6 else 0.0
            ))
            # simpler: offset along local unit normal of combined surface
            def z_comb(rr_unused=None, _wx=wx, _wy=wy):
                return base_z(math.hypot(_wx, _wy)) + lens_delta(math.hypot(_wx - cx, _wy - cy))

            # finite-diff at contact
            n = unit_normal((wx, wy), lambda r_fake: (
                base_z(math.hypot(wx, wy))  # placeholder unused
            ))
            # better local gradient
            eps = 1e-4
            zc = base_z(math.hypot(wx, wy)) + lens_delta(math.hypot(ux, uy))
            zxp = base_z(math.hypot(wx + eps, wy)) + lens_delta(math.hypot(ux + eps, uy))
            zxm = base_z(math.hypot(wx - eps, wy)) + lens_delta(math.hypot(ux - eps, uy))
            zyp = base_z(math.hypot(wx, wy + eps)) + lens_delta(math.hypot(ux, uy + eps))
            zym = base_z(math.hypot(wx, wy - eps)) + lens_delta(math.hypot(ux, uy - eps))
            zx = (zxp - zxm) / (2 * eps)
            zy = (zyp - zym) / (2 * eps)
            nvec = np.array([-zx, -zy, 1.0], float)
            nvec /= max(np.linalg.norm(nvec), 1e-12)
            tip = np.array([wx, wy, zc], float) + tool_r * nvec
            # B from tool axis tilt about Y; A about X approx; C polar
            B = math.degrees(math.atan2(nvec[0], nvec[2]))
            A = math.degrees(math.atan2(-nvec[1], nvec[2]))
            C = math.degrees(math.atan2(tip[1], tip[0])) if abs(tip[0]) + abs(tip[1]) > 1e-9 else 0.0
            if first_cut:
                nc_lines.append(
                    f"G01 X{tip[0]:.4f} Y{tip[1]:.4f} Z{tip[2]:.4f} "
                    f"A{A:.3f} B{B:.3f} C{C:.3f} F120"
                )
                first_cut = False
            else:
                nc_lines.append(
                    f"X{tip[0]:.4f} Y{tip[1]:.4f} Z{tip[2]:.4f} "
                    f"A{A:.3f} B{B:.3f} C{C:.3f}"
                )
            path.append({
                "x": float(tip[0]),
                "y": float(tip[1]),
                "z": float(tip[2]),
                "a": float(A),
                "b": float(B),
                "c": float(C),
                "kind": 2,
                "lens": li,
            })

        # retract
        nc_lines.append(f"G00 Z{z_safe:.4f}")
        path.append({"x": float(path[-1]["x"]), "y": float(path[-1]["y"]), "z": z_safe, "kind": 0, "lens": li})

    nc_lines.append("M05")
    nc_lines.append("M30")

    # Downsample path for web if huge
    pts = path
    if len(pts) > 12000:
        step = max(1, len(pts) // 10000)
        pts = pts[::step]

    xs = [p["x"] for p in pts]
    ys = [p["y"] for p in pts]
    zs = [p["z"] for p in pts]
    payload = {
        "meta": {
            "version": "OpticsCAM 2.0.159",
            "strategy": "spiral_mill",
            "array": "honeycomb_6x6",
            "base": {"R": R_base, "K": K_base, "form": "concave"},
            "unit": {"R": R_lens, "K": K_lens, "aperture": aperture, "form": "concave"},
            "pitch_mm": pitch,
            "tool_r": tool_r,
            "n_lenses": 36,
            "n_points": len(pts),
            "axis": "XYZABC",
        },
        "centres": [{"x": float(x), "y": float(y)} for x, y in centres_sorted],
        "bounds": {
            "xmin": float(min(xs)), "xmax": float(max(xs)),
            "ymin": float(min(ys)), "ymax": float(max(ys)),
            "zmin": float(min(zs)), "zmax": float(max(zs)),
        },
        "path": pts,
        "nc": nc_lines,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    OUT_NC.write_text("\n".join(nc_lines) + "\n", encoding="utf-8")
    print("OK", OUT_JSON, f"{OUT_JSON.stat().st_size/1e6:.2f} MB", "pts", len(pts), "nc", len(nc_lines))


if __name__ == "__main__":
    main()
