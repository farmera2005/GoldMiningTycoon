// The weekly pipeline (DESIGN §2.6): steps 0–16 in this fixed order, each running its parts from the part table
// (turn/parts.ts) in §2.6 sub-order. Changing the order is an expensive decision (CLAUDE.md "Ask before"); tests pin
// both the steps and the parts.
import { runStepParts } from './parts';
import { step00Guard } from './steps/step00Guard';
import { step01Calendar } from './steps/step01Calendar';
import { step02Market } from './steps/step02Market';
import { step03Markets } from './steps/step03Markets';
import { step04Events } from './steps/step04Events';
import { step05Competitors } from './steps/step05Competitors';
import { step06PendingDeals } from './steps/step06PendingDeals';
import { step07Staff } from './steps/step07Staff';
import { step08Fleet } from './steps/step08Fleet';
import { step09Operations } from './steps/step09Operations';
import { step10Wear } from './steps/step10Wear';
import { step11Shop } from './steps/step11Shop';
import { step12Cleanup } from './steps/step12Cleanup';
import { step13Permits } from './steps/step13Permits';
import { step14Finance } from './steps/step14Finance';
import { step15Distress } from './steps/step15Distress';
import { step16WrapUp } from './steps/step16WrapUp';
import type { PipelineStep, StepDef } from './types';

const STEP_DEFS: readonly StepDef[] = [
  step00Guard,
  step01Calendar,
  step02Market,
  step03Markets,
  step04Events,
  step05Competitors,
  step06PendingDeals,
  step07Staff,
  step08Fleet,
  step09Operations,
  step10Wear,
  step11Shop,
  step12Cleanup,
  step13Permits,
  step14Finance,
  step15Distress,
  step16WrapUp,
];

export const PIPELINE: readonly PipelineStep[] = STEP_DEFS.map((def) => ({
  ...def,
  run: (state, ctx) => runStepParts(def.index, state, ctx),
}));
