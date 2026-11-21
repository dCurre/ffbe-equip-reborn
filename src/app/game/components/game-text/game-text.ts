import { Component, computed, input } from '@angular/core';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';

interface Piece {
  text?: string;
  name?: string;
  page?: string;
  icon?: string;
}

/**
 * A text of the game data where `[name]`, `[name|icon.png]` and `[page|name|icon.png]` mean a name with its wiki link (and a
 * small picture): `Dual Wield` as `[Dual Wield|ability_72.png]`.
 */
@Component({
  selector: 'app-game-text',
  imports: [WikiLink],
  templateUrl: './game-text.html',
  styleUrl: './game-text.css',
})
export class GameText {
  readonly text = input.required<string>();

  protected readonly pieces = computed<Piece[]>(() =>
    this.text()
      .split(/(\[[^\]]*\])/)
      .filter((part) => part !== '')
      .flatMap((part): Piece[] => {
        if (!part.startsWith('[') || !part.endsWith(']')) return [{ text: part }];
        const token = part.slice(1, -1).split('|');
        if (token.length === 1) return [{ name: token[0] }];
        if (token.length === 2) return [{ name: token[0], icon: token[1] }];
        if (token.length === 3) return [{ page: token[0], name: token[1], icon: token[2] }];
        return [];
      }),
  );

  /** the old site marked a text that starts with a picture as a skill */
  protected readonly isSkill = computed(() => !!this.pieces()[0]?.icon);
}
