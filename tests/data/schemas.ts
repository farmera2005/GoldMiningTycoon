// zod schemas for every data file under src/data (CLAUDE.md "Content and tuning"; DESIGN §2.10, §2.14 "Data
// validation", D-2.7). This file is the index: each data area has its own schema file under tests/data/schemas/, owned
// by the package that owns the data (P1 plan §1.3; P1 contract §0.3), and the tests import everything from here. The
// schemas live with the tests because data/ may import only data/ and engine types (DESIGN §2.1), and zod is a
// test-time dependency.
//
//   schemas/common.ts        building blocks (num, prob, range, keyed, mixes, lnLaw, tuningValue, size records)
//   schemas/world.ts         §3 enumerations, region templates, bedrock, towns, holder names, sample-method rows
//   schemas/prospecting.ts   §4 enumerations, method rows, small-count table, engagements, ripple rows
//   schemas/tuning/<ns>.ts   one file per tuning namespace, composed in schemas/tuning/index.ts (TUNING_KEY_SCHEMAS)
//   schemas/difficulty.ts    data/difficulty.ts
//   schemas/hooks.ts         data/events/hooks.ts
//   schemas/app.ts           balance seeds, ui.* configuration, UI text
//
// A package that adds a data area adds its schema file, exports it here and adds its COVERAGE lines in
// tests/data/validation.test.ts.
export * from './schemas/common';
export * from './schemas/world';
export * from './schemas/prospecting';
export * from './schemas/tuning';
export * from './schemas/difficulty';
export * from './schemas/hooks';
export * from './schemas/app';
export * from './schemas/equipment';
export * from './schemas/text';
