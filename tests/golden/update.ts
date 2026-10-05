// `npm run goldens:update`: regenerates every `<name>.hashes.json` from its recorded log. Only for intentional rule
// changes (DESIGN §2.14): commit the new hashes with the change and note it in CHANGELOG.md.
import { writeFileSync } from 'node:fs';
import { computeGolden, goldenLogFiles, goldenName, hashesFileFor, readLog } from './goldens';

const files = goldenLogFiles();
if (files.length === 0) {
  console.error('No golden logs (*.log.json) found in tests/golden.');
  process.exit(1);
}
for (const file of files) {
  const name = goldenName(file);
  const golden = computeGolden(readLog(file), name);
  writeFileSync(hashesFileFor(file), `${JSON.stringify(golden, null, 2)}\n`);
  const last = golden.hashes[golden.hashes.length - 1];
  console.log(`${name}: ${golden.hashes.length} hashes, final turn ${last?.turn} ${last?.hash}`);
}
