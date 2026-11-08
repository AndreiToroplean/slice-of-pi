/**
 * How many slots a group starts with where the game doesn't know the player's groups yet: everywhere for a new player,
 * and past where their runs can be trusted. A setting: groups of 5 are a common way to learn π. The group still grows
 * a slot with each digit typed past them until the player pauses, so it never forces a size on them.
 */
export const DEFAULT_GROUP_SIZE = 5;
/** The smallest and largest group sizes the player can pick: a group of 1 or 2 is hardly a group. */
export const GROUP_SIZES = { min: 3, max: 10 } as const;

/** Whether a value is a group size the player can pick. */
export function isGroupSize(value: unknown): value is number {
  return (
    Number.isInteger(value) && Number(value) >= GROUP_SIZES.min && Number(value) <= GROUP_SIZES.max
  );
}
