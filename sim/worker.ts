// A simulator worker process (DESIGN §2.12 "Harness": a Node worker pool; sim/runner.ts forks it with
// `--import tsx`). It takes jobs by index from the runner and returns each output; it keeps no state between jobs, so
// which worker ran a game never matters. It exits when the runner goes away.
import { runJob } from './jobs';
import type { FromWorker, ToWorker } from './protocol';

if (process.send === undefined) throw new Error('sim/worker.ts must run as a forked worker process');

const clock = (): number => performance.now();

function reply(msg: FromWorker): void {
  process.send?.(msg);
}

process.on('message', (raw: unknown) => {
  const msg = raw as ToWorker;
  if (msg.type === 'stop') {
    process.disconnect();
    return;
  }
  try {
    reply({ type: 'done', runId: msg.runId, jobId: msg.jobId, output: runJob(msg.job, clock) });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    reply({ type: 'failed', runId: msg.runId, jobId: msg.jobId, message: err.message, stack: err.stack ?? '' });
  }
});

// A worker never outlives its runner.
process.on('disconnect', () => process.exit(0));
