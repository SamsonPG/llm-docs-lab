/**
 * WHAT: Checks that the agent's ceilings can actually fire.
 * WHY:  maxToolCalls was 6 while maxSteps was 5. The loop runs at most maxSteps times and a
 *       step raises toolCalls at most once, so the counter could reach 5 and the check
 *       `toolCalls >= 6` was never once true. A limit that cannot be crossed is not a limit,
 *       and this one was described in the README as a cost ceiling.
 * HOW:  node --test
 *
 * The tests below assert the RELATIONSHIPS between the limits, not their values. Someone
 * tuning maxSteps down or maxToolCalls up is exactly how this happened, and a test pinned to
 * specific numbers would have to be edited in the same breath — so it would not have caught
 * it either.
 *
 * LAYER: Domain.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITS } from './agent.mjs';

test('every ceiling is a positive number', () => {
  for (const [name, value] of Object.entries(LIMITS)) {
    assert.equal(typeof value, 'number', `${name} must be a number`);
    assert.ok(value > 0, `${name} must be positive, got ${value}`);
  }
});

test('the tool-call ceiling can actually be reached', () => {
  /*
    One iteration of the loop increments toolCalls at most once, so the highest value it can
    ever hold is maxSteps. If the ceiling sits at or above that, the check is unreachable.
  */
  const highestReachable = LIMITS.maxSteps;
  assert.ok(
    LIMITS.maxToolCalls <= highestReachable,
    `maxToolCalls (${LIMITS.maxToolCalls}) can never be hit: the loop stops after `
    + `maxSteps (${LIMITS.maxSteps}) iterations, so toolCalls cannot exceed ${highestReachable}`,
  );
});

test('the tool-call ceiling leaves the step limit something to do', () => {
  // If they were equal the tool ceiling would fire on the same iteration the loop ends on,
  // which makes it redundant rather than dead — still worth knowing about.
  assert.ok(
    LIMITS.maxToolCalls < LIMITS.maxSteps,
    `maxToolCalls (${LIMITS.maxToolCalls}) should be strictly below maxSteps (${LIMITS.maxSteps}) `
    + 'so it stops a doomed run one model call earlier than the step limit would',
  );
});

test('the token budget is reachable within the step budget', () => {
  /*
    Each step asks for at most 500 output tokens and usage counts input as well, so a run
    accumulates well over 500 per step. A budget far above what maxSteps can spend would be
    another ceiling that never fires — this is the same failure in a different variable.
  */
  const perStepFloor = 500;
  assert.ok(
    LIMITS.maxTokens <= LIMITS.maxSteps * perStepFloor * 4,
    `maxTokens (${LIMITS.maxTokens}) looks unreachable inside ${LIMITS.maxSteps} steps`,
  );
});
