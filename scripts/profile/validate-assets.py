"""Validate generated profile assets before committing them. No dependencies."""
import json
import struct
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[2]
mode = sys.argv[1] if len(sys.argv) > 1 else "report"
if mode == "cards":
    files = [root / "profile-summary-card-output/buefy" / name for name in (
        "0-profile-details.svg", "1-repos-per-language.svg", "2-most-commit-language.svg",
        "3-stats.svg", "4-productive-time.svg")]
elif mode == "report":
    files = [root / "assets/github-annual-report.svg", root / "assets/github-activity-summary.svg"]
    report = json.loads((root / "assets/github-annual-report.json").read_text())
    if report.get("render", {}).get("mode") != "playwright":
        raise ValueError("Refusing to publish an unrendered/fallback report")
    png = (root / "assets/github-annual-report.png").read_bytes()
    if len(png) < 33 or png[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Invalid PNG")
    width, height = struct.unpack(">II", png[16:24])
    if width < 1400 or height < 1240:
        raise ValueError(f"Undersized PNG: {width}x{height}")
else:
    raise ValueError(f"Unknown mode: {mode}")
for file in files:
    doc = ET.parse(file)
    if doc.getroot().tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError(f"Not an SVG: {file}")
print(f"Validated {mode}: {len(files)} SVG files" + (" and report PNG/JSON" if mode == "report" else ""))
