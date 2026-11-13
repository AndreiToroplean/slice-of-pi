import { GAME_VALUES } from '../../game-values';
import { isColor, LightSettings, parseLight } from '../menu/menu-look';

/**
 * The Discover Halo: a light behind the keypad, round key 5, as of a power core driving the keys, which shows while the
 * game plays them, on Discover's game turn. Its light is the main menu's kind (see `light-layer.ts`), its lengths in
 * hundredths of the play screen's height.
 */
export interface DiscoverHalo {
  /** As `#rrggbb`. */
  readonly color: string;
  readonly light: LightSettings;
}

/** The game's own Discover Halo. */
export const DISCOVER_HALO: DiscoverHalo = GAME_VALUES.discoverHalo;

/** A Discover Halo read from untrusted data, or `undefined` if it isn't one, each value missing taking the game's. */
export function parseDiscoverHalo(value: unknown): DiscoverHalo | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { color, light } = value as Record<string, unknown>;
  return {
    color: isColor(color) ? color : DISCOVER_HALO.color,
    light: parseLight(DISCOVER_HALO.light, light),
  };
}

/** The halo with one value of its light set. */
export function withHaloLight(
  halo: DiscoverHalo,
  key: keyof LightSettings,
  value: number,
): DiscoverHalo {
  return { ...halo, light: { ...halo.light, [key]: value } };
}
