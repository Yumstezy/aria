"""Muse Spark as a second rater: show it real rated examples, ask it to rate held-out mixes as good, mid or bad.

Same data and same song-grouped split as ml/train.py, so the two numbers compare fairly.
Only real rated mixes go in the prompt (docs/ml-plan.md: no made-up examples).

Run from the repo root (needs MODEL_API_KEY in engine/.env):
    engine/.venv/bin/python ml/muse_rater.py ml/data/features.csv
Writes ml/results/muse-report.md. About one Muse call per mix.
"""
import json
import os
import random
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from sklearn.metrics import balanced_accuracy_score, confusion_matrix

from common import FEATURES, TIERS, check_enough, load, song_folds, tier_index

ROOT = Path(__file__).resolve().parent
EXAMPLES_PER_LABEL = 10   # 10 per tier, about 30 rated examples per prompt
WORKERS = 4

PROMPT = """You rate EDM mixes from measurements only. You never hear the audio.
Each mix is the loudest 60 s of a song, measured as:
integrated_lufs, true_peak_dbtp, crest_db (peak to RMS), short_term_spread_lu (how much loudness moves),
bass_rel_db, mids_rel_db, treble_rel_db (each band's level relative to the whole mix), tilt_db (treble minus bass),
width_bass, width_mids, width_treble (0 mono, 1 all side).
Below are real mixes that were rated "good", "mid" or "bad". The tiers are ordered: bad < mid < good.
Learn what separates them, then rate the new mix.
Answer with JSON only: {"label": "good" | "mid" | "bad", "confidence": 0 to 1, "reason": "one short sentence naming the measurements that decided it"}"""


def describe(r):
    return {k: float(r[k]) for k in FEATURES}


def examples(train_rows, seed):
    rng = random.Random(seed)
    picked = []
    for lab in TIERS:
        pool = [r for r in train_rows if r["label"] == lab]
        picked += rng.sample(pool, min(EXAMPLES_PER_LABEL, len(pool)))
    rng.shuffle(picked)
    return "\n".join(json.dumps({**describe(r), "rating": r["label"]}) for r in picked)


def rate(client, model, shots, row):
    res = client.chat.completions.create(
        model=model, max_tokens=800, reasoning_effort="minimal", response_format={"type": "json_object"},
        messages=[{"role": "system", "content": PROMPT + "\n\nRated examples:\n" + shots},
                  {"role": "user", "content": json.dumps(describe(row))}])
    try:
        out = json.loads(res.choices[0].message.content or "")
        return out if out.get("label") in TIERS else None
    except json.JSONDecodeError:
        return None


def main(csv_path):
    load_dotenv(ROOT.parent / "engine" / ".env")
    if not os.environ.get("MODEL_API_KEY"):
        sys.exit("No MODEL_API_KEY in engine/.env")
    client = OpenAI(api_key=os.environ["MODEL_API_KEY"], base_url=os.environ.get("MUSE_BASE_URL", "https://api.meta.ai/v1"),
                    timeout=30, max_retries=2)
    model = os.environ.get("MUSE_MODEL", "muse-spark-1.3")

    rows, dropped = load(csv_path)
    check_enough(rows)
    folds = song_folds(rows)
    answers = [None] * len(rows)
    for i, (train, test) in enumerate(folds):
        shots = examples([rows[j] for j in train], seed=i)
        with ThreadPoolExecutor(WORKERS) as pool:
            for j, out in zip(test, pool.map(lambda j: rate(client, model, shots, rows[j]), test)):
                answers[j] = out
        print(f"fold {i + 1}/{len(folds)} done")

    answered = [j for j, a in enumerate(answers) if a]
    y = np.array([tier_index(rows[j]["label"]) for j in answered])
    p = np.array([tier_index(answers[j]["label"]) for j in answered])
    acc = balanced_accuracy_score(y, p) if len(set(y)) > 1 else float("nan")
    lines = [
        f"# Muse Spark rater report ({date.today()})", "",
        f"- Model: {model}, {EXAMPLES_PER_LABEL} real rated examples per tier in each prompt, none from the song being rated.",
        f"- Data: {len(rows)} mixes, {dropped} dropped for unmeasured features. Same song-grouped {len(folds)}-fold split as ml/train.py.",
        f"- Muse gave a valid answer for {len(answered)} of {len(rows)} mixes. The rest count as no answer, not as a guess.", "",
        f"**Balanced accuracy on held-out songs: {acc:.2f}** (with three tiers, 0.33 is a coin toss). Compare with ml/results/train-report.md.", "",
        f"- Tiers off on average: {np.mean(np.abs(p - y)):.2f}. Two off (good called bad, or bad called good): {int(np.sum(np.abs(p - y) == 2))}.",
        f"- Confusion, rows = truth [good, mid, bad]: {confusion_matrix(y, p, labels=[2, 1, 0]).tolist()}", "",
        "Sample reasons:", "",
    ]
    lines += [f"- {rows[j]['file']} ({rows[j]['label']}): {answers[j]['label']}, {answers[j].get('reason', '')}" for j in answered[:8]]
    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / "muse-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
