import { Component, inject, input } from '@angular/core';
import { ServerContext } from '../../services/server-context';
import { wikiUrl } from '../../helpers/wiki';
import { Icon } from '../icon/icon';

/** A name followed by the link to its wiki page (the old `toLink`): on the JP server only when `always` is set. */
@Component({
  selector: 'app-wiki-link',
  imports: [Icon],
  templateUrl: './wiki-link.html',
  styleUrl: './wiki-link.css',
})
export class WikiLink {
  protected readonly server = inject(ServerContext);
  readonly name = input.required<string>();
  /** The wiki page when it is not the name. */
  readonly page = input<string>();
  readonly always = input(false);

  protected url(): string {
    return wikiUrl(this.page() ?? this.name(), this.server.server());
  }
}
