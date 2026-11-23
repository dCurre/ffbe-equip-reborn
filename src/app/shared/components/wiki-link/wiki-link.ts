import { Component, input } from '@angular/core';
import { wikiUrl } from '../../helpers/wiki';
import { Icon } from '../icon/icon';
import { STRINGS } from '../../../strings/en';

/** A name followed by the link to its wiki page (the old `toLink`):  */
@Component({
  selector: 'app-wiki-link',
  imports: [Icon],
  templateUrl: './wiki-link.html',
  styleUrl: './wiki-link.css',
})
export class WikiLink {
  protected readonly t = STRINGS.wikiLink;
  readonly name = input.required<string>();
  /** The wiki page when it is not the name. */
  readonly page = input<string>();

  protected url(): string {
    return wikiUrl(this.page() ?? this.name());
  }
}
