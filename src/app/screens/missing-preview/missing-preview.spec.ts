import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MissingPreview, OPEN_PAGE, PREVIEW_CHECK_INTERVAL } from './missing-preview';
import { missingPreview } from './missing-preview-path';

describe('MissingPreview', () => {
  let published: boolean;
  let fetch: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    published = false;
    fetch = vi.fn(() => Promise.resolve(new Response(null, { status: published ? 200 : 404 })));
    vi.stubGlobal('fetch', fetch);
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { matcher: missingPreview, component: MissingPreview },
          { path: '**', redirectTo: '' },
        ]),
        { provide: OPEN_PAGE, useValue: open },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function visit(url: string): Promise<HTMLElement | null> {
    const harness = await RouterTestingHarness.create(url);
    await vi.advanceTimersByTimeAsync(0);
    harness.detectChanges();
    return harness.routeNativeElement;
  }

  function previewUrl(pr: number): string {
    return new URL(`pr-${String(pr)}/`, document.baseURI).href;
  }

  it('says that a preview that is not published yet is not built yet', async () => {
    const host = await visit('/pr-42');

    expect(host?.textContent).toContain("The preview of pull request #42 isn't built yet.");
    expect(TestBed.inject(Router).url).toBe('/pr-42');
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the preview as soon as it is published', async () => {
    await visit('/pr-42');
    await vi.advanceTimersByTimeAsync(PREVIEW_CHECK_INTERVAL);
    expect(open).not.toHaveBeenCalled();

    published = true;
    await vi.advanceTimersByTimeAsync(PREVIEW_CHECK_INTERVAL);

    expect(open).toHaveBeenCalledExactlyOnceWith(previewUrl(42));
    expect(fetch).toHaveBeenLastCalledWith(previewUrl(42), { method: 'HEAD', cache: 'no-store' });
  });

  it('opens a published preview right away, without saying it is not built', async () => {
    published = true;
    const host = await visit('/pr-7/play');

    expect(open).toHaveBeenCalledExactlyOnceWith(previewUrl(7));
    expect(host?.textContent).not.toContain('built');
  });

  it('keeps checking when the network fails', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const host = await visit('/pr-42');
    expect(host?.textContent).toContain("isn't built yet");

    published = true;
    await vi.advanceTimersByTimeAsync(PREVIEW_CHECK_INTERVAL);

    expect(open).toHaveBeenCalledExactlyOnceWith(previewUrl(42));
  });

  it('stops checking once left', async () => {
    await visit('/pr-42');
    await TestBed.inject(Router).navigateByUrl('/');
    const checks = fetch.mock.calls.length;

    published = true;
    await vi.advanceTimersByTimeAsync(PREVIEW_CHECK_INTERVAL * 3);

    expect(fetch).toHaveBeenCalledTimes(checks);
    expect(open).not.toHaveBeenCalled();
  });

  it.for(['/pr-0', '/pr-', '/pr-4x', '/xpr-4'])('leaves %s to the main menu', async (url) => {
    await visit(url);

    expect(TestBed.inject(Router).url).toBe('/');
    expect(fetch).not.toHaveBeenCalled();
  });
});
