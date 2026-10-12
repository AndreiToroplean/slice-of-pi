import { InjectionToken } from '@angular/core';

/** Asks the player to confirm something that can't be undone; resolves to whether they did. */
export const CONFIRM = new InjectionToken<(question: string) => boolean>('CONFIRM', {
  factory: () => (question) => confirm(question),
});
