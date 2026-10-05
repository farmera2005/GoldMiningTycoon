// gmt/rng-stream-literal: every rng(seed, stream, ...keys) call names its stream as a plain string literal, so the
// registry test can check that the stream is registered in engine/core/streams.ts and drawn on only by its owning
// section (DESIGN §2.3 item 1 and stream rule b). With the `streams` option it also rejects unregistered names.
import { createRegistryArgRule } from './lib/registry-arg-rule.js';

export default createRegistryArgRule({
  what: 'stream name',
  defaultCallees: ['rng'],
  argIndex: 1,
  registryOption: 'streams',
  registryFile: 'src/engine/core/streams.ts',
  designRef: 'DESIGN §2.3',
  description: 'Require the RNG stream argument of rng() to be a registered string literal.',
});
