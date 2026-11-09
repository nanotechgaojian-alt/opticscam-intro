# -*- coding: utf-8 -*-
"""Cover baked title/NC chrome in kernel MP4s; keep only OpticsCAM watermark."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "videos"
OCAM = Path(r"C:\Users\92087\Downloads\OpticsCAM_v2.0.120_WINDOWS\OpticsCAM_v2.0.120_WINDOWS")
FFMPEG = OCAM / "analysis" / "launch159" / "tools" / "imageio_ffmpeg" / "binaries" / "ffmpeg-win-x86_64-v9.0.2.exe"

# Dark panel matching animation BG; blank top banner + right NC column; stamp OpticsCAM
VF = (
    "drawbox=x=0:y=0:w=iw:h=ih*0.115:color=0x070B10@1:t=fill,"
    "drawbox=x=iw*0.58:y=0:w=iw*0.42:h=ih:color=0x0E1620@1:t=fill,"
    "drawtext=text='OpticsCAM':fontfile=/Windows/Fonts/arialbd.ttf:"
    "fontsize=h*0.045:fontcolor=white:x=w*0.035:y=h*0.035"
)


def main():
    if not FFMPEG.exists():
        print("MISSING ffmpeg", FFMPEG)
        sys.exit(1)
    files = sorted(OUT.glob("kernel_*.mp4"))
    tmp = OUT / "_strip_tmp"
    tmp.mkdir(exist_ok=True)
    for i, src in enumerate(files):
        dst = tmp / src.name
        cmd = [
            str(FFMPEG), "-y", "-i", str(src),
            "-vf", VF,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
            "-preset", "fast", "-an", "-movflags", "+faststart",
            str(dst),
        ]
        print(f"[{i+1}/{len(files)}] {src.name}")
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode != 0:
            print("FAIL", src.name, r.stderr[-400:].decode("utf-8", "ignore"))
            continue
        dst.replace(src)
    print("STRIP_DONE", len(files))


if __name__ == "__main__":
    main()
