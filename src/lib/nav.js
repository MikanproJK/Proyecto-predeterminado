export function currentPath() {
  const raw = String(window.location.hash || '').replace(/^#\/?/, '');
  return raw || 'dashboard';
}

export function navigate(path, { replace = false } = {}) {
  const clean = String(path || '').replace(/^#?\/?/, '');
  const target = `#/${clean}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new CustomEvent('app:refresh'));
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new CustomEvent('app:refresh'));
  } else {
    window.location.hash = target;
  }
}

export function refresh() {
  window.dispatchEvent(new CustomEvent('app:refresh'));
}

export function onRefresh(handler) {
  window.addEventListener('app:refresh', handler);
  return () => window.removeEventListener('app:refresh', handler);
}
