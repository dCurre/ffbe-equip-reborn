import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

/** The Global and Japan data are one set now (`ALL`); the data the users saved keeps the `GL` name (`inventory_GL.json`). */
export type GameServer = 'GL';

export const LANGUAGES = ['en', 'zh', 'ko', 'fr', 'de', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The language (`?l=fr`) of the page, kept in the URL like the old site did. An old `?server=JP` is ignored. */
@Injectable({ providedIn: 'root' })
export class ServerContext {
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);

  readonly server = computed<GameServer>(() => 'GL');
  readonly language = computed<Language>(() => {
    const l = this.params()?.get('l') as Language | null;
    return l && LANGUAGES.includes(l) ? l : 'en';
  });

  /** Query params every internal link must carry (null drops the param): the old `updateLinks`. */
  readonly linkParams = computed(() => ({ l: this.language() === 'en' ? null : this.language() }));

  /** A new language reloads the page, as on the old site: the user data and the game data are read again. */
  setLanguage(language: Language): void {
    this.reloadWith({ l: language === 'en' ? null : language });
  }

  private reloadWith(changes: Record<string, string | null>): void {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(changes)) {
      if (value === null) url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    }
    this.navigate(url);
  }

  /** Apart so that a test can watch it. */
  protected navigate(url: URL): void {
    window.location.assign(url);
  }
}
