import { OverlayContainer } from '@angular/cdk/overlay';
import { Directive, ElementRef, inject, Service } from '@angular/core';

/**
 * Where the CDK puts the menus opened within the element providing it (`OverlayHost`), rather than at the end of the
 * page: within the app, for them to take its look, and within a modal dialog, outside of which they couldn't be used.
 */
@Service({ autoProvided: false })
class HostOverlayContainer extends OverlayContainer {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected override _createContainer(): void {
    super._createContainer();
    const container = this._containerElement;
    if (container !== undefined) {
      this.host.append(container);
    }
  }
}

/** Keeps the menus opened within the element it's on in it (see `HostOverlayContainer`). */
@Directive({
  selector: '[appOverlayHost]',
  providers: [{ provide: OverlayContainer, useClass: HostOverlayContainer }],
})
export class OverlayHost {}
