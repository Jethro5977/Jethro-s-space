/** Spring configuration. */
export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
}

/** Result of a single spring step. */
export interface SpringResult {
  value: number;
  velocity: number;
}

/**
 * Advance a 1-D spring one time-step.
 *
 * @param current       Current value.
 * @param velocity      Current velocity.
 * @param target        Target value the spring is pulling toward.
 * @param spring        Spring parameters (stiffness, damping).
 * @param deltaSeconds  Elapsed time in seconds.
 */
export declare function advanceSpring(
  current: number,
  velocity: number,
  target: number,
  spring: SpringConfig,
  deltaSeconds: number
): SpringResult;

/** 2-D point used by the pointer spring. */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Advance a 2-D pointer spring in-place.
 *
 * @param pointer          Current position (mutated).
 * @param pointerVelocity  Current velocity (mutated).
 * @param target           Target position.
 * @param spring           Spring parameters.
 * @param deltaSeconds     Elapsed time in seconds.
 */
export declare function advancePointerSpring(
  pointer: Point2D,
  pointerVelocity: Point2D,
  target: Point2D,
  spring: SpringConfig,
  deltaSeconds: number
): void;
