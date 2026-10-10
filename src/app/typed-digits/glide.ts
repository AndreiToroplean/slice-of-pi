/**
 * A glide of a scroll position to a target, ending at a set time with no speed left: a cubic curve (Hermite) from the
 * position and speed it starts with. Replanning a glide from wherever the current one is, at its current speed, keeps
 * the motion smooth however often it's replanned, for instance to end sooner.
 */
export interface Glide {
  readonly from: number;
  /** Speed at the start, in pixels per ms. */
  readonly speed: number;
  readonly to: number;
  readonly start: number;
  readonly duration: number;
}

export interface GlideState {
  readonly position: number;
  /** In pixels per ms. */
  readonly speed: number;
}

/** When `glide` ends. */
export function glideEnd(glide: Glide): number {
  return glide.start + glide.duration;
}

/** Where `glide` is at `time`, and how fast it's going: at its start before it starts, at rest at its target after. */
export function glideAt(glide: Glide, time: number): GlideState {
  if (glide.duration <= 0 || time >= glideEnd(glide)) {
    return { position: glide.to, speed: 0 };
  }
  const { from, to, duration } = glide;
  const s = Math.max(0, time - glide.start) / duration;
  // The start speed, as a distance over the whole glide.
  const lead = glide.speed * duration;
  return {
    position:
      (2 * s ** 3 - 3 * s ** 2 + 1) * from +
      (s ** 3 - 2 * s ** 2 + s) * lead +
      (3 * s ** 2 - 2 * s ** 3) * to,
    speed: ((6 * s ** 2 - 6 * s) * (from - to) + (3 * s ** 2 - 4 * s + 1) * lead) / duration,
  };
}

/**
 * Plans a glide to `to` that ends `duration` ms after `time`, picking up from `current` (if any) where it is at `time`,
 * at its speed; or from rest at `position`. A current glide that would end sooner keeps its end: replanning never
 * slows a glide down.
 */
export function glideTo(
  current: Glide | null,
  position: number,
  to: number,
  time: number,
  duration: number,
): Glide {
  const state = current === null ? { position, speed: 0 } : glideAt(current, time);
  const end =
    current === null || glideEnd(current) <= time
      ? time + duration
      : Math.min(glideEnd(current), time + duration);
  return { from: state.position, speed: state.speed, to, start: time, duration: end - time };
}
