import { Component, computed, HostListener, inject, signal, viewChild } from '@angular/core';
import { ShareLinkState } from '../../shared/state/share-link-state';
import { ActivatedRoute } from '@angular/router';
import { baseStats } from '../../../core/constants/base-lists';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { showLoadError, showSaveError } from '../../shared/helpers/drive-errors';
import { PageChrome } from '../../shared/services/page-chrome';
import { ServerContext } from '../../shared/services/server-context';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { UserData } from '../../shared/services/user-data';
import { Button } from '../../shared/components/button/button';
import { Icon } from '../../shared/components/icon/icon';
import { BusyOverlay } from '../../shared/components/busy-overlay/busy-overlay';
import { LoadStatus } from '../../shared/components/load-status/load-status';
import { ShareLinkModal } from '../../shared/components/share-link-modal/share-link-modal';
import {
  applySelectedNodes,
  calculateSp,
  changeRarity,
  decodeEsperLink,
  encodeEsperLink,
  EsperBoard,
  EsperInfo,
  LEVEL_RANGE,
  clampLevel,
  newEsper,
  OwnedEsper,
  Stat,
  statBonus,
  updateStats,
} from './esper-model';
import { EsperGrid } from './esper-grid/esper-grid';
import { EsperHeader } from './esper-header/esper-header';
import { EsperTable, type Column } from './esper-table/esper-table';
import { EsperTabs } from './esper-tabs/esper-tabs';
import { STRINGS } from '../../strings/en';

const SAVE_DELAY_MS = 3000;
const STATS = baseStats as Stat[];

/**
 * The Esper page: the table of the owned Espers and, for each Esper, its rarity, level and training board. Opened from a
 * shared link (`#...`) it shows that one Esper only.
 */
@Component({
  selector: 'app-espers',
  imports: [
    EsperTabs,
    EsperTable,
    EsperHeader,
    EsperGrid,
    PageContent,
    SiteFooter,
    Button,
    Icon,
    LoadStatus,
    BusyOverlay,
    ShareLinkModal,
  ],
  templateUrl: './espers.html',
  styleUrl: './espers.css',
})
export class Espers {
  protected readonly t = STRINGS.espers;
  private readonly route = inject(ActivatedRoute);
  private readonly staticData = inject(StaticData);
  private readonly userData = inject(UserData);
  private readonly serverContext = inject(ServerContext);
  private readonly toast = inject(Toast);
  private readonly chrome = inject(PageChrome);

  protected readonly espers = signal<EsperInfo[]>([]);
  private boards: Record<string, EsperBoard> = {};
  private readonly ownedMap = signal<Record<string, OwnedEsper>>({});
  protected readonly ready = signal(false);
  protected readonly linkMode = signal(false);
  protected readonly logged = signal(false);
  /** The current tab: `ALL` or the name of an Esper. */
  protected readonly tab = signal('ALL');
  protected readonly sort = signal<{ column: Column; descending: boolean }>({ column: 'index', descending: false });
  protected readonly gridView = signal(false);
  protected readonly spFixedVisible = signal(false);
  protected readonly busy = signal(false);
  protected readonly share = new ShareLinkState();

  protected readonly columns: { column: Column; label: string }[] = [
    { column: 'index', label: STRINGS.espers.esper },
    { column: 'level', label: STRINGS.espers.level },
    ...STATS.map((stat) => ({ column: stat, label: stat.toUpperCase() })),
    { column: 'resists', label: STRINGS.espers.resists },
    { column: 'killers', label: STRINGS.espers.killers },
  ];

  private saveNeeded = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly header = viewChild(EsperHeader);
  private readonly board = viewChild(EsperGrid);

  /** The owned Espers, as a signal that changes after each edit (the Esper objects are edited in place). */
  protected readonly owned = this.ownedMap.asReadonly();
  protected readonly ownedCount = computed(() => Object.keys(this.owned()).length);
  protected readonly currentInfo = computed(() => this.espers().find((e) => e.name === this.tab()));
  protected readonly current = computed(() => this.owned()[this.tab()]);
  protected readonly currentBoard = computed(() => this.boards[this.tab()]);

  protected readonly sp = computed(() => {
    const esper = this.current();
    return esper ? calculateSp(this.boards[esper.name], esper) : null;
  });

  /** The table rows in the chosen order. */
  protected readonly rows = computed(() => {
    const owned = this.owned();
    const { column, descending } = this.sort();
    const rows = this.espers()
      .map((info, index) => ({ info, index, esper: owned[info.name] }))
      .filter((row) => row.esper)
      .map((row) => ({ ...row, sp: calculateSp(this.boards[row.info.name], row.esper) }));
    const value = (row: (typeof rows)[number]): number => {
      switch (column) {
        case 'index':
          return row.index;
        case 'level':
          return row.esper.level;
        case 'resists':
          return row.esper.resist?.length ?? 0;
        case 'killers':
          return row.esper.killers?.length ?? 0;
        default:
          return statBonus(row.esper, column);
      }
    };
    return rows.sort((a, b) => (descending ? value(b) - value(a) : value(a) - value(b)));
  });

  constructor() {
    this.start();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnUnsaved(event: BeforeUnloadEvent): void {
    if (this.saveNeeded) event.preventDefault();
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    const sp = this.header()?.spLabel()?.nativeElement;
    this.spFixedVisible.set(!!sp && window.scrollY > sp.getBoundingClientRect().top + window.scrollY);
  }

  // --- Loading ---

  private async start(): Promise<void> {
    const snapshot = this.route.snapshot;
    const fragment = snapshot.fragment ?? '';
    const linkMode = fragment.length > 0;
    const withoutAccount = snapshot.queryParamMap.has('o');
    this.linkMode.set(linkMode);
    this.chrome.headerHidden.set(linkMode);

    const [espers, boards] = await Promise.all([
      this.staticData.get<EsperInfo[]>('espers'),
      this.staticData.get<Record<string, EsperBoard>>('esperBoards'),
    ]);
    this.espers.set(espers);
    this.boards = boards;

    let owned: Record<string, OwnedEsper> = {};
    if (!withoutAccount && this.userData.loggedIn()) {
      try {
        owned = await this.userData.read<Record<string, OwnedEsper>>('espers');
        this.logged.set(true);
        for (const esper of Object.values(owned)) {
          // old saves kept the ST Reflection Boost without the `all` level
          if (esper.esperStatsBonus && !esper.esperStatsBonus.all) {
            esper.esperStatsBonus = { all: esper.esperStatsBonus as never };
          }
          updateStats(boards[esper.name], esper);
        }
      } catch (error) {
        showLoadError(this.toast, error);
      }
    }
    if (linkMode) owned = this.loadLink(fragment);
    else if (!this.logged()) owned = this.demoEspers();

    this.ownedMap.set(owned);
    this.tab.set(linkMode ? (Object.keys(owned)[0] ?? 'ALL') : 'ALL');
    this.ready.set(true);
  }

  /** Without a Google login the page shows every Esper at its best, to look around (nothing is saved). */
  private demoEspers(): Record<string, OwnedEsper> {
    return Object.fromEntries(
      this.espers().map((info) => [info.name, newEsper(info, info.maxLevel, this.boards[info.name])]),
    );
  }

  /** `#Name|rarity|level|board`, `#<base64 of the owned Espers>` (older links) or `#Name` (a new Esper). */
  private loadLink(fragment: string): Record<string, OwnedEsper> {
    let owned: Record<string, OwnedEsper> | null = null;
    if (decodeURI(fragment).includes('|')) {
      const esper = decodeEsperLink(fragment, this.espers());
      if (esper) owned = { [esper.name]: esper };
    } else {
      try {
        owned = JSON.parse(atob(fragment)) as Record<string, OwnedEsper>;
      } catch {
        const info = this.espers().find((e) => e.id.toUpperCase() === fragment.replace('_', ' ').toUpperCase());
        if (info) owned = { [info.name]: newEsper(info, info.maxLevel, this.boards[info.name]) };
      }
    }
    if (!owned) return {};
    for (const esper of Object.values(owned)) {
      const board = this.boards[esper.name];
      if (!board) continue;
      esper.resist = structuredClone(board.resist[esper.rarity]);
      applySelectedNodes(board, esper);
      updateStats(board, esper);
    }
    return owned;
  }

  // --- Actions ---

  protected sortBy(column: Column): void {
    this.sort.update((s) => ({ column, descending: s.column === column ? !s.descending : column !== 'index' }));
  }

  protected showTab(name: string): void {
    window.scrollTo(0, 0);
    this.board()?.close();
    this.tab.set(name);
  }

  protected setRarity(value: string): void {
    const name = this.tab();
    if (value === 'notOwned') {
      this.ownedMap.update(({ [name]: _removed, ...rest }) => rest);
    } else {
      const rarity = parseInt(value);
      const previous = this.owned()[name];
      const esper = previous
        ? changeRarity(this.boards[name], previous, rarity)
        : newEsper(this.currentInfo()!, rarity, this.boards[name]);
      this.ownedMap.update((owned) => ({ ...owned, [name]: esper }));
    }
    this.markChanged();
  }

  /**
   * Keeps the level inside the range of the rarity. The maximum applies while typing; the minimum only when the field is
   * left (`change`), because the first digits of a valid level (the "3" of 35) can be below it. An empty field is left alone.
   */
  protected onLevelInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const esper = this.current();
    const typed = parseInt(input.value);
    if (!esper || Number.isNaN(typed)) return;
    const level = Math.min(typed, LEVEL_RANGE[esper.rarity].max);
    if (event.type === 'input' && level < LEVEL_RANGE[esper.rarity].min) return;
    esper.level = clampLevel(level, esper.rarity);
    input.value = String(esper.level);
    updateStats(this.boards[esper.name], esper);
    this.touch();
  }

  protected openShare(): void {
    const data = encodeEsperLink(this.current());
    const url = new URL('espers', document.baseURI);
    url.search = `?server=${this.serverContext.server()}&o`;
    this.share.show(`${url.href}#${data}`);
  }

  // --- Saving ---

  /** The Esper objects were edited in place: tell the signals, and save later. */
  private touch(): void {
    // the edited Esper is copied (deeply, with its killers and resists): signals compare by reference, so the views would not redraw
    const name = this.tab();
    this.ownedMap.update((owned) => ({ ...owned, ...(owned[name] && { [name]: structuredClone(owned[name]) }) }));
    this.markChanged();
  }

  private markChanged(): void {
    if (this.linkMode() || !this.logged()) return;
    this.saveNeeded = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  private async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (
      this.ownedCount() === 0 &&
      !confirm("You're trying to save empty espers. Are you sure you want to erase your espers ?")
    ) {
      return;
    }
    this.saveNeeded = false;
    try {
      await this.userData.write('espers', this.owned());
      this.toast.show(STRINGS.espers.dataSaved);
    } catch (error) {
      this.saveNeeded = showSaveError(this.toast, error);
    }
  }
}
