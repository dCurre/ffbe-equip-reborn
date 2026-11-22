import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/** The sprite sheets of `public/css-img/` (`i.img.img-<sheet>-<name>`), loaded as a stylesheet the first time a page needs them. */
export type SpriteSheet =
  'espers' | 'elements' | 'ailments' | 'killers' | 'equipments' | 'crystals' | 'tabs' | 'sorts' | 'access' | 'stats' | 'slots'
  | 'tankAbilities' | 'mitigationAbilities' | 'racialMitigationAbilities';

@Injectable({ providedIn: 'root' })
export class Sprites {
  private readonly document = inject(DOCUMENT);
  private readonly loaded = new Set<SpriteSheet>();

  load(...sheets: SpriteSheet[]): void {
    for (const sheet of sheets) {
      if (this.loaded.has(sheet)) continue;
      this.loaded.add(sheet);
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `css-img/${sheet}.css`; // relative: the site lives under a sub-path
      this.document.head.appendChild(link);
    }
  }
}
