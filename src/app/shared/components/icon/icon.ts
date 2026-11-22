import { Component, computed, ElementRef, inject, input, isDevMode, OnChanges } from '@angular/core';
import { Sprites } from '../../services/sprites';
import { IconId, iconInfo, SPRITE_SHEETS, SvgName } from './icon-map';

export type { IconId, ImageName, SpriteName, SvgName } from './icon-map';
/** The names of the drawings. */
export type IconName = SvgName;

/** A length of the template: `40` or `"40"` (an attribute is a string) is in pixels, `"2em"` stays as it is. */
const toCss = (length: number | string | undefined): string | null =>
  length === undefined ? null : /^\d+(\.\d+)?$/.test(String(length)) ? `${length}px` : String(length);

/** Loads the sheet of a sprite; an id that is not in the table is reported while developing (ids may be built from data). */
function useSprite(sprites: Sprites, id: string, known: boolean): void {
  const sheet = SPRITE_SHEETS[id.split('-')[0] as keyof typeof SPRITE_SHEETS];
  if (known && sheet) sprites.load(sheet);
  else if (isDevMode()) console.warn(`The icon "${id}" is not a sprite of ICONS (shared/components/icon/icon-map.ts)`);
}

/**
 * An icon of the table `ICONS` by its id, whatever its kind: a drawing, a sprite or a fixed picture.
 * The host carries the tooltip (`title` of the table, `title` of this element to say something else) and `data-icon`.
 * The id may be built from data (`'equipment-' + type`): an id that is not in the table draws nothing.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.css',
  host: {
    '[attr.data-icon]': 'name()',
    '[attr.data-kind]': 'info()?.kind',
    '[attr.title]': 'title() ?? null',
    '(mouseenter)': 'describe()',
  },
})
export class Icon implements OnChanges {
  readonly name = input.required<IconId | (string & {})>();
  /** what the icon means here: it replaces the description of the table */
  readonly title = input<string>();
  /** the size of a sprite or a picture (a number is in pixels): `size` for both sides, `width` / `height` for one (the other follows the picture) */
  readonly size = input<number | string>();
  readonly width = input<number | string>();
  readonly height = input<number | string>();
  private readonly sprites = inject(Sprites);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private described = false;
  protected readonly info = computed(() => iconInfo(this.name()));
  protected readonly cssWidth = computed(() => toCss(this.width() ?? this.size()));
  protected readonly cssHeight = computed(() => toCss(this.height() ?? this.size()));

  ngOnChanges(): void {
    const info = this.info();
    if (info?.kind === 'sprite') useSprite(this.sprites, this.name(), true);
    else if (!info) useSprite(this.sprites, this.name(), false);
    if (this.described) {
      this.host.removeAttribute('title'); // the description of the old name
      this.described = false;
    }
  }

  /**
   * The description of the table becomes the tooltip when the pointer reaches the icon, and only if no element around it has
   * a tooltip of its own (a button with a function, a tab, ...): that one wins. Done here and not when the page is drawn,
   * because a page has thousands of icons.
   */
  protected describe(): void {
    const text = this.info()?.title;
    if (!text || this.host.hasAttribute('title') || this.host.parentElement?.closest('[title]')) return;
    this.host.setAttribute('title', text);
    this.described = true;
  }
}
