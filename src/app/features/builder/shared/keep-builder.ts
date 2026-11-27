import {
  ActivatedRouteSnapshot,
  BaseRouteReuseStrategy,
  destroyDetachedRouteHandle,
  DetachedRouteHandle,
} from '@angular/router';

const isBuilder = (route: ActivatedRouteSnapshot): boolean => route.routeConfig?.path === 'builder';

/**
 * The Builder stays alive while the user looks for an enemy in the Bestiary, so that the build is still there on the way
 * back. Any other page ends it: the next visit starts a new one, as always.
 */
export class KeepBuilder extends BaseRouteReuseStrategy {
  private kept: DetachedRouteHandle | null = null;

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return isBuilder(route);
  }

  /** `null` once the kept page is shown again. */
  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (isBuilder(route)) this.kept = handle;
  }

  /** The router asks this for every page it opens, after the page left is stored. */
  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    if (isBuilder(route)) return !!this.kept;
    if (this.kept && route.routeConfig?.path !== 'bestiary') {
      destroyDetachedRouteHandle(this.kept);
      this.kept = null;
    }
    return false;
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return isBuilder(route) ? this.kept : null;
  }
}
