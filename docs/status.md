# Status

Updated at the end of each session: what passed, what's next, any blocker.

## Now: Step 0, repo and tooling (Oct 26)

Pass condition (from `docs/build-steps.md`): `uvicorn` serves `/health`, `pytest` runs, and `ui/index.html` opens in Chrome and looks like the Home screenshot, with empty states where data will go.

### What's being built

**Install**
- `install.sh` at the repo root. It finds Python 3.11, creates `engine/.venv`, installs the engine's dependencies, copies `engine/.env.example` to `engine/.env` if there isn't one, and starts the engine on `127.0.0.1:8765`.
- `engine/run.sh` starts the engine again later, without reinstalling.
- Ian's Mac only has Python 3.9 right now, so this step installs Python 3.11 with Homebrew (`brew install python@3.11`).

**Engine** (`engine/`)
- `requirements.txt`, which installs:
  - fastapi and uvicorn: the web server
  - python-dotenv: lets uvicorn read `.env`
  - pytest and httpx: tests
  - The audio libraries (numpy, soundfile, pyloudnorm and the rest) come in Step 2, when something first uses them.
- `.env.example` with `MODEL_API_KEY`, `MUSE_BASE_URL` and `MUSE_MODEL`, all blank or defaulted. The real `.env` is gitignored.
- `aria_engine/app.py`: the FastAPI app with `GET /health`. It returns the engine version and whether a Muse key is set (true or false, never the key itself), so the UI can say honestly why advice is unavailable.
- CORS allows only the UI: `file://` pages (which includes `jweb`) and localhost. Other websites in your browser can't call the engine.
- `tests/test_health.py` and `pytest.ini`.

**UI** (`ui/`)
- `index.html`: the Aria window with the Home screen. It has the side rail (Home, Mix check, Live analyzer, Groove match, Reference, Ask Muse) and matches the Home screenshot's layout, but every data spot shows an empty state:
  - **Reference card:** "No reference yet" and the drop zone.
  - **Tool cards:** "Not run yet".
  - **Section grid and Fix first:** "Run Check mix to see this".
  - **No numbers anywhere** until the engine sends them.
- `strip.html`: the 169px device strip in the Night theme, with Check mix, Ask, Open window and the same empty states.
- `app.js`: shared code.
  - It checks `/health` and shows whether the engine is connected.
  - It talks to Max through `window.max` when running inside Live. In a normal browser it calls the engine directly.
  - Check mix only says "not built yet" until Step 2.
- The UI uses `design/ds/tokens.css`, `bundle.css` and `bundle.js` as they are, with no build step.
- Theme: Sky by default. Adding `?theme=night` to the URL forces Night for development.

**Test pack** (`test-pack/`)
- `answer-key.json` in the shape from `docs/contracts.md`, with empty lists. The teammate fills in the real values once the real files exist. No made-up entries.
- `README.md` saying what goes in the folder and that we must own everything in it.

**Repo**
- A short `README.md` so teammates landing on GitHub know what this is and how to run it.

### How to check it yourself
1. Run `./install.sh` from the repo root. It should end with the engine running on 127.0.0.1:8765.
2. Open http://127.0.0.1:8765/health in a browser. You should see `"status": "ok"`.
3. In a second terminal: `cd engine && .venv/bin/pytest`. All tests pass.
4. Open `ui/index.html` in Chrome. It should look like `design/screens/01-home.png`, but with empty states instead of numbers, and show "Engine connected".
5. Stop the engine and reload the page. It should say the engine isn't running.

## Next
- Step 1: the Day 1 tests. To start them, Ian needs to say how the `.amxd` gets built (Ian wires it in Max from a guide, or Claude generates it) and which Max version is installed.

## Decisions so far
- The build started Oct 26.
- The build order follows `docs/rubric.md`. Ask Muse driving Live is core (Step 6). Groove match stays (Step 9).
- With no reference, Check mix shows raw measurements with no verdict.
- The repo is public from the start, so `.env` and tester audio are gitignored.
- Ian has Live 12 Suite and a Meta API key.

## Blockers
- None yet.
