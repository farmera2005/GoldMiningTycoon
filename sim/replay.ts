// `npm run replay -- <log.json> [--expect <hashes.json>] [--explain] [--json]`
// Replays a recorded action log (DESIGN §2.3, §2.14) and prints the state hash after turn 0 and every week. With
// --expect it compares against a golden hashes file and exits non-zero at the first divergence.
import { readFileSync } from 'node:fs';
import { replayLog, type ReplayLog, type TurnHash } from '../src/engine';

interface Args {
  log: string;
  expect: string | null;
  explain: boolean;
  json: boolean;
}

function usage(message?: string): never {
  if (message !== undefined) console.error(message);
  console.error('usage: npm run replay -- <log.json> [--expect <hashes.json>] [--explain] [--json]');
  process.exit(2);
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { log: '', expect: null, explain: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--expect') {
      const next = argv[++i];
      if (next === undefined) usage('--expect needs a file');
      args.expect = next;
    } else if (a === '--explain') args.explain = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else if (args.log === '') args.log = a;
    else usage(`unexpected argument ${a}`);
  }
  if (args.log === '') usage();
  return args;
}

function readJson<T>(file: string): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (e) {
    usage(`cannot read ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const log = readJson<ReplayLog>(args.log);
  const result = replayLog(log, { explain: args.explain });
  if (args.json) {
    console.log(
      JSON.stringify({ name: log.name ?? args.log, tuningHash: result.state.meta.tuningHash, hashes: result.hashes }),
    );
  } else {
    console.log(
      `# ${log.name ?? args.log} · seed ${log.seed} · ${log.weeks} weeks · tuning ${result.state.meta.tuningHash}`,
    );
    for (const h of result.hashes) console.log(`${h.turn}\t${h.hash}`);
  }
  if (args.expect !== null) {
    const expected = readJson<{ hashes: TurnHash[] }>(args.expect).hashes;
    const diff = result.hashes.findIndex((h, i) => expected[i]?.turn !== h.turn || expected[i]?.hash !== h.hash);
    if (diff >= 0 || expected.length !== result.hashes.length) {
      const at = diff >= 0 ? result.hashes[diff]?.turn : 'length';
      console.error(`MISMATCH at turn ${String(at)} (expected ${expected.length} hashes, got ${result.hashes.length})`);
      process.exit(1);
    }
    console.error(`OK: ${result.hashes.length} hashes match ${args.expect}`);
  }
}

main();
