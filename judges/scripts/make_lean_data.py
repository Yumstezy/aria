"""The data behind the demo page's "Where does your mix land?" (Nov 3): a real Mix check of the sample song's rough
mix and finished mix, through the running engine, with Muse Spark.

  engine/run.sh &   # with MODEL_API_KEY in engine/.env
  engine/.venv/bin/python judges/scripts/make_lean_data.py

Writes judges/src/demo-lean.json: for each mix, the engine's good_mixes block (the lean and the model's directions,
exactly as /mix/analyze returned it) and what Muse Spark said about it. Nothing is edited after the engine returns it.
"""
import json
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "test-pack" / "sample"
MIXES = [("rough", "Rough mix", SAMPLE / "Rough mix.wav"), ("finished", "Finished mix", SAMPLE / "Finished mix (reference).wav")]
OUT = ROOT / "judges" / "src" / "demo-lean.json"


def analyze(path):
    req = urllib.request.Request("http://127.0.0.1:8765/mix/analyze", json.dumps({"mix_path": str(path)}).encode(),
                                 {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=300))


def main():
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    out = {"made": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "commit": commit, "mixes": []}
    for key, name, path in MIXES:
        r = analyze(path)
        g = r["good_mixes"]
        findings = r["clarity"]["findings"]
        advice = r.get("advice") or {}
        notes = [n for n in advice.get("notes", []) if 0 <= n.get("finding", -1) < len(findings)
                 and findings[n["finding"]]["kind"] == "good_mix"]
        out["mixes"].append({
            "key": key, "name": name, "file": f"test-pack/sample/{path.name}",
            "lean": g["lean"], "lean_word": g["lean_word"], "features": g["features"],
            "muse_summary": advice.get("summary"), "muse_notes": [{"short": n.get("short"), "text": n.get("text")} for n in notes],
            "advice_error": r.get("advice_error"),
        })
        print(name, g["lean_word"], g["lean"], "|", advice.get("summary"))
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
