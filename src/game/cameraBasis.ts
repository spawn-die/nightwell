/**
 * Matches GameView camera offset (-8, 14, 11): screen-forward WASD feels correct.
 * lookDir xz from camera toward target = -offset.xz = (8, -11)
 */
const LOOK_X = 8;
const LOOK_Z = -11;
const LEN = Math.hypot(LOOK_X, LOOK_Z);

/** Unit forward on screen (W) in world XZ */
export const CAM_FORWARD = { x: LOOK_X / LEN, z: LOOK_Z / LEN };
/** Unit right on screen (D) in world XZ */
export const CAM_RIGHT = { x: -CAM_FORWARD.z, z: CAM_FORWARD.x };

/**
 * Convert screen-space stick (sx, sz) where +sz is screen-up/W and +sx is screen-right/D
 * into world XZ velocity direction (unnormalized if both zero).
 */
export function screenToWorldMove(sx: number, sz: number): { x: number; z: number } {
  return {
    x: CAM_RIGHT.x * sx + CAM_FORWARD.x * sz,
    z: CAM_RIGHT.z * sx + CAM_FORWARD.z * sz,
  };
}
