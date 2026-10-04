# Design-time prototypes

These scripts were written while drafting `DESIGN.md` and `BALANCE.md`. They produced the worked numbers and calibration figures that those documents cite. They are **not game code**. They do not follow the engine rules in `CLAUDE.md` (keyed RNG streams, `dmath`, tests), and they are deliberately simplified.

During Phase 0, port the calibration harnesses into `sim/` (DESIGN §3.18, §4.22, §10.21), and replace these figures with the engine's own measurements. After that, the scripts are historical.

| Folder | What it is | Cited by | Run |
|---|---|---|---|
| `preflight/` | The preflight economic model: world claim-quality shares, reference-operation season economics, cash curves, and a crude Monte Carlo of the first two seasons by bot and start type. `preflight_results.txt` is its output for the published numbers. `frozen_wash.py`, `listed_mult.py` and `inh_k.py` are the §3 re-run checks built on it. | BALANCE §9, DESIGN §3.7 and §3.21 | `python3 preflight_model.py` (about 8.5 minutes; `--fast` for a quick run). Standard library only. |
| `geology/` | Calibration harness for the §3 world generator (`geo-calib.js`) and the `drawSample` nugget-effect model (`sample-calib.js`). | DESIGN §3.7, §3.8, §3.21 | `node geo-calib.js`, `node sample-calib.js` |
| `estimator/` | Reference prototype of the §4 estimator together with a §3-faithful generator and draw. It produced the worked examples in DESIGN §4.4–4.11 (seed 104). | DESIGN §4.9, §4.24 | `node run.js` (see `example.js`) |
| `estimator-deep/` | The same prototype extended for the deep-muck example, where drilling wins, and the value-of-information runs. | DESIGN §4.9 "When drilling wins", §4.11 | `node deep.js`, `node deepvoi3.js` |
| `gold-price/` | Monte Carlo of the §10 price model (2,000 seeds × 10 years). `goldsim2.js` is the re-run (D-10.30 neutral levels, `volMult` jump scaling) whose figures §10.6 publishes. | DESIGN §10.6, §10.24 | `node run6.js` (or the `run*.js` variants) |
