// Very small screen switcher.
// go(renderFn, ...args) draws a new screen; rerender() redraws the current one
// (used after a language change). onLeave(fn) registers clean-up, such as
// stopping a timer, that runs when the screen is left.

let current = null;
let cleanup = null;

export function go(renderFn, ...args) {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  current = () => renderFn(...args);
  current();
}

export function rerender() {
  if (current) go(current);
}

export function onLeave(fn) {
  cleanup = fn;
}
