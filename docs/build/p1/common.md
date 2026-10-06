# Phase 1 implementation: rules for every package agent

You are implementing one package of Phase 1 ("Core loop") of "Gold Mining Tycoon", a deterministic browser business simulation. CLAUDE.md (repository root) holds the architecture rules and conventions; follow it exactly. DESIGN.md is the specification. The P1 build plan and contracts were written for you:
- `/tmp/claude-0/-home-user-GoldMiningTycoon/fd6cdad5-56fc-5b53-83bc-13b8ecbf2fd1/scratchpad/p1/plan.md` — read §1 (ground rules, file ownership, definition of done, goldens) and YOUR package block in §4 (search for the package name in backticks, e.g. `frame`).
- `/tmp/claude-0/-home-user-GoldMiningTycoon/fd6cdad5-56fc-5b53-83bc-13b8ecbf2fd1/scratchpad/p1/contracts.md` — the cross-section contract (signatures, slice shapes, actions, pipeline part map, tuning keys, hooks, streams). Where plan.md and contracts.md differ, contracts.md wins.
- `.../scratchpad/p1/rulings-a.md` and `rulings-b.md` — the triage rulings; your package block lists the ones you are bound by. Read those entries.
- `.../scratchpad/p1/reader-<area>.json` — the planning readers' extraction for each DESIGN area (P1 scope, tests and fixtures with DESIGN refs), useful for detail.
Always check DESIGN.md itself for the formulas, worked examples and tests you implement (grep for the § numbers your block cites).

## Working environment
- You run in your own git worktree, which may have been created at an old commit. FIRST, in the worktree root: `git checkout -b p1/<your-package-name> <BASE>` where BASE is the integration commit given in your task line, then `ln -s /home/user/GoldMiningTycoon/node_modules node_modules`. Never run `npm install`; never edit package.json or the lockfile unless your block says you own package.json scripts. If you truly need a new dependency, stop and report it.
- Edit ONLY the files your block says you own (plan.md §1.3 and your block). Other agents build other packages in parallel. Never edit DESIGN.md, BALANCE.md or CLAUDE.md (except the `docs-rulings` package), never tests/golden/** (the integrator regenerates goldens).
- Commit WIP to your branch at every milestone (`git commit -m "WIP <what>"`, your files only). Usage limits interrupt agents; a later agent may continue from your WIP commits.

## Quality bar
- TypeScript strict; no `any`; discriminated unions with exhaustive switches. Engine code pure and deterministic (CLAUDE.md "Architecture rules"); ESLint enforces most of it.
- Every formula has unit tests with the DESIGN worked examples and hand-computed fixtures; property tests where they add confidence; stream-isolation and explain-flag tests for every new draw or explainer; scramblers for every new hidden field. Comments explain WHY and cite DESIGN.
- Small pure functions named for what they compute.

## Verification before you finish (all must pass on your branch)
- `npx tsc -p tsconfig.engine.json --noEmit`, `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.node.json --noEmit`
- `npx eslint .`
- `npx vitest run` (the whole suite; if a failure is outside your files and also fails on BASE, say so)
- `git diff --name-only <BASE>...HEAD` lists only files you own.

## Delivering
- On your branch, `git add` only your files (never the node_modules symlink) and commit with a clear message whose body ends with exactly these two lines:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TySG4kDpRBeAgD2EJ6VE4F
- Do not push, merge or rebase onto anything other than BASE. Report the branch and commit SHA.
- Report `designDeltas` (DESIGN text the integrator should change, with section, what DESIGN says, what you did, why; D-number placeholders) and `contractDeltas` (any change to a contracts.md signature or slice shape you needed), plus deferred items and measured performance where your block names a budget.
