let activeLocks = 0;
let scrollTop = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};
let previousRootOverflow = '';

function rememberBodyStyles() {
  previousBodyStyles = {
    overflow: document.body.style.overflow,
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width
  };
  previousRootOverflow = document.documentElement.style.overflow;
}

function applyLock() {
  scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  rememberBodyStyles();
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollTop}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.documentElement.style.overflow = 'hidden';
}

function releaseLock() {
  document.body.style.overflow = previousBodyStyles.overflow ?? '';
  document.body.style.position = previousBodyStyles.position ?? '';
  document.body.style.top = previousBodyStyles.top ?? '';
  document.body.style.left = previousBodyStyles.left ?? '';
  document.body.style.right = previousBodyStyles.right ?? '';
  document.body.style.width = previousBodyStyles.width ?? '';
  document.documentElement.style.overflow = previousRootOverflow;
  window.scrollTo(0, scrollTop);
}

export function lockBodyScroll(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let released = false;
  if (activeLocks === 0) applyLock();
  activeLocks += 1;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0) releaseLock();
  };
}
