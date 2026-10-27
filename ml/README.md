# Training Aria's mix model: step by step

You're building the part of Aria that can say whether an EDM mix sounds finished, even before the producer loads a reference track. Ian runs the prototype. This track is yours. Everything you need is in this folder. The rules behind it are in `docs/ml-plan.md`.

## What you're building, in one minute

- **Input:** a mix. Aria measures its loudest 60 s (usually the drop) and turns it into 11 numbers:
  - loudness, true peak, punch (crest factor)
  - how much the loudness moves
  - Bass, Mids and Treble levels, and the tilt from bass to treble
  - width in each band
- **Output:** "good" or "needs-work", with a confidence and the measurements that decided it.
- **Two approaches, scored on the same held-out songs:**
  1. **A small trained model**: logistic regression or gradient boosting on the 11 numbers.
  2. **Muse Spark as a rater**: shown about 30 real rated mixes as numbers, then asked to rate new ones. This is the Meta AI part, and the judges weight Meta AI use at 25%.
- **Only the better one ships**, and only if it beats two dumb baselines. It ships labeled "experimental", with its real accuracy shown.

**Why numbers and not audio:** we never store or upload anyone's songs. Each mix becomes about 2 KB of measurements. That's all that goes into git, so 300 mixes take under 1 MB.

## The rules (these are hard rules, not preferences)

- **Real mixes only.** Ian provides the songs. Every mix must be one we made or have written permission to use. No commercial releases, not even as "good" examples.
- **Real labels only.** Every "good" or "needs-work" comes from a person listening. Never make "bad" mixes by degrading good ones with EQ or compression. That's a made-up label.
- **Honest numbers.** Report the real held-out accuracy even if it's modest. If nothing beats the baselines, it doesn't ship.
- **Split by song,** never by clip. The scripts do this for you. Don't change it.

## Timeline

| Day | What |
|---|---|
| Oct 27 to 28 | Set up. Ian hands over mixes. Sort and label them. |
| Oct 29 | First extraction and first training run, even on partial data |
| Oct 30 | More mixes in. Run the Muse Spark rater. |
| **Oct 31** | **Checkpoint:** compare both against the baselines, then decide whether it ships |
| Nov 1 to 2 | Claude wires the winner into the engine (`POST /mix/score`) and the Mix check screen |
| Nov 3 | Write the README section: dataset size, split, results |

## Step 1. Set up (about 15 minutes, once)

1. **Accept the GitHub invite** from Ian, then clone:
   ```sh
   git clone https://github.com/Yumstezy/aria.git
   cd aria
   ```
2. **Install Python 3.11** if you don't have it: `brew install python@3.11`
3. **Install the engine and the ML libraries:**
   ```sh
   ./install.sh                     # sets up engine/.venv and starts the engine (Ctrl+C to stop it)
   engine/.venv/bin/pip install -r ml/requirements.txt
   ```
4. **Make your own Meta API key:**
   - Go to https://dev.meta.ai, open the **API keys** tab, create a key and copy it with the copy button. The full key is only shown once.
   - Open `engine/.env` (it's hidden: in Finder press Cmd+Shift+. to see it) and paste the key after `MODEL_API_KEY=`, with no spaces or quotes.
   - **Never put the key in `.env.example`.** That file is public on GitHub.

## Step 2. Get the mixes from Ian

- **Ian provides the songs.** We checked: no public dataset has EDM mixes with listener ratings and a clear license. The nearest, the Mix Evaluation Dataset (De Man and Reiss, 2017), is other genres.
- **Keep the audio outside the repo,** in `~/Music/Aria Training/`, and share it through a drive, not git.
- **What to ask Ian for:**
  - **Whole mixes, not stems.** WAV or AIFF, any length. The script finds the drop itself.
  - **Versions of the same song** (rough and final). These are the most valuable thing you can get, because the only difference between them is the mixing.
  - **Mostly EDM,** so a small dataset stays consistent.
  - **Target:** 100 mixes, ideally 40 or more of them in pairs, with a rough balance between good and needs-work.

## Step 3. Sort and label

```
~/Music/Aria Training/
  good/
    Song A - final.wav
    Song B.wav
  needs-work/
    Song A - rough.wav
    Song C - v1.wav
```

- **The folder is the label.** If you or the raters can't agree on a mix, leave it out. Unsure data hurts more than less data.
- **Name versions of the same song with the same name before ` - `.** The scripts use that name to keep every version of a song on the same side of the train/test split.
- **Who labels:**
  - Best: 3 people who didn't make the mix each say good or needs-work, and the majority decides the folder.
  - Acceptable: Ian labels them alone. Then every report must say "labeled by one producer".
  - Keep a simple sheet `ml/data/ratings.csv` with the columns `file, rater, label` for every rating, so we can report how often raters agreed.

## Step 4. Measure the mixes

```sh
engine/.venv/bin/python ml/extract.py "~/Music/Aria Training" ml/data/features.csv
```

- It takes about 4 s per song, and prints each file as it goes.
- If a file is unreadable it says SKIPPED and moves on. Check those.
- Open `ml/data/features.csv` and sanity-check it:
  - Do the `good` mixes look louder or more balanced than the `needs-work` ones?
  - Are any values empty? Empty means the script couldn't measure that value, and the `unmeasured` column says why. Rows with gaps are left out of training, never filled in.
- Commit `ml/data/features.csv` and `ml/data/ratings.csv`. Never commit audio.

## Step 5. Train the model

```sh
cd ml
../engine/.venv/bin/python train.py data/features.csv
```

- **It refuses to run** with fewer than 20 mixes, or fewer than 3 songs per label. Below that the numbers mean nothing.
- **It trains four things** and scores each on songs it never saw, using balanced accuracy, where 0.5 is a coin toss:
  - `always-majority`: the "always guess the common answer" baseline
  - `loudness-only`: the "just look at loudness" baseline
  - `logistic regression` and `gradient boosting`: the real models
- **Results:** they go to `ml/results/train-report.md`. If the best model beats both baselines, it also saves `ml/models/mix_score.joblib` and lists which measurements push a mix toward good or needs-work.
- **Reading it:**
  - The **spread across folds** tells you how shaky the number is. With 100 mixes, expect ±0.1.
  - If the model only matches `loudness-only`, it hasn't learned anything beyond loudness. That's a real finding, so report it.

## Step 6. Run Muse Spark as a rater

```sh
cd ml
../engine/.venv/bin/python muse_rater.py data/features.csv
```

- **The same split as Step 5,** so the numbers compare fairly.
- **How it works:** for each held-out song, Muse sees about 30 real rated mixes from other songs, then rates the held-out mix with a reason.
- **About one call per mix:** about 2 minutes and pennies for 100 mixes.
- **Results:** they go to `ml/results/muse-report.md`, including sample reasons, which are good material for the demo.
- **Experiments are welcome.** Try `EXAMPLES_PER_LABEL` at 10, 15 and 25. Write down what you tried and report the setting you pick, not the best of many lucky runs.

## Step 7. The Oct 31 checkpoint

Put both reports side by side and write the decision in `docs/status.md`:

| If | Then |
|---|---|
| Either one beats both baselines clearly (by 0.1 or more) | It ships as "experimental". Tell Claude which one and the numbers. |
| Both are within noise of the baselines | It doesn't ship. Say so in the README. Honest is fine. |
| Muse and the model are both good | Ship the one that explains itself better. Muse's reasons are a strong demo moment. |

## Step 8. Hand it back

Tell Ian or Claude:
- which approach won
- its held-out balanced accuracy, and the spread across folds
- the dataset: how many mixes and songs, how many pairs, and who labeled them

Claude adds `POST /mix/score` to the engine and puts one line on the Mix check screen, for example: "Mix score: needs work. From our model, trained on 112 rated mixes." That line is an example, not real data.

## If something goes wrong

| Problem | Fix |
|---|---|
| `No module named sklearn` | `engine/.venv/bin/pip install -r ml/requirements.txt` |
| `No MODEL_API_KEY in engine/.env` | Step 1.4. Check the file is `.env`, not `.env.example`. |
| Meta answers 401 Unauthorized | The key is wrong or cut off. Make a fresh one and copy it with the copy button. |
| `Not enough data to train honestly` | Exactly what it says. Get more mixes or more songs per label. |
| A mix shows SKIPPED | The file isn't audio Python can read. Re-export it as WAV. |
