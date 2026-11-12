/** Whether a value read from JSON is an object, not an array. */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `values` with those of `tuned` over them, objects merged key by key, so that what `tuned` leaves out stays as it was,
 * and what `values` has no key for is left out: what isn't one of the game's values, such as a backup's runs.
 */
export function over(values: unknown, tuned: unknown): unknown {
  if (!isObject(values) || !isObject(tuned)) {
    return tuned ?? values;
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, over(value, tuned[key])]),
  );
}

/**
 * The game's values (as `src/app/game-values.json` holds them) with those tuned in a backup over them. A backup's
 * tweaks hold only the values tuned, so the others stay the game's.
 */
export function promoted(gameValues: unknown, backup: unknown): unknown {
  const tweaks =
    isObject(backup) && isObject(backup['settings']) ? backup['settings']['tweaks'] : undefined;
  const format = (values: unknown): unknown => (isObject(values) ? values['format'] : undefined);
  const ownFormat =
    isObject(gameValues) && isObject(gameValues['settings'])
      ? format(gameValues['settings']['tweaks'])
      : undefined;
  if (format(tweaks) !== ownFormat) {
    throw new Error(
      `The backup's tweaks are in format ${String(format(tweaks))}, the game's values in ${String(ownFormat)}: load the backup in the game, which brings it to the current format, and back it up again.`,
    );
  }
  return over(gameValues, { settings: { tweaks } });
}
