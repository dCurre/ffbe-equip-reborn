import { Component, computed, inject, signal } from '@angular/core';
import { itemEnhancementBySkillId } from '../../../core/constants/item-enhancement-skills';
import { PageColumn } from '../../layout/page-column/page-column';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { Item } from '../../game/helpers/item';
import { VisionCard } from '../../game/helpers/vision-cards';
import { GAME_DATA_URL } from '../../shared/components/action-link/action-link';
import { Alert } from '../../shared/components/alert/alert';
import { BusyOverlay } from '../../shared/components/busy-overlay/busy-overlay';
import { Button } from '../../shared/components/button/button';
import { Icon } from '../../shared/components/icon/icon';
import { ImportModal } from '../../shared/components/import-modal/import-modal';
import { Panel } from '../../shared/components/panel/panel';
import { showSaveError } from '../../shared/helpers/drive-errors';
import { Inventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { UserData } from '../../shared/services/user-data';
import { ImportState } from '../../shared/state/import-state';
import { EsperBoard, EsperInfo, OwnedEsper } from '../espers/esper-model';
import { ImportedEsper, importEspers, isEsperFile, knownEspers } from '../espers/esper-import';
import { Enchantments, ImportedItem, importInventory, isItemFile } from '../inventory/inventory-model';
import { consumablesFromFile, importUnits, isConsumablesFile, isUnitFile } from '../units/unit-import';
import { GameUnit, TrustItem } from '../units/unit-model';

type Kind = 'units' | 'consumables' | 'inventory' | 'espers';

interface Card {
  kind: Kind;
  heading: string;
  text: string;
  warning: string;
}

const CARDS: Card[] = [
  {
    kind: 'units',
    heading: 'Unit collection',
    text: 'The units you own, with their TMR and STMR, for the pages My units and Unit builder.',
    warning: 'It will override your unit collection on FFBE Equip Reborn',
  },
  {
    kind: 'consumables',
    heading: 'Consumables',
    text: 'The consumables you own (the items used to awaken the units).',
    warning: '',
  },
  {
    kind: 'inventory',
    heading: 'Inventory',
    text: 'The equipment, materia and vision cards you own, for the page My inventory and the "Only owned" builds.',
    warning: 'This feature is a Work in Progress. It will override your inventory on FFBE Equip Reborn',
  },
  {
    kind: 'espers',
    heading: 'Espers',
    text: 'The Espers you own, with their rarity, level and board.',
    warning: 'It will override your Espers on FFBE Equip Reborn',
  },
];

interface ReleasedUnit {
  type: string;
}

/** Imports the data exported from the game (the files of the instructions) in the account of the user. */
@Component({
  selector: 'app-data-import',
  imports: [PageContent, PageColumn, SiteFooter, Panel, Button, Icon, Alert, ImportModal, BusyOverlay],
  templateUrl: './data-import.html',
  styleUrl: './data-import.css',
})
export class DataImport {
  private readonly staticData = inject(StaticData);
  private readonly toast = inject(Toast);
  private readonly userData = inject(UserData);
  private readonly inventory = inject(Inventory);
  private readonly serverContext = inject(ServerContext);

  protected readonly gameDataUrl = GAME_DATA_URL;
  protected readonly cards = CARDS;
  protected readonly importing = new ImportState();
  protected readonly kind = signal<Kind>('units');
  protected readonly busy = signal(false);
  protected readonly loggedIn = computed(() => this.userData.loggedIn());
  /** the account is read: what is imported replaces what the user has */
  protected readonly canImport = computed(() => this.loggedIn() && this.inventory.status() !== 'loading');
  protected readonly warning = computed(() => CARDS.find((card) => card.kind === this.kind())?.warning ?? '');
  protected readonly heading = computed(() => `Import ${CARDS.find((card) => card.kind === this.kind())?.heading.toLowerCase()}`);

  // the game data each import needs, read when it is first used
  private units: Record<string, GameUnit> | null = null;
  private released: GameUnit[] = [];
  private items: TrustItem[] = [];
  private cardList: VisionCard[] = [];
  private enchantments: Enchantments = {};
  private espers: EsperInfo[] = [];
  private boards: Record<string, EsperBoard> = {};

  // what the chosen file would import
  private pendingUnits: ReturnType<typeof importUnits>['owned'] | null = null;
  private pendingConsumables: Record<string, number> | null = null;
  private pendingInventory: ReturnType<typeof importInventory>['inventory'] | null = null;
  private pendingEspers: ImportedEsper[] | null = null;

  protected async open(kind: Kind): Promise<void> {
    this.busy.set(true);
    try {
      await this.loadGameData(kind);
    } catch {
      this.toast.show('Error while loading the game data', 'error');
      return;
    } finally {
      this.busy.set(false);
    }
    this.kind.set(kind);
    this.pendingUnits = this.pendingConsumables = this.pendingInventory = this.pendingEspers = null;
    this.importing.start();
  }

  private async loadGameData(kind: Kind): Promise<void> {
    if (kind === 'units' && !this.units) {
      const [units, released, items] = await Promise.all([
        this.staticData.get<Record<string, GameUnit>>('units', true),
        this.staticData.get<Record<string, ReleasedUnit>>('releasedUnits'),
        this.staticData.get<TrustItem[]>('data', true),
      ]);
      this.released = Object.values(units)
        .filter((unit) => !unit.braveShifted && released[unit.id])
        .map((unit) => ({ ...unit, summon_type: released[unit.id].type }));
      this.units = units;
      this.items = items;
    } else if (kind === 'inventory' && !this.cardList.length) {
      const [data, cards, enchantments] = await Promise.all([
        this.staticData.get<Item[]>('data', true),
        this.staticData.get<Record<string, VisionCard>>('visionCards'),
        this.staticData.get<Enchantments>('itemEnchants'),
      ]);
      this.items = data as unknown as TrustItem[];
      this.cardList = Object.values(cards);
      this.enchantments = enchantments;
    } else if (kind === 'espers' && !this.espers.length) {
      [this.espers, this.boards] = await Promise.all([
        this.staticData.get<EsperInfo[]>('espers'),
        this.staticData.get<Record<string, EsperBoard>>('esperBoards'),
      ]);
    }
  }

  protected loadFile(data: unknown): void {
    const wrong = (): void => this.toast.show("The imported file doesn't have the correct form", 'error');
    switch (this.kind()) {
      case 'units': {
        if (!isUnitFile(data)) return wrong();
        const { owned, messages } = importUnits(data, {
          server: this.serverContext.server(),
          releasedUnits: this.released,
          units: this.units ?? {},
          items: this.items,
        });
        this.pendingUnits = owned;
        this.importing.messages.set(messages);
        this.importing.summary.set(`Units to import : ${Object.keys(owned).length}`);
        break;
      }
      case 'consumables': {
        if (!isConsumablesFile(data)) return wrong();
        this.pendingConsumables = consumablesFromFile(data);
        this.importing.summary.set(`Consumables to import : ${Object.keys(this.pendingConsumables).length}`);
        break;
      }
      case 'inventory': {
        if (!isItemFile(data)) return wrong();
        const { inventory, messages } = importInventory(
          data as ImportedItem[],
          this.items as unknown as Item[],
          this.cardList,
          this.enchantments,
          itemEnhancementBySkillId as unknown as Record<string, string>,
          this.serverContext.server(),
        );
        this.pendingInventory = inventory;
        this.importing.messages.set(messages);
        this.importing.summary.set(`Items to import : ${Object.keys(inventory).length}`);
        break;
      }
      case 'espers': {
        if (!isEsperFile(data)) return wrong();
        this.pendingEspers = data;
        this.importing.summary.set(`Espers to import : ${data.length}`);
        break;
      }
    }
  }

  protected async run(): Promise<void> {
    const kind = this.kind();
    if (kind === 'units' && this.pendingUnits) {
      this.importing.open.set(false);
      await this.inventory.replace('units', this.pendingUnits);
    } else if (kind === 'consumables' && this.pendingConsumables) {
      this.importing.open.set(false);
      await this.inventory.replace('consumables', this.pendingConsumables);
    } else if (kind === 'inventory' && this.pendingInventory) {
      const items = this.inventory.items();
      for (const id of Object.keys(items)) delete items[id];
      Object.assign(items, this.pendingInventory);
      this.importing.open.set(false);
      this.inventory.changed('itemInventory');
      await this.inventory.save();
    } else if (kind === 'espers' && this.pendingEspers) {
      await this.importEspers(this.pendingEspers);
      return;
    } else {
      this.toast.show('Please select a file to import', 'warn');
      return;
    }
    this.toast.show('Data imported');
  }

  private async importEspers(file: ImportedEsper[]): Promise<void> {
    if (knownEspers(file).length === 0) {
      this.toast.show('No known esper found in the file', 'warn');
      return;
    }
    this.importing.open.set(false);
    const owned: Record<string, OwnedEsper> = importEspers(file, this.espers, this.boards);
    try {
      await this.userData.write('espers', owned);
      this.toast.show('Espers imported');
    } catch (error) {
      showSaveError(this.toast, error);
    }
  }
}
