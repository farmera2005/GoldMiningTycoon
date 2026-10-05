// gmt/id-prefix-literal: every nextId(counters, prefix) call names its prefix as a plain string literal, so the
// registry test can check that the prefix is registered in engine/core/ids.ts and minted only by its owning section
// (DESIGN §2.4 "IDs", §2.14 "registries"). With the `prefixes` option it also rejects unregistered prefixes.
import { createRegistryArgRule } from './lib/registry-arg-rule.js';

export default createRegistryArgRule({
  what: 'id prefix',
  defaultCallees: ['nextId'],
  argIndex: 1,
  registryOption: 'prefixes',
  registryFile: 'src/engine/core/ids.ts',
  designRef: 'DESIGN §2.4',
  description: 'Require the id prefix argument of nextId() to be a registered string literal.',
});
