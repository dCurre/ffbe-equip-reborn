import { inject, Injectable } from '@angular/core';
import { STRINGS } from '../../strings/en';
import { ServerContext } from './server-context';
import { Toast } from './toast';

/** The merged Global and Japan data (`npm run build:merged`). */
const DATA_FOLDER = 'ALL';

/** A download is announced only when it is slow (the old site showed "Downloading ..." after 300 ms). */
const SLOW_AFTER_MS = 300;

/** The game data JSON files (`ALL/data.json`, `ALL/units.json`, ...), loaded with `fetch` and kept in memory per URL. */
@Injectable({ providedIn: 'root' })
export class StaticData {
  private readonly serverContext = inject(ServerContext);
  private readonly toast = inject(Toast);
  private readonly cache = new Map<string, Promise<unknown>>();

  /** `localized` files have a `_fr`, `_de`, ... variant: the language of the page picks it (the old `getLocalizedFileUrl`). */
  get<T>(name: string, localized = false): Promise<T> {
    const { language } = this.serverContext;
    const suffix = localized && language() !== 'en' ? `_${language()}` : '';
    const url = `${DATA_FOLDER}/${name}${suffix}.json`;
    let result = this.cache.get(url) as Promise<T> | undefined;
    if (!result) {
      result = this.download<T>(url);
      this.cache.set(url, result);
    }
    return result;
  }

  private async download<T>(url: string): Promise<T> {
    const timer = setTimeout(() => this.toast.show(`${STRINGS.app.downloading} ${url}`, 'warn'), SLOW_AFTER_MS);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cannot download ${url} (${response.status})`);
      return (await response.json()) as T;
    } catch (error) {
      this.cache.delete(url); // a failed download must be retried, not remembered
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
