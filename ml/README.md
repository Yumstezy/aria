# Training Aria's mix model: step by step

You're building the part of Aria that can say how finished an EDM mix sounds, even before the producer loads a reference track, and what pulls it down. Ian runs the prototype. This track is yours. Everything you need is in this folder. The rules behind it are in `docs/ml-plan.md`.

## Where it stands (Oct 29)

- **Data:** 99 rated mixes from the shared Drive (good 30, mid 36, bad 33), in 71 song and producer groups.
- **Official result** (`results/train-report.md`): the best model scores 0.49 on songs it never saw, against 0.45 for "just look at loudness" (0.33 is a coin toss). It wins only 66% of test rounds and fails the shuffle test (p = 0.70), so **by the ship rule, nothing ships yet.**
- **Side experiment** (`results/no-loudness-experiment.md`, added after the official run): with loudness taken out, tone and stereo alone still separate the tiers better than chance. See "Side experiments" below.
- **Shape-only good vs bad (Nov 2, planned before running)** (`results/shape-experiment.md`): passes Ian's "points the right way" bar. 0.75 on held-out songs (chance 0.50), shuffle p = 0.002, 11 directions stable and shown. Loudness alone scores 0.72 on the same question, so the value is the loudness-free direction, not a better score. Writes `data/shape-model.json` for the app.
- **Audiobox side experiment (Oct 30, planned before any scores existed)** (`results/aesthetics-experiment.md`): Meta's Audiobox Aesthetics scores don't beat loudness. Best 0.51 (Audiobox plus tone and stereo) against loudness 0.46; it beats loudness in only 52% of rounds (the bar is 80%). Shuffle p = 0.010 says it's better than chance, not better than loudness. **Not proposed for the next official run.**
- **Permission (answered by Ian, Oct 30):** the mixes were given to the team or released by their artists for free download for us to use.
- **In the app (Oct 30):** the classifier doesn't ship, but the good-rated mixes' band balance does, as Aria's "against good mixes" comparison when no reference song is picked (`engine/aria_engine/typical.py`). It measures exactly as `detail.py` does and only reads `data/features.csv`.

## What's in this folder

| File | What it is |
|---|---|
| `extract.py` | Measures every mix in a folder and writes one row of numbers per mix |
| `detail.py` | The 18 detailed measurements `extract.py` adds (balance, mud, harshness, punch, stereo, clipping, dynamics) |
| `common.py` | Tiers, minimum data checks and the song-grouped split, shared by the scripts |
| `train.py` | **The official evaluation.** Trains the models, compares them with the baselines, applies the ship rule |
| `muse_rater.py` | Muse Spark as a second rater, on the same split |
| `aesthetics.py` | Meta's Audiobox Aesthetics scores (production quality, complexity, enjoyment, usefulness) for each mix. Writes `data/aesthetics.csv` |
| `curves.py` | Each mix's EQ curve (twelfth octaves, loudness taken out) for the app's "typical good mix" chart. Writes `data/curves.csv`, numbers only |
| `experiments/` | Side experiments. Never the official result |
| `data/features.csv` | The measurements (about 2 KB per mix). No audio |
| `data/song_groups.csv` | Fixes for file names the grouping rule gets wrong, each with a reason |
| `data/excluded.csv` | Files left out on purpose, each with a reason |
| `data/manifest.csv` | Where each mix and its rating came from, and permission. To fill in |
| `data/aesthetics.csv` | Audiobox Aesthetics scores (PQ, PC, CE, CU) for the 99 mixes, from `aesthetics.py` |
| `data/shape-model.json` | The shape-only good vs bad direction for the app, from `experiments/shape.py`. Show only features with `show: true` |
| `data/curves.csv` | Each mix's EQ curve: 109 points from 31.5 Hz to 16 kHz, loudness taken out, from `curves.py` |
| `results/` | The reports |

## What you're building, in one minute

- **Input:** a mix. Aria measures its loudest 60 s (usually the drop) and turns it into 29 numbers:
  - **basic (11):** loudness, true peak, punch (crest factor), how much the loudness moves, Bass/Mids/Treble balance and tilt, width per band
  - **detailed (18, `detail.py`):** balance in 8 bands from sub to air, mud, harshness, the strongest ringing peak, punch in the lows and highs, left/right correlation, low-end width, clipping, how much the whole song moves and how far the drop lifts
- **Output:** a tier, **good, mid or bad** (decided Oct 28, `docs/ml-plan.md`), with a confidence and the measurements that pull the mix down.
- **Two approaches, scored on the same held-out songs:**
  1. **Small trained models**: logistic regression, ordinal logistic (knows bad < mid < good), gradient boosting, random forest.
  2. **Muse Spark as a rater**: shown 10 real rated mixes per tier as numbers, then asked to rate new ones. This is the Meta AI part, and the judges weight Meta AI use at 25%.
- **Only the better one ships**, and only if it passes the ship rule in Step 5. It ships labeled "experimental", with its real accuracy shown.

**Why numbers and not audio:** we never store or upload anyone's songs. Each mix becomes about 2 KB of measurements. That's all that goes into git.

**Why balance and not raw band level:** raw band levels rise and fall with loudness, so a louder master looks like "more of everything". Balance (each band against the whole mix) describes the shape of the mix on its own. Loudness keeps its own number.

**Why everything stops at 16 kHz:** mp3s cut the top end, and about a third of the good mixes are mp3. Measuring above 16 kHz would let the model learn the file format instead of the mix.

## The rules (these are hard rules, not preferences)

- **Real mixes only.** Every mix must be one we made or have written permission to use. No commercial releases, not even as "good" examples. Keep where each mix and its rating came from in `data/manifest.csv`.
- **Real labels only.** Every tier comes from a real rating. Never make "bad" mixes by degrading good ones with EQ or compression. That's a made-up label.
- **Honest numbers.** Report the real held-out accuracy even if it's modest. If nothing passes the ship rule, it doesn't ship.
- **Split by song and producer,** never by clip. The scripts do this for you. Don't change it.
- **Decide before you look.** Any change to the models, measurements or ship rule is written down before the run. Ideas that come after seeing results go in `experiments/` and are reported as follow-ups.

### Planned before running: Audiobox Aesthetics (written Oct 30, before any scores existed)

Meta's Audiobox Aesthetics model scores audio on Production Quality, Production Complexity, Content Enjoyment and Content Usefulness. Question: do those four scores, alone or added to our measurements, tell the tiers apart better than loudness and the official best?

- Scores: `ml/aesthetics.py`, on each mix's same loudest 60 s.
- Test: `ml/experiments/audiobox.py`. Three new sets (Audiobox only; Audiobox plus tone and stereo; Audiobox plus detailed), three models (random forest, ordinal logistic, logistic regression), the same song-grouped splits, the shuffle test over the whole best-of step. Bars: loudness only and the official best, on the same splits.
- It stays a side experiment. If it beats loudness in 80% of rounds with shuffle p under 0.05, it goes to the team as a proposal for the next official run, not shipped from this result.

**Result (run Oct 30, exactly as planned; full report in `results/aesthetics-experiment.md`):**

- Best new set: logistic regression on Audiobox plus tone and stereo, **0.51**. Loudness only 0.46, the official best 0.49, chance 0.33.
- It beats loudness in **52%** of the 50 test rounds, short of the 80% bar. Shuffle test p = 0.010: better than chance, not reliably better than loudness. **So it isn't proposed for the next official run.**
- Audiobox alone scores 0.44 to 0.47, no better than loudness. Its medians are almost the same in every tier (good, mid, bad): Production Quality 8.10, 8.02, 8.02; Production Complexity 6.56, 6.51, 6.43; Content Enjoyment 6.67, 6.75, 6.84; Content Usefulness 8.00, 7.89, 7.86. It rates these finished masters as about equally polished.
- Two fixes before the run, neither of which changes the test: the experiment matched mixes by full path (`good/GOOD_x.wav`) while the scores were saved by file name (`GOOD_x.wav`), so 0 of 99 matched; it now matches by file name and stops if under 90% match. And every ML script now reads and writes UTF-8, since Windows was garbling names with characters like "Ø".
- Where to run it: `aesthetics.py` downloads the model from Hugging Face on first use, so it needs a machine that can reach it. It ran on Raghav's Windows laptop (about 20 minutes for 99 mixes, CPU only).
- Proposal, not run: Audiobox may not separate finished masters at all, but could on unmastered work-in-progress mixes, which is what producers check in Aria. Testing that needs a few rated unmastered mixes.

### Planned before running: shape-only good vs bad (written Nov 2, before running; Ian's request of Oct 31)

Question: does the spectral shape of a mix, with loudness taken out, separate the good-rated mixes from the bad-rated ones, and in which direction? Ian's hypothesis: good mixes have a powerful deep low end and clean mids, and are otherwise balanced. Mid is left out: "the mids vs goods will be hard to tell, cuz it's purely a talent and time difference."

- Data: good (30) and bad (33) from `data/curves.csv` (each mix's twelfth-octave curve, 31.5 Hz to 16 kHz, in dB against its own loudness, from its loudest 60 s). Song and producer groups come from `data/features.csv` (with the `data/song_groups.csv` fixes), matched by file name. Mid is scored only afterwards, as a sanity check: on average it should land between good and bad.
- Three measurement sets, no more:
  - **bands (8):** the curve averaged (mean of its dB points) inside the 8 bands of `detail.py`: sub 30-60, low 60-120, low mids 120-400, mids 400-1k, upper mids 1-2.5k, presence 2.5-5k, highs 5-10k, air 10-16k Hz.
  - **hypothesis (5):** low-end power (mean of 30-120 Hz minus mean of 200 Hz-2 kHz); mid bumpiness (spread of the 200 Hz-2 kHz curve after subtracting its own smoothed version, a 1-octave moving average); low-mid build-up (mean of 200-500 Hz minus the mean of its neighbours, 100-200 Hz and 500 Hz-1 kHz); tilt (slope of a straight line through the whole curve, dB per octave); top-end spread (how far the curve strays from that line above 2 kHz, as an RMS in dB).
  - **both (13):** the two together.
- Models: logistic regression (L2, C = 0.3) is the model that would ship, because its weights are the direction. A small random forest (300 trees, at least 3 mixes per leaf) is reported as a check only, and is not part of the pick. Standardized inside each training fold only.
- Testing: the same song and producer grouped 5-fold split, repeated 10 times (50 rounds). Loudness only (good vs bad, on the same splits) is reported as a reference, not a bar.
- Pick-the-best step: the set where logistic regression scores best. The shuffle test (500 shuffles, full 10 repeats each) redoes that whole pick on shuffled good/bad labels.
- **The bar for this question (Ian, Oct 31; written Nov 2). It applies to this good vs bad direction question only, not the old 3-tier score, whose 80% rule is unchanged:**
  1. Balanced accuracy on held-out songs above chance (0.50), with shuffle p under 0.05.
  2. Direction stable: a feature's weight has the same sign as in the model trained on all 63 mixes in at least 40 of the 50 rounds. Only stable features may ever be shown in the app.
  3. Ian's hypothesis is checked, not assumed: good should have more low-end power, less mid bumpiness and less low-mid build-up than bad. Whatever the medians show is reported plainly.
- Output: `experiments/shape.py` writes `results/shape-experiment.md`. Only if the bar is met, it also writes `data/shape-model.json` (feature definitions, scaler, weights, the good and bad medians, which features are stable) for the engine. If the bar isn't met, the app shows nothing from it.

**Result (run Nov 2, as planned; full report in `results/shape-experiment.md`): it passes.**

- Best set: both (13 measurements), logistic regression **0.75** on held-out songs (chance 0.50), above chance in 94% of the 50 rounds, shuffle **p = 0.002**. The 8 bands alone 0.72, the hypothesis alone 0.73. Random forest check: 0.76.
- **Loudness alone scores 0.72 on the same question.** Shape separates good from bad about as well as loudness, not better. What it adds is that it's loudness-free and points to EQ moves a producer can make.
- Direction: 12 of 13 measurements keep their sign in at least 40 of 50 rounds. Good mixes have more sub (+3.3 dB), smoother mids, less low-mid build-up (200-500 Hz, -1.3 dB), more air (+2.0 dB), a slightly stronger low end against the mids, a slightly steeper downward tilt and a smoother top end.
- Ian's hypothesis holds on all three counts: more powerful low end, cleaner (smoother) mids, less low-mid build-up. The sub band carries most of the low-end difference; 60-120 Hz is the same in good and bad.
- Mid sanity check: average chance of "good" is 0.64 for good mixes, 0.50 for mid, 0.34 for bad. Mid lands between, as it should.
- Added after seeing the first run, stricter only: a stable weight is shown in the app only if it also agrees with the good-vs-bad medians. Low mids (120-400 Hz) is stable but points opposite ways (features overlap), so it isn't shown. The wording of the plain-language lines was also fixed. Re-run with the same seeds: identical numbers.
- `data/shape-model.json` is written for the engine: 11 features with `show: true`, their definitions, scaler, weights and good and bad medians.

### Planned before running: shape plus stereo and clarity (written Nov 2, before running; Ian's request of Nov 2)

Question: does adding six stereo and clarity measurements we already have to the shape-only model (above) separate good from bad better, without bringing loudness back in? Ian asked whether the shape model can reach 0.80. This is the one try for tonight, not a search.

- Data: the same 30 good and 33 bad mixes, groups and splits as `experiments/shape.py`. Mid scored afterwards only.
- Sets, two and no more:
  - **shape (13):** exactly the shape-only "both" set, rerun here so both sets use the same splits and the same scikit-learn.
  - **shape + stereo + clarity (19):** the 13, plus from `data/features.csv`: `width_mids`, `width_treble`, `width_low`, `lr_correlation` (stereo) and `harsh_share`, `resonance_db` (clarity). All six are ratios, so loudness stays out.
  - Left out on purpose: loudness, true peak, crest, punch, loudness spread, song range, drop lift and clipping (they measure how hard a mix is mastered, which is loudness again); `width_bass` (rounds to 0 for most mixes); `mud_db` (the same as the shape set's low-mid build-up).
- Model: logistic regression, L2, C = 0.3, standardized inside each training fold, as in shape.py. No tuning.
- Testing: the same grouped 5-fold split, 10 repeats (50 rounds), the same seeds.
- **The bar for proposing the 19 over the 13** (Ian's ship rule, applied to "does it add anything"):
  1. The 19 beat the 13 on average and in at least 80% of the 50 rounds (a tie doesn't count as a win).
  2. Shuffle test: the six new columns shuffled across mixes together (keeping each mix's shape), 500 times; the 19's average must beat the 13's by as much as it really does in fewer than 5% of shuffles (p under 0.05).
  3. Directions: the same rule as shape.py (same sign in at least 40 of 50 rounds, and the weight agrees with the good-vs-bad medians) before any new measurement is shown.
- Reported plainly whatever it shows, including whether it reaches 0.80. If the bar isn't met, the app keeps the 13-measurement shape model and nothing changes.
- Output: `experiments/shape_plus.py` writes `results/shape-plus-experiment.md`. It never overwrites `data/shape-model.json`.

## Timeline

| Day | What |
|---|---|
| Oct 28 | The rated mixes (good, mid, bad) are sorted in the shared Drive. |
| Oct 29 | Extraction and first training runs (done) |
| Oct 30 | Run the Muse Spark rater. |
| **Oct 31** | **Checkpoint:** compare both against the baselines, then decide whether it ships |
| Nov 1 to 2 | Claude wires the winner into the engine (`POST /mix/score`) and the Mix check screen |
| Nov 3 | Write the README section: dataset size, split, results |

## Step 1. Set up (about 15 minutes, once)

1. **Accept the GitHub invite** from Ian (github.com/Yumstezy/aria/invitations), then clone:
   ```sh
   git clone https://github.com/Yumstezy/aria.git
   cd aria
   ```
2. **Install the libraries.**
   - **Mac:** install Python 3.11 (`brew install python@3.11`), then:
     ```sh
     ./install.sh                     # sets up engine/.venv and starts the engine (Ctrl+C to stop it)
     engine/.venv/bin/pip install -r ml/requirements.txt
     ```
   - **Windows** (`install.sh` is Mac only; the ML scripts don't need the engine running). Install Python 3.11 from python.org, then in PowerShell from the repo root:
     ```powershell
     py -3.11 -m venv engine\.venv
     engine\.venv\Scripts\pip install -r engine\requirements.txt -r ml\requirements.txt
     copy engine\.env.example engine\.env
     ```
   In the steps below, Windows uses `engine\.venv\Scripts\python` where Mac uses `engine/.venv/bin/python`.
3. **Make your own Meta API key** (only Step 6 needs it):
   - Go to https://dev.meta.ai, open the **API keys** tab, create a key and copy it with the copy button. The full key is only shown once.
   - Open `engine/.env` (hidden on a Mac: in Finder press Cmd+Shift+. to see it) and paste the key after `MODEL_API_KEY=`, with no spaces or quotes.
   - **Never put the key in `.env.example`.** That file is public on GitHub.

## Step 2. Get the mixes

- **The rated mixes are in the shared Drive** (Oct 28). Download them to a folder outside the repo. Never put audio in git.
- **Fill in `data/manifest.csv`:** for each mix, who owns it, whether we have written permission to train on it, where its rating came from, and how a rating maps to a tier. Keep the mapping fixed once you start.

## Step 3. Sort into tiers

```
Aria Training/
  good/   GOOD_Artist - Title.wav
  mid/    MID_Artist - Title.wav
  bad/    BAD_Artist - Title.wav
```

- **The folder is the tier.** Capitals don't matter (`GOOD/` works too). If a mix's rating is unclear, leave it out.
- **Formats:** WAV, AIFF, FLAC and mp3. m4a/AAC can't be read; convert it to WAV or it's skipped.
- **The split groups mixes by the name before ` - `** (underscores count as spaces, capitals are ignored, and a `GOOD_`, `MID_` or `BAD_` prefix is dropped). For `Artist - Title` that's the artist, so every track by one producer stays on the same side of the train/test split. For `Song A - rough` and `Song A - final` it's the song.
- **Names the rule gets wrong** (title and artist swapped, one producer spelled two ways, collabs) go in `data/song_groups.csv` with a reason. **Files to leave out on purpose** (exact duplicates, unreadable formats) go in `data/excluded.csv` with a reason. `extract.py` reads both.

## Step 4. Measure the mixes

```sh
engine/.venv/bin/python ml/extract.py "path/to/Aria Training" ml/data/features.csv
```

- It measures two songs at a time, about 10 to 15 s each, and prints each file as it goes. About 10 minutes for 100 mixes.
- If a file is unreadable it says SKIPPED and moves on. Files in `data/excluded.csv` say LEFT OUT.
- Sanity-check `data/features.csv`:
  - Is the `song` column grouping each producer's tracks together?
  - Are any values empty? Empty means the script couldn't measure that value, and the `unmeasured` column says why. Rows with gaps are left out of training, never filled in.
- Commit everything in `data/`. Never commit audio.

## Step 5. Train the model (the official result)

```sh
cd ml
../engine/.venv/bin/python train.py data/features.csv
```

- **It refuses to run** with fewer than 30 mixes, or fewer than 5 songs per tier.
- **What it compares**, all fixed before the run:
  - baselines: `always-majority` and `loudness-only`
  - four models (logistic regression, ordinal logistic, gradient boosting, random forest), each on the **basic** 11 and the **detailed** 29 measurements
- **How it tests:** 5-fold splits grouped by song and producer, repeated 10 times with different shuffles (50 test rounds). Every model sees the same splits.
- **The scores:**
  - **Balanced accuracy:** with three tiers, 0.33 is a coin toss.
  - **Tiers off:** how far off it is on average. 0 is perfect.
  - **Two off:** good mixes called bad, or bad called good. The mistakes that matter most.
  - **Bad vs better:** the same predictions read as "bad" or "not bad".
- **The ship rule:** the best model must beat the best baseline on average, **in at least 80% of the 50 test rounds**, and **pass the shuffle test** (p under 0.05). The shuffle test redoes the whole pick-the-best-of-8 step on shuffled tiers, so picking the best of several can't make luck look like skill.
- **Runtime:** about 25 minutes, most of it the shuffle test.
- **Results:** `results/train-report.md`. If a model passes, it also saves `models/mix_score.joblib`, with where the good mixes sit on each measurement, so Aria can say what pulls a mix down.

## Step 6. Run Muse Spark as a rater

```sh
cd ml
../engine/.venv/bin/python muse_rater.py data/features.csv
```

- **It uses the basic 11 measurements** and the first of `train.py`'s 10 splits (same shuffle), so it compares with the basic-set models.
- **How it works:** for each held-out song, Muse sees 10 real rated mixes per tier from other songs, then rates the held-out mix with a reason.
- **About one call per mix:** a few minutes and pennies for 100 mixes.
- **Results:** `results/muse-report.md`, including sample reasons, which are good material for the demo.
- **Experiments are welcome.** Try `EXAMPLES_PER_LABEL` at 5, 10 and 15. Write down what you tried and report the setting you pick, not the best of many lucky runs.

## Step 7. The Oct 31 checkpoint

Put both reports side by side and write the decision in `docs/status.md`:

| If | Then |
|---|---|
| A trained model passes the ship rule | It ships as "experimental". Tell Claude which one and the numbers. |
| Muse beats the best baseline overall and in 4 of its 5 folds | It can ship too. Its reasons are a strong demo moment. |
| Nothing passes | It doesn't ship. Say so in the README. Honest is fine. |

## Step 8. Hand it back

Tell Ian or Claude:
- which approach won
- its held-out balanced accuracy, how often it won the test rounds, and the shuffle test
- the dataset: how many mixes and groups per tier, and where the ratings came from

Claude adds `POST /mix/score` to the engine and puts one line on the Mix check screen, for example: "Mix score: mid. From our model, trained on 99 rated mixes." That line is an example, not real data.

## Side experiments

Ideas that came after seeing the official results. Each has its own script in `experiments/` and its own report in `results/`. **They are never the official result.** Report them as follow-ups.

| Experiment | Question | Result |
|---|---|---|
| `experiments/shape.py` (planned before running) | Does the shape of the EQ curve, loudness taken out, separate good from bad, and which way? | Yes: 0.75 (chance 0.50), shuffle p = 0.002, 11 stable directions. Good mixes: more sub and air, smoother mids, less low-mid build-up. Loudness alone 0.72. See `results/shape-experiment.md`. |
| `experiments/audiobox.py` (planned before running) | Do Meta's Audiobox Aesthetics scores tell the tiers apart better than loudness? | No. Best 0.51 (Audiobox plus tone and stereo) vs loudness 0.46, beats loudness in 52% of rounds (bar 80%), shuffle p = 0.010. Audiobox scores are almost the same in every tier. See `results/aesthetics-experiment.md`. |
| `experiments/no_loudness.py` | Can the model tell the tiers apart without loudness? | Yes, better than chance: tone and stereo alone score about 0.49 (chance 0.33), shuffle test p = 0.01. Not better than loudness alone (0.45) by enough to ship. Good mixes have more sub-bass and narrower mids. See `results/no-loudness-experiment.md`. |

## If something goes wrong

| Problem | Fix |
|---|---|
| `No module named sklearn` | `engine/.venv/bin/pip install -r ml/requirements.txt` |
| `No MODEL_API_KEY in engine/.env` | Step 1.3. Check the file is `.env`, not `.env.example`. |
| Meta answers 401 Unauthorized | The key is wrong or cut off. Make a fresh one and copy it with the copy button. |
| `Not enough data to train honestly` | Exactly what it says. Get more mixes or more songs per tier. |
| A mix shows SKIPPED | The file isn't audio Python can read (m4a, for example). Re-export it as WAV. |
| Two tracks by one producer have different `song` values | Add the file to `data/song_groups.csv` with the right name and a reason, then re-run Step 4. |
