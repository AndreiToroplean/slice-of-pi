import { Component, input } from '@angular/core';
import { DeveloperGesture } from './developer-gesture';

/**
 * What the developer mode gesture shows over the screen: the target to drop the button on, and a message along the
 * way. The message is a live region, so screen readers hear it too.
 */
@Component({
  selector: 'app-developer-overlay',
  host: {
    '[class.shown]': "gesture().phase() === 'dragging' || gesture().phase() === 'celebrating'",
  },
  template: `
    <div
      class="target"
      [class.shown]="gesture().phase() === 'dragging'"
      [class.reached]="gesture().onTarget()"
      [style.left.px]="gesture().target().x"
      [style.top.px]="gesture().target().y"
      [style.width.px]="gesture().target().radius * 2"
      [style.height.px]="gesture().target().radius * 2"
    ></div>
    <p class="message" role="status">{{ gesture().message() }}</p>
  `,
  styleUrl: './developer-overlay.css',
})
export class DeveloperOverlay {
  readonly gesture = input.required<DeveloperGesture>();
}
