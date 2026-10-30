# For Raghav: run the EQ curves and Audiobox on the 99 mixes

Two new scripts need the rated mixes, which are on your computer. They measure each mix's EQ curve and score each one with Meta's Audiobox Aesthetics model, then run a test that was planned before any scores existed. Only numbers get committed, never audio. About 15 minutes, mostly installing.

**Easiest:** open Claude Code in your `aria` folder and paste everything in the box below.

```
You're helping on Aria's mix model (ml/ in this repo). Read ml/README.md first, especially
"The rules" and "Planned before running: Audiobox Aesthetics". Those rules are hard rules.

The rated mixes are on this computer in a folder with good/, mid/ and bad/ subfolders.
Ask me for its path before starting.

Do these steps in order and stop to tell me if any fails:

1. git pull, so ml/curves.py, ml/aesthetics.py and ml/experiments/audiobox.py are here.

2. Install into the engine's virtualenv (create it per ml/README.md Step 1 if it doesn't exist):
   - engine/.venv/bin/pip install -r engine/requirements.txt -r ml/requirements.txt
     (on Windows the python and pip are under engine\.venv\Scripts\ instead of engine/.venv/bin/)
   - This installs audiobox_aesthetics, which pulls in torch and torchaudio. If torch is already
     installed for Demucs, keep that version: pass pip a constraint pinning torch to the installed
     version so it doesn't get swapped.
   - Check it loads: python -c "from audiobox_aesthetics.infer import initialize_predictor; initialize_predictor()"
     The first run downloads the model.

3. Measure each mix's EQ curve:
   engine/.venv/bin/python ml/curves.py <mixes folder> ml/data/curves.csv

4. Score each mix with Audiobox:
   engine/.venv/bin/python ml/aesthetics.py <mixes folder> ml/data/aesthetics.csv
   Both scripts read each mix's loudest 60 s, the same excerpt as ml/extract.py, and print one
   line per mix. Report any SKIPPED lines to me.

5. Check both CSVs have about 99 rows, one per mix in ml/data/features.csv, and that the file
   names match features.csv's "file" column. If many don't match, stop and tell me.

6. Run the planned side experiment, exactly as written (it takes a while because of the
   shuffle test):
   engine/.venv/bin/python ml/experiments/audiobox.py ml/data/features.csv ml/data/aesthetics.csv
   It writes ml/results/aesthetics-experiment.md.

7. Don't change the experiment, the measurement sets, the models or the bar after seeing the
   result. If the result suggests a new idea, write it down as a proposal in your reply to me.
   Don't run it. That's the "decide before you look" rule in ml/README.md.

8. Commit only ml/data/curves.csv, ml/data/aesthetics.csv and ml/results/aesthetics-experiment.md,
   with a message that states the headline result honestly (the best new set's balanced accuracy,
   loudness-only's, the share of rounds it beats loudness, and the shuffle p). Never commit audio.
   Push to main.

9. Tell me, in plain words: the best result, whether it beats loudness in 80% of rounds with
   shuffle p under 0.05, and the Audiobox medians per tier.
```

When it's pushed, tell Ian. The curves turn on the "typical good mix" chart in the app, and the Audiobox result decides whether it goes into the next official model run.
