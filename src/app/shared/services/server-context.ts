import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

export type GameServer = 'GL' | 'JP';

export const SERVERS: readonly GameServer[] = ['GL', 'JP'];
export const LANGUAGES = ['en', 'zh', 'ko', 'fr', 'de', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The game server (`?server=JP`) and the language (`?l=fr`, GL only) of the page, kept in the URL like the old site did. */
@Injectable({ providedIn: 'root' })
export class ServerContext {
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);

  readonly server = computed<GameServer>(() => (this.params()?.get('server') === 'JP' ? 'JP' : 'GL'));
  readonly language = computed<Language>(() => {
    const l = this.params()?.get('l') as Language | null;
    return this.server() === 'GL' && l && LANGUAGES.includes(l) ? l : 'en';
  });

  /** Query params every internal link must carry (null drops the param): the old `updateLinks`. */
  readonly linkParams = computed(() => ({
    server: this.server() === 'JP' ? 'JP' : null,
    l: this.language() === 'en' ? null : this.language(),
  }));

  /** A new server or language reloads the page, as on the old site: the user data and the game data are read again. */
  setServer(server: GameServer): void {
    this.reloadWith({ server: server === 'JP' ? 'JP' : null, l: null });
  }

  setLanguage(language: Language): void {
    if (this.server() === 'JP') return;
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
