/**
 * Spring physics for hover-tilt animation.
 *
 * A critically-damped or under-damped spring integrator used to drive pointer
 * tracking and hover activation.  All functions are pure — no shared mutable
 * state — so they can be unit-tested in isolation.
 *
 * @module spring
 */

/**
 * Advance a 1-D spring one time-step.
 *
 * Uses a fixed sub-step integrator (≤ 16 ms per step) so the result stays
 * stable regardless of frame rate.
 *
 * @param {number} current   Current value.
 * @param {number} velocity  Current velocity.
 * @param {number} target    Target value the spring is pulling toward.
 * @param {{ stiffness: number, damping: number }} spring  Spring parameters.
 * @param {number} deltaSeconds  Elapsed time in seconds.
 * @returns {{ value: number, velocity: number }}
 */
export function advanceSpring(current, velocity, target, spring, deltaSeconds) {
  const steps = Math.max(1, Math.ceil(deltaSeconds / 0.016));
  const step = deltaSeconds / steps;
  let next = current;
  let speed = velocity;

  for (let i = 0; i < steps; i++) {
    speed += ((target - next) * spring.stiffness - speed * spring.damping) * step;
    next += speed * step;
  }

  // Snap to target when close enough to avoid perpetual micro-oscillation.
  if (Math.abs(target - next) < 0.0001 && Math.abs(speed) < 0.0001) {
    return { value: target, velocity: 0 };
  }

  return { value: next, velocity: speed };
}

/**
 * Advance a 2-D pointer spring (x, y) in-place and return the mutated object.
 *
 * @param {{ x: number, y: number }} pointer          Current pointer position (mutated).
 * @param {{ x: number, y: number }} pointerVelocity  Current velocity (mutated).
 * @param {{ x: number, y: number }} target           Target position.
 * @param {{ stiffness: number, damping: number }} spring  Spring parameters.
 * @param {number} deltaSeconds  Elapsed time in seconds.
 */
export function advancePointerSpring(pointer, pointerVelocity, target, spring, deltaSeconds) {
  let result = advanceSpring(pointer.x, pointerVelocity.x, target.x, spring, deltaSeconds);
  pointer.x = result.value;
  pointerVelocity.x = result.velocity;

  result = advanceSpring(pointer.y, pointerVelocity.y, target.y, spring, deltaSeconds);
  pointer.y = result.value;
  pointerVelocity.y = result.velocity;
}
