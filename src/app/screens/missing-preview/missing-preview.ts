import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, InjectionToken, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Page } from '../../ui/page';

/** How often a missing preview is checked for, in milliseconds. */
export const PREVIEW_CHECK_INTERVAL = 10_000;

/** Opens another page in place of this one, leaving this one out of the history. */
export const OPEN_PAGE = new InjectionToken<(url: string) => void>('OPEN_PAGE', {
  factory: () => {
    const location = inject(DOCUMENT).location;
    return (url) => {
      location.replace(url);
    };
  },
});

/**
 * Stands in for a pull request's preview that isn't published yet: it checks for it every little while, and opens it
 * as soon as it's there.
 */
@Component({
  selector: 'app-missing-preview',
  imports: [Page],
  template: `
    <app-page heading="Preview">
      @if (missing()) {
        <section class="panel">
          <p>The preview of pull request #{{ pr }} isn't built yet.</p>
          <p>This page opens it as soon as it's ready.</p>
        </section>
      }
    </app-page>
  `,
})
export class MissingPreview {
  protected readonly pr = inject(ActivatedRoute).snapshot.paramMap.get('pr') ?? '';
  /** Whether the preview was checked for and isn't there: shown only then, so that a published one opens directly. */
  protected readonly missing = signal(false);

  private readonly url = new URL(`pr-${this.pr}/`, inject(DOCUMENT).baseURI).href;
  private readonly open = inject(OPEN_PAGE);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.timer);
    });
    void this.check();
  }

  private async check(): Promise<void> {
    const published = await fetch(this.url, { method: 'HEAD', cache: 'no-store' }).then(
      (response) => response.ok,
      () => false,
    );
    if (this.destroyed) {
      return;
    }
    if (published) {
      this.open(this.url);
      return;
    }
    this.missing.set(true);
    this.timer = setTimeout(() => void this.check(), PREVIEW_CHECK_INTERVAL);
  }
}
