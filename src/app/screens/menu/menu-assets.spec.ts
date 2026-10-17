import { TestBed } from '@angular/core/testing';
import { MenuAssets } from './menu-assets';

describe('MenuAssets', () => {
  function fontsLoading(): { fonts: FontFaceSet; arrive: () => void } {
    let arrive = (): void => undefined;
    const fonts = {} as FontFaceSet;
    Object.assign(fonts, {
      ready: new Promise<FontFaceSet>((resolve) => {
        arrive = () => {
          resolve(fonts);
        };
      }),
    });
    return {
      fonts,
      arrive: () => {
        arrive();
      },
    };
  }

  it('is ready once both the icon and the fonts have arrived, in either order', async () => {
    const assets = TestBed.inject(MenuAssets);
    const { fonts, arrive } = fontsLoading();
    const waited = assets.waitForFonts(fonts);

    assets.iconDone();
    expect(assets.ready()).toBe(false);

    arrive();
    await waited;
    expect(assets.ready()).toBe(true);
  });

  it('waits for the icon after the fonts', async () => {
    const assets = TestBed.inject(MenuAssets);
    const { fonts, arrive } = fontsLoading();
    arrive();

    await assets.waitForFonts(fonts);
    expect(assets.ready()).toBe(false);

    assets.iconDone();
    expect(assets.ready()).toBe(true);
  });
});
