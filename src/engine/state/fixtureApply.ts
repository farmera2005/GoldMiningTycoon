// Init part N10, `fixture.apply` (s02 #2, S08-27; P1 contract §1.5, §1.6): applies a BALANCE §2.1 fixture to a fresh
// game through the owners' builders, in a fixed order so ids mint the same way every time: §3 rewrites one unlisted
// claim of the fixture's district into the reference claim, §5 records the tenure and its production interests, §9
// places the machines on it, §8 hires the crew, §1 sets the owner's assignment, §11 books the loans, and §7 readies the
// site and the plan. The orchestration is real (W0); every builder is its owner's and throws ContractStubError until
// that package lands, so a fixture game builds only once §3, §5, §7, §8, §9 and §11 have merged.
import { ContractStubError } from '../core/assert';
import type { ClaimId, MachineId } from '../core/ids';
import { usdToCents, type Cents } from '../core/money';
import type { OwnerAssignment } from '../systems/company/types';
import { createLoan } from '../systems/finance/loans';
import { fixtureMachine } from '../systems/fleet/create';
import { fixtureTenure } from '../systems/land/tenure';
import { fixtureSite } from '../systems/ops/site';
import { fixtureEmployee } from '../systems/staff/candidates';
import { buildReferenceClaim } from '../systems/world/wrapUp';
import type { FixtureSpec } from './fixture';
import type { GameState, InitCtx } from './types';

export function applyFixture(draft: GameState, spec: FixtureSpec): void {
  const districtId = draft.world.districtIds[0];
  if (districtId === undefined) throw new ContractStubError(`fixture.apply(${spec.id}): no district`);
  const claimId = buildReferenceClaim(draft, spec.claim, districtId);
  fixtureTenure(draft, claimId, spec);
  const machineIds: MachineId[] = spec.fleet.map((item) => fixtureMachine(draft, item, claimId));
  for (const member of spec.crew) fixtureEmployee(draft, member, claimId);
  draft.company.owner.assignment = ownerAssignment(draft, spec, claimId, machineIds);
  for (const loan of spec.loans) {
    createLoan(draft, {
      product: loan.product,
      lenderName: 'Fixture lender',
      principalCents: usdToCents(loan.principalUsd) as Cents,
      annualRate: loan.annualRate,
      termMonths: loan.termMonths,
      schedule: 'level',
      fundedTo: 'cash',
      collateral: [],
    });
  }
  fixtureSite(draft, claimId, spec.site, spec.stripAheadBlocks, spec.plan);
}

/** The owner as the claim's foreman, as the operator of the spec's model, or in the office. */
function ownerAssignment(
  draft: GameState,
  spec: FixtureSpec,
  claimId: ClaimId,
  machineIds: readonly MachineId[],
): OwnerAssignment {
  switch (spec.owner.assignment) {
    case 'office':
      return { kind: 'office' };
    case 'foreman':
      return { kind: 'foreman', claimId };
    case 'operator': {
      const modelId = spec.owner.operatorModelId;
      const machineId = machineIds.find((id) => draft.fleet.machines[id]?.modelId === modelId);
      if (machineId === undefined) {
        throw new ContractStubError(`fixture.apply(${spec.id}): no ${String(modelId)} for the owner to operate`);
      }
      return { kind: 'operator', claimId, machineId };
    }
  }
}

/** N10 as an init part body: runs only for a fixture game (`init.scratch.fixture`). */
export function applyFixtureInit(draft: GameState, init: InitCtx): void {
  if (init.scratch.fixture !== null) applyFixture(draft, init.scratch.fixture);
}
