/** The legacy key codes of the keys pressed, which the CDK's key managers read. */
const KEY_CODES: Readonly<Record<string, number>> = {
  Tab: 9,
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
};

/** Presses a key on an element, what has the focus by default, as a browser tells it. */
export function pressKey(key: string, on: Element | null = document.activeElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { value: KEY_CODES[key] ?? 0 });
  on?.dispatchEvent(event);
  return event;
}
