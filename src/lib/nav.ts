export interface NavigateOptions {
  replace?: boolean;
}

export function currentPath(): string {
  const raw = String(window.location.hash || '').replace(/^#\/?/, '');
  return raw || 'dashboard';
}

export function navigate(path: string, { replace = false }: NavigateOptions = {}): void {
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

export function refresh(): void {
  window.dispatchEvent(new CustomEvent('app:refresh'));
}

export function onRefresh(handler: EventListener): () => void {
  window.addEventListener('app:refresh', handler);
  return () => window.removeEventListener('app:refresh', handler);
}
