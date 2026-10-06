// Worker thread of the §4 estimator calibration: runs WorldTasks and posts WorldResults back.
import { parentPort } from 'node:worker_threads';
import { runWorld, type WorldTask } from './estimator-world';

parentPort?.on('message', (task: WorldTask | null) => {
  if (task === null) {
    process.exit(0);
  }
  parentPort?.postMessage(runWorld(task));
});
