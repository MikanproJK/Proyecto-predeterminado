/* Estado de la ruta activa y lectura del hash */

import { currentPath } from './nav.js';
import { ROUTES } from './routes.js';
import type { RouteName } from '../types.js';

export interface CurrentRoute {
  name: RouteName;
  id: string | null;
}

let routeName: RouteName = 'dashboard';
let routeId: string | null = null;

export function currentRoute(): CurrentRoute {
  return { name: routeName, id: routeId };
}

export function currentRouteName(): RouteName {
  return routeName;
}

export function currentRouteId(): string | null {
  return routeId;
}

/** Lee el hash actual y actualiza la ruta activa. */
export function parseRoute(): { previous: CurrentRoute; changed: boolean } {
  const previous = currentRoute();
  const [rawRoute, ...rest] = currentPath().split('/');
  const name = rawRoute || 'dashboard';
  routeName = (ROUTES[name] ? name : 'dashboard') as RouteName;
  routeId = rest.length ? decodeURIComponent(rest.join('/')) : null;
  return {
    previous,
    changed: previous.name !== routeName || previous.id !== routeId,
  };
}
