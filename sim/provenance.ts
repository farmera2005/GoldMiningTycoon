// Run identity (BALANCE §6.2, §10.1): every output records the git SHA, tuningHash, BOT_VERSION and seedBase; the
// same four reproduce summary.json byte for byte. A tree with uncommitted changes to tracked files is marked
// `-dirty` (as `git describe --dirty` does), so a dirty run is never mistaken for a committed one.
import { execFileSync } from 'node:child_process';

function git(args: readonly string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function gitSha(cwd: string = process.cwd()): string {
  const head = git(['rev-parse', 'HEAD'], cwd);
  if (head === null || head === '') return 'unknown';
  const status = git(['status', '--porcelain', '--untracked-files=no'], cwd);
  return status === null || status === '' ? head : `${head}-dirty`;
}
