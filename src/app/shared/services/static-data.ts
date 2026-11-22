import { inject, Injectable, signal } from '@angular/core';
import { ServerContext } from './server-context';

/** A download is announced only when it is slow (the old site showed "Downloading ..." after 300 ms). */
const SLOW_AFTER_MS = 300;

/** The game data JSON files (`GL/data.json`, `JP/units.json`, ...), loaded with `fetch` and kept in memory per URL. */
@Injectable({ providedIn: 'root' })
export class StaticData {
  private readonly serverContext = inject(ServerContext);
  private readonly cache = new Map<string, Promise<unknown>>();

  /** URLs of the downloads that are slow right now, for a "Downloading ..." notice. */
  readonly slowDownloads = signal<readonly string[]>([]);

  /** `localized` files have a `_fr`, `_de`, ... variant: the language of the page picks it (the old `getLocalizedFileUrl`). */
  get<T>(name: string, localized = false): Promise<T> {
    const { server, language } = this.serverContext;
    const suffix = localized && language() !== 'en' ? `_${language()}` : '';
    const url = `${server()}/${name}${suffix}.json`;
    let result = this.cache.get(url) as Promise<T> | undefined;
    if (!result) {
      result = this.download<T>(url);
      this.cache.set(url, result);
    }
    return result;
  }

  private async download<T>(url: string): Promise<T> {
    const timer = setTimeout(() => this.slowDownloads.update((list) => [...list, url]), SLOW_AFTER_MS);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cannot download ${url} (${response.status})`);
      return (await response.json()) as T;
    } catch (error) {
      this.cache.delete(url); // a failed download must be retried, not remembered
      throw error;
    } finally {
      clearTimeout(timer);
      this.slowDownloads.update((list) => list.filter((u) => u !== url));
    }
  }
}
