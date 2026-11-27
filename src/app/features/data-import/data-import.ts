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
import { FileDrop } from '../../shared/components/file-drop/file-drop';
import { Icon } from '../../shared/components/icon/icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { Panel } from '../../shared/components/panel/panel';
import { showSaveError } from '../../shared/helpers/drive-errors';
import { Inventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { UserData } from '../../shared/services/user-data';
import { EsperBoard, EsperInfo } from '../espers/esper-model';
import { ImportedEsper, importEspers, knownEspers } from '../espers/esper-import';
import { Enchantments, ImportedItem, importInventory } from '../inventory/inventory-model';
import { consumablesFromFile, ImportedUnit, importUnits } from '../units/unit-import';
import { GameUnit, TrustItem } from '../units/unit-model';
import { detectImportKind, ImportKind } from './import-kind';
import {
  clearedFromSave,
  consumablesFromSaveFile,
  espersFromSave,
  GameSave,
  itemsFromSave,
  unitsFromSave,
} from './save-import';
import { STRINGS } from '../../strings/en';

interface KindInfo {
  heading: string;
  text: string;
  /** what the user is told before the file replaces the data */
  warning: string;
}

interface RecapLine {
  label: string;
  found: number;
  /** not known by the site (yet): left out of the import */
  ignored: number;
  /** where of the file it comes from (a full save only) */
  source?: string;
}

const KINDS: Record<ImportKind, KindInfo> = {
  units: {
    heading: STRINGS.dataImport.unitCollection,
    text: STRINGS.dataImport.theUnitsYouOwn,
    warning: 'It will override your unit collection on FFBE Equip Reborn',
  },
  consumables: {
    heading: STRINGS.dataImport.consumables,
    text: STRINGS.dataImport.theConsumablesYouOwn,
    warning: 'It will override your consumables on FFBE Equip Reborn',
  },
  inventory: {
    heading: STRINGS.dataImport.inventory,
    text: STRINGS.dataImport.theEquipmentMateriaAnd,
    warning: 'This feature is a Work in Progress. It will override your inventory on FFBE Equip Reborn',
  },
  save: {
    heading: STRINGS.dataImport.fullSave,
    text: STRINGS.dataImport.saveOfFfbeOffline,
    warning:
      'It will override your unit collection, consumables, inventory, Espers and completed stages (if the save has any) on FFBE Equip Reborn',
  },
  espers: {
    heading: STRINGS.dataImport.espers,
    text: STRINGS.dataImport.theEspersYouOwn,
    warning: 'It will override your Espers on FFBE Equip Reborn',
  },
};

interface ReleasedUnit {
  type: string;
}

/** Imports the data exported from the game (the files of the instructions) in the account of the user. */
@Component({
  selector: 'app-data-import',
  imports: [PageContent, PageColumn, SiteFooter, Panel, Button, Alert, FileDrop, BusyOverlay, Icon, ProgressBar],
  templateUrl: './data-import.html',
  styleUrl: './data-import.css',
})
export class DataImport {
  protected readonly t = STRINGS.dataImport;
  private readonly staticData = inject(StaticData);
  private readonly toast = inject(Toast);
  private readonly userData = inject(UserData);
  private readonly inventory = inject(Inventory);
  private readonly serverContext = inject(ServerContext);

  protected readonly gameDataUrl = GAME_DATA_URL;
  protected readonly offlineUrl = 'https://github.com/Elvlin/exvius-offline';
  protected readonly kindNames = 'full save, unit collection, consumables, inventory and Espers';
  /** what the file would import: how many of each section the site knows, and how many it ignores */
  protected readonly recap = signal<RecapLine[]>([]);
  /** while the import writes the account: how far it is, and what it is saving */
  /** the import is finished: the recap stays on screen with a confirmation until the user closes it */
  protected readonly done = signal(false);
  protected readonly progress = signal<{ percent: number; text: string } | null>(null);
  /** what the chosen file holds, once it is known */
  protected readonly kind = signal<ImportKind | null>(null);
  protected readonly busy = signal(false);
  protected readonly loggedIn = computed(() => this.userData.loggedIn());
  /** the account is read: what is imported replaces what the user has */
  protected readonly canImport = computed(() => this.loggedIn() && this.inventory.status() !== 'loading');
  /** the description of the kind of file chosen */
  protected readonly found = computed(() => (this.kind() ? KINDS[this.kind()!] : null));

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
  private pendingCleared: number[] | null = null;

  private async loadGameData(kind: ImportKind): Promise<void> {
    if ((kind === 'units' || kind === 'save') && !this.units) {
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
    }
    if ((kind === 'inventory' || kind === 'save') && !this.cardList.length) {
      const [data, cards, enchantments] = await Promise.all([
        this.staticData.get<Item[]>('data', true),
        this.staticData.get<Record<string, VisionCard>>('visionCards'),
        this.staticData.get<Enchantments>('itemEnchants'),
      ]);
      this.items = data as unknown as TrustItem[];
      this.cardList = Object.values(cards);
      this.enchantments = enchantments;
    }
    if ((kind === 'espers' || kind === 'save') && !this.espers.length) {
      [this.espers, this.boards] = await Promise.all([
        this.staticData.get<EsperInfo[]>('espers'),
        this.staticData.get<Record<string, EsperBoard>>('esperBoards'),
      ]);
    }
  }

  /** The items the site does not know (new or custom) are ignored: a later save imports them once they are known. */
  private readInventory(file: ImportedItem[]): RecapLine {
    const { inventory, messages } = importInventory(
      file,
      this.items as unknown as Item[],
      this.cardList,
      this.enchantments,
      itemEnhancementBySkillId as unknown as Record<string, string>,
      this.serverContext.server(),
    );
    this.pendingInventory = inventory;
    return { label: STRINGS.dataImport.inventory, found: file.length - messages.length, ignored: messages.length };
  }

  /** Forgets the file: nothing is imported. */
  protected cancel(): void {
    this.kind.set(null);
    this.pendingUnits = this.pendingConsumables = this.pendingInventory = this.pendingEspers = null;
    this.pendingCleared = null;
    this.recap.set([]);
    this.done.set(false);
  }

  /** The file chosen: its content says what it is, and the summary tells what it would import. */
  protected async loadFile(data: unknown): Promise<void> {
    this.cancel();
    const kind = detectImportKind(data);
    if (kind === 'empty') return this.toast.show(STRINGS.dataImport.theFileIsEmpty, 'error');
    if (!kind) {
      return this.toast.show(
        STRINGS.dataImport.thisFileIsNot,
        'error',
      );
    }
    this.busy.set(true);
    try {
      await this.loadGameData(kind);
    } catch {
      this.toast.show(STRINGS.dataImport.errorWhileLoadingThe, 'error');
      return;
    } finally {
      this.busy.set(false);
    }
    const recap: RecapLine[] = [];
    switch (kind) {
      case 'units':
        recap.push(this.readUnits(data as never));
        break;
      case 'save': {
        const save = data as GameSave;
        recap.push({ ...this.readUnits(unitsFromSave(save)), source: 'roster' });
        // the save has no TMR / STMR progress: what the site already knows of it stays (never above the copies owned)
        for (const [id, unit] of Object.entries(this.pendingUnits ?? {})) {
          const old = this.inventory.units()[id];
          const copies = unit.number + (unit.sevenStar ?? 0) + (unit.nv ?? 0);
          unit.farmable = Math.min(old?.farmable ?? 0, copies);
          if (unit.farmableStmr !== undefined) unit.farmableStmr = Math.min(old?.farmableStmr ?? 0, copies);
          if (old?.tmrMoogles) unit.tmrMoogles = old.tmrMoogles;
        }
        this.pendingEspers = espersFromSave(save);
        recap.push({ ...this.espersLine(this.pendingEspers), source: 'beasts' });
        recap.push({ ...this.readInventory(itemsFromSave(save)), source: 'inventory, vision_cards' });
        const consumables = consumablesFromSaveFile(save);
        this.pendingConsumables = consumablesFromFile(consumables);
        recap.push({ label: STRINGS.dataImport.consumables, found: consumables.length, ignored: 0, source: 'inventory' });
        this.pendingCleared = clearedFromSave(save);
        const stages = this.pendingCleared.length;
        recap.push({ label: STRINGS.dataImport.completedStages, found: stages, ignored: 0, source: 'progress' });
        break;
      }
      case 'consumables':
        this.pendingConsumables = consumablesFromFile(data as never);
        recap.push({ label: STRINGS.dataImport.consumables, found: Object.keys(this.pendingConsumables).length, ignored: 0 });
        break;
      case 'inventory':
        recap.push(this.readInventory(data as ImportedItem[]));
        break;
      case 'espers':
        this.pendingEspers = data as ImportedEsper[];
        recap.push(this.espersLine(this.pendingEspers));
        break;
    }
    this.recap.set(recap);
    this.kind.set(kind);
  }

  /** The units of the file as the collection of the site; what the site does not know is counted, not imported. */
  private readUnits(file: ImportedUnit[]): RecapLine {
    const { owned, messages } = importUnits(file, {
      server: this.serverContext.server(),
      releasedUnits: this.released,
      units: this.units ?? {},
      items: this.items,
    });
    this.pendingUnits = owned;
    const found = Object.values(owned).reduce((sum, u) => sum + u.number + (u.sevenStar ?? 0) + (u.nv ?? 0), 0);
    return { label: STRINGS.dataImport.units, found, ignored: messages.length };
  }

  private espersLine(file: ImportedEsper[]): RecapLine {
    const found = knownEspers(file).length;
    return { label: STRINGS.dataImport.espers, found, ignored: file.length - found };
  }

  /** What the chosen file writes in the account, one step each (the text is shown while it works). */
  private importSteps(): { text: string; work: () => Promise<unknown> }[] {
    const kind = this.kind();
    const { pendingUnits, pendingConsumables, pendingInventory, pendingEspers } = this;
    const all = kind === 'save';
    const steps: { text: string; work: () => Promise<unknown> }[] = [];
    if ((all || kind === 'units') && pendingUnits) {
      steps.push({ text: STRINGS.dataImport.savingYourUnitCollection, work: () => this.inventory.replace('units', pendingUnits) });
    }
    if ((all || kind === 'consumables') && pendingConsumables) {
      steps.push({
        text: STRINGS.dataImport.savingYourConsumables,
        work: () => this.inventory.replace('consumables', pendingConsumables),
      });
    }
    if ((all || kind === 'inventory') && pendingInventory) {
      steps.push({ text: STRINGS.dataImport.savingYourInventory, work: () => this.replaceItems(pendingInventory) });
    }
    if ((all || kind === 'espers') && pendingEspers && knownEspers(pendingEspers).length > 0) {
      steps.push({
        text: STRINGS.dataImport.savingYourEspers,
        work: () => this.userData.write('espers', importEspers(pendingEspers, this.espers, this.boards)),
      });
    }
    const cleared = this.pendingCleared;
    if (all && cleared?.length) {
      steps.push({
        text: STRINGS.dataImport.savingYourCompletedStages,
        work: () => this.userData.write('clearedMissions', cleared),
      });
    }
    return steps;
  }

  protected async run(): Promise<void> {
    const steps = this.importSteps();
    if (steps.length === 0) {
      this.toast.show(
        this.kind() === 'espers' ? 'No known esper found in the file' : 'Please select a file to import',
        'warn',
      );
      return;
    }
    this.busy.set(true);
    try {
      for (const [index, { text, work }] of steps.entries()) {
        this.progress.set({ percent: Math.round((index / steps.length) * 100), text });
        await work();
      }
    } catch (error) {
      showSaveError(this.toast, error);
      return;
    } finally {
      this.busy.set(false);
      this.progress.set(null);
    }
    this.done.set(true);
  }

  private async replaceItems(inventory: NonNullable<typeof this.pendingInventory>): Promise<void> {
    const items = this.inventory.items();
    for (const id of Object.keys(items)) delete items[id];
    Object.assign(items, inventory);
    this.inventory.changed('itemInventory');
    await this.inventory.save();
  }
}
