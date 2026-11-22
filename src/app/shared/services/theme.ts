import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'theme'; // same key as the old site, so the saved choice carries over

/** Light/dark theme: dark by default, saved in localStorage, applied as the `data-theme` attribute of `<html>`. */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  readonly current = signal<ThemeName>(this.load());
  /** A page that is always shown in one theme (without changing the saved choice). */
  readonly forced = signal<ThemeName | null>(null);

  constructor() {
    effect(() => {
      const theme = this.current();
      this.document.documentElement.dataset['theme'] = this.forced() ?? theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // private window or blocked storage: the choice just lasts for this visit
      }
    });
  }

  private load(): ThemeName {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
}
