/** Defer full UI rebuild while the user is typing in a plan table field. */

let paused = false;
let queued = false;
let flushHandler = null;

export function setRenderFlushHandler(fn) {
  flushHandler = fn;
}

export function pauseShellRender() {
  paused = true;
}

/** @param {boolean} [force] Run a queued or forced shell rebuild (e.g. after blur). */
export function resumeShellRender(force = false) {
  paused = false;
  if ((queued || force) && flushHandler) {
    queued = false;
    flushHandler();
  }
}

export function shouldDeferShellRender() {
  if (paused) {
    queued = true;
    return true;
  }
  return false;
}

export function isShellRenderPaused() {
  return paused;
}
