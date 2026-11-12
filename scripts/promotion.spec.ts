import { promoted } from './promotion';

describe('promoted', () => {
  const game = {
    kind: 'slice-of-pi-backup',
    format: 1,
    settings: {
      tweaks: {
        format: 4,
        breath: 3,
        keyLinger: 500,
        layout: { keypad: { keyDepth: 1, reach: 4 } },
      },
    },
  };

  it('takes the values a backup tuned, keeping the others, and leaves out what is not a game value', () => {
    const backup = {
      kind: 'slice-of-pi-backup',
      format: 1,
      exportedAt: 1,
      runs: [{}],
      settings: {
        sound: { enabled: true },
        tweaks: {
          format: 4,
          breath: 5,
          layout: { keypad: { keyDepth: 1.7 } },
          runOrder: { ids: [] },
        },
      },
    };
    expect(promoted(game, backup)).toEqual({
      kind: 'slice-of-pi-backup',
      format: 1,
      settings: {
        tweaks: {
          format: 4,
          breath: 5,
          keyLinger: 500,
          layout: { keypad: { keyDepth: 1.7, reach: 4 } },
        },
      },
    });
  });

  it('refuses tweaks in another format', () => {
    expect(() => promoted(game, { settings: { tweaks: { format: 3, breath: 5 } } })).toThrow(
      /format 3/,
    );
  });
});
