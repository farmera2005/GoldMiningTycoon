// `npm run calibrate:world -- [--worlds N] [--seed-base S] [--tuning overrides.json] [--json path]` (DESIGN §3.7, §3.18;
// BALANCE T-01, T-02). `--tuning` replaces base tuning values by key (one lever at a time, CLAUDE.md balance workflow).
// Generates N two-district worlds (N northern and N arid districts; default 40 as in §3.7) with the full generator and
// prints the class shares, grade, strip, pocket and coarse-gold statistics against the bands. Exits non-zero when a
// gating band fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import { snapshotGenParams } from '../../src/engine/systems/world';
import { bandChecks, runCalibration, type ClassShares, type Percentiles, type TemplateStats } from './world-stats';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function defaultSeedBase(): number {
  const seeds = JSON.parse(
    readFileSync(new URL('../../src/data/balance/seeds.json', import.meta.url), 'utf8'),
  ) as Record<string, number>;
  return seeds['p0'] ?? 1000;
}

const pct = (x: number): string => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : '—');
const g4 = (x: number): string => (Number.isFinite(x) ? x.toFixed(4) : '—');
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : '—');

function classLine(label: string, s: ClassShares): string {
  return `  ${label.padEnd(18)} U ${pct(s.uneconomic).padStart(6)}  M ${pct(s.marginal).padStart(6)}  G ${pct(s.good).padStart(6)}  E ${pct(s.excellent).padStart(6)}`;
}

function pLine(label: string, p: Percentiles, fmt: (x: number) => string): string {
  return `  ${label.padEnd(44)} p10 ${fmt(p.p10)}  p25 ${fmt(p.p25)}  p50 ${fmt(p.p50)}  p75 ${fmt(p.p75)}  p90 ${fmt(p.p90)}  p99 ${fmt(p.p99)}`;
}

function mixLine(label: string, m: Record<string, number>): string {
  return `  ${label.padEnd(18)} ${Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join('  ')}`;
}

/** DESIGN §3.7's published harness values (U / M / G / E %), printed beside the measurement for comparison. */
const DESIGN_3_7: Record<
  string,
  Record<'all' | 'held' | 'open' | 'pool', readonly [number, number, number, number]>
> = {
  northernFederal: {
    all: [73.2, 18.3, 7.0, 1.5],
    held: [66.4, 22.3, 9.3, 2.0],
    open: [88.9, 9.3, 1.6, 0.2],
    pool: [73.1, 20.5, 5.6, 0.8],
  },
  aridFederal: {
    all: [68.7, 21.9, 8.3, 1.1],
    held: [57.5, 27.5, 13.0, 1.9],
    open: [83.5, 14.4, 2.1, 0.1],
    pool: [64.8, 26.1, 8.3, 0.8],
  },
};

function designLine(templateId: string, pop: 'all' | 'held' | 'open' | 'pool'): string {
  const d = DESIGN_3_7[templateId]?.[pop];
  return d === undefined ? '' : `   (DESIGN §3.7 ${d.map((x) => x.toFixed(1)).join(' / ')})`;
}

function report(s: TemplateStats): string[] {
  const lines = [
    `\n[${s.templateId}] districts ${s.districts}, parcels ${s.parcels} (per district mean ${s.parcelsPerDistrict.mean.toFixed(1)}, min ${s.parcelsPerDistrict.min}, max ${s.parcelsPerDistrict.max}), held share ${pct(s.heldShare)}`,
    classLine('all parcels', s.classes.all) + designLine(s.templateId, 'all'),
    classLine('held (staked)', s.classes.held) + designLine(s.templateId, 'held'),
    classLine('open ground', s.classes.open) + designLine(s.templateId, 'open'),
    classLine('LISTING POOL', s.classes.pool) + designLine(s.templateId, 'pool'),
    pLine('held median paystreak-block grade (oz/bcy)', s.heldMedianPsGrade, g4),
    pLine('mined-block grade, bcy-weighted (oz/bcy)', s.minedBlockGrade, g4),
    pLine('strip ratio, whole claim', s.stripWhole, f2),
    pLine('strip ratio, mined blocks', s.stripMined, f2),
    `  paystreak blocks in [0.005, 0.03] ${pct(s.psBlocksInBand)}; > 0.1 oz/bcy ${pct(s.psBlocksOver01)}; with a pocket ${pct(s.pocketShare)}`,
    `  coarse share of paystreak gold ${pct(s.coarseShare)}; mean coarse particle ${s.coarseMeanMg.toFixed(0)} mg`,
    `  open overlooked (bench + deep muck) economic ${pct(s.openOverlookedEconomic)} vs open creek ground ${pct(s.openCreekEconomic)}`,
    `  uneconomic by claim size (held) 20/40/80/160 ac: ${['20', '40', '80', '160'].map((k) => pct(s.uneconomicBySize[k] ?? NaN)).join(' / ')}`,
    `  median contained oz in mined blocks: marginal ${(s.medianMinedOzByClass['marginal'] ?? NaN).toFixed(0)} / good ${(s.medianMinedOzByClass['good'] ?? NaN).toFixed(0)} / excellent ${(s.medianMinedOzByClass['excellent'] ?? NaN).toFixed(0)}`,
    `  pool ÷ held geometric-mean paystreak grade ${f2(s.listedHeldGradeRatio)}; old drill logs on ${pct(s.priorDrillShare)} of claims`,
    mixLine('deposit mix', s.depositMix),
    mixLine('access mix', s.accessMix),
    mixLine('old-timer mix', s.oldTimerMix),
    mixLine('honesty mix', s.honestyMix),
  ];
  return lines;
}

/** Base tuning with the overrides file applied; unknown keys are an error (a typo would silently tune nothing). */
function tuningFrom(file: string | undefined): TuningResolved {
  if (file === undefined) return baseTuning;
  const overrides = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    if (!Object.prototype.hasOwnProperty.call(baseTuning, key)) throw new Error(`--tuning: unknown tuning key ${key}`);
  }
  return { ...baseTuning, ...overrides } as TuningResolved;
}

function main(): void {
  const worlds = Number(arg('worlds') ?? 40);
  const seedBase = Number(arg('seed-base') ?? defaultSeedBase());
  const t0 = performance.now();
  const tuning = tuningFrom(arg('tuning'));
  const result = runCalibration({ worlds, seedBase, tuning });
  const gp = snapshotGenParams(tuning, []);
  const checks = bandChecks(result, gp.prior.statusMult.listed, 0, gp.seller.honestyMix);
  const out: string[] = [
    `World calibration: ${worlds} two-district worlds (seed base ${seedBase}); mean generateWorld ${result.meanGenMs.toFixed(1)} ms, mean world slice ${result.meanWorldKb.toFixed(0)} kB; total ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  ];
  for (const s of Object.values(result.templates)) out.push(...report(s));
  out.push('\nBands:');
  for (const c of checks) {
    const band = `${Number.isFinite(c.lo) ? c.lo.toFixed(4) : '−∞'} … ${Number.isFinite(c.hi) ? c.hi.toFixed(4) : '∞'}`;
    out.push(
      `  ${c.pass ? 'PASS' : c.gating ? 'FAIL' : 'warn'}  ${c.id.padEnd(6)} ${c.templateId.padEnd(16)} ${c.what.padEnd(56)} ${c.value.toFixed(4).padStart(9)}  [${band}]`,
    );
  }
  const failed = checks.filter((c) => c.gating && !c.pass);
  out.push(failed.length === 0 ? '\nAll gating bands pass.' : `\n${failed.length} gating band(s) FAIL.`);
  console.log(out.join('\n'));
  const json = arg('json');
  if (json !== undefined) writeFileSync(json, JSON.stringify({ result, checks }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

main();
