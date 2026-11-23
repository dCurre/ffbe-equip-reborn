import { Component, computed, input } from '@angular/core';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { Item } from '../../helpers/item';
import { itemEffects } from '../../helpers/item-effects';
import { GameText } from '../game-text/game-text';
import { KillerList } from '../killer-list/killer-list';
import { ResistList } from '../resist-list/resist-list';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

/** The special effects of an item as a list: elements, resists, killers, skills, masteries... (an empty cell without any). */
@Component({
  selector: 'app-item-special',
  imports: [GameText, KillerList, ResistList, WikiLink, Icon],
  host: { class: 'td special', '[class.empty]': '!effects().length' },
  templateUrl: './item-special.html',
  styleUrl: './item-special.css',
})
export class ItemSpecial {
  protected readonly t = STRINGS.itemSpecial;
  readonly item = input.required<Item>();

  protected readonly effects = computed(() => itemEffects(this.item()));
}
