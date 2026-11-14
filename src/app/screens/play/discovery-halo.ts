import { GAME_VALUES } from '../../game-values';
import { isColor, LightSettings, parseLight } from '../menu/menu-look';

/**
 * The Discovery Halo: a light behind the keypad, round key 5, as of a power core driving the keys, which shows while the
 * game plays them, on Discovery's game turn. Its light is the main menu's kind (see `light-layer.ts`), its lengths in
 * hundredths of the play screen's height.
 */
export interface DiscoveryHalo {
  /** As `#rrggbb`. */
  readonly color: string;
  readonly light: LightSettings;
}

/** The game's own Discovery Halo. */
export const DISCOVERY_HALO: DiscoveryHalo = GAME_VALUES.discoveryHalo;

/** A Discovery Halo read from untrusted data, or `undefined` if it isn't one, each value missing taking the game's. */
export function parseDiscoveryHalo(value: unknown): DiscoveryHalo | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { color, light } = value as Record<string, unknown>;
  return {
    color: isColor(color) ? color : DISCOVERY_HALO.color,
    light: parseLight(DISCOVERY_HALO.light, light),
  };
}

/** The halo with one value of its light set. */
export function withHaloLight(
  halo: DiscoveryHalo,
  key: keyof LightSettings,
  value: number,
): DiscoveryHalo {
  return { ...halo, light: { ...halo.light, [key]: value } };
}
