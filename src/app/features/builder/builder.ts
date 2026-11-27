import { afterNextRender, Component, computed, inject, Injector, signal, viewChild } from '@angular/core';
import { DataStorage } from '../../../core/builder/data-storage';
import { getEsperItem } from '../../../core/builder/item-conditions';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { LinkStore } from '../../shared/services/link-store';
import { buildSearchString, Item } from '../../game/helpers/item';
import { cardsAsItems, VisionCard } from '../../game/helpers/vision-cards';
import { PageContent } from '../../layout/page-content/page-content';
import { BusyOverlay } from '../../shared/components/busy-overlay/busy-overlay';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { Inventory } from '../../shared/services/inventory';
import { pictureId } from '../../shared/helpers/unit-picture';
import { ServerContext } from '../../shared/services/server-context';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { UserData } from '../../shared/services/user-data';
import { LoadStatus } from '../../shared/components/load-status/load-status';
import { TabItem } from '../../shared/components/tab-bar/tab-bar';
import { Alert } from '../../shared/components/alert/alert';
import { Button } from '../../shared/components/button/button';
import { Panel } from '../../shared/components/panel/panel';
import { Modal } from '../../shared/components/modal/modal';
import { TabPanel } from '../../shared/components/tab-panel/tab-panel';
import { ShareLinkModal } from '../../shared/components/share-link-modal/share-link-modal';
import { TextExportModal } from '../../shared/components/text-export-modal/text-export-modal';
import { ImageExportModal } from './image-export-modal/image-export-modal';
import { ItemPicker } from './item-picker/item-picker';
import { Enemy, EnemyBuffs, setEnemy } from './shared/enemy';
import { OptimizerRunner, RunCallbacks } from './shared/optimizer-runner';
import { ParamChallenge } from './shared/param-challenge';
import { ChallengePanel } from './challenge-panel/challenge-panel';
import { enemy, readItemOptions } from './shared/build-inputs';
import { BuildHelp } from './build-help/build-help';
import { BuildResult } from './build-result/build-result';
import { BuildSharing } from './shared/build-sharing';
import { BuilderTabs } from './builder-tabs/builder-tabs';
import { CustomGoalModal } from './custom-goal-modal/custom-goal-modal';
import { EnhancementModal } from './enhancement-modal/enhancement-modal';
import { CustomGoal } from './shared/custom-goal';
import { EnemyPanel } from './enemy-panel/enemy-panel';
import { EquipmentsPanel } from './equipments-panel/equipments-panel';
import { GameData } from './shared/game-data';
import { GoalPanel } from './goal-panel/goal-panel';
import { ItemActions } from './shared/item-actions';
import { RulesPanel } from './rules-panel/rules-panel';
import { SavedTeamsPanel } from './saved-teams/saved-teams';
import { SavedTeams } from './shared/saved-teams';
import { BuilderState, BuilderUnit } from './shared/builder-state';
import { UnitLoader } from './shared/unit-loader';
import { UnitPanel } from './unit-panel/unit-panel';
import { STRINGS } from '../../strings/en';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The picture of the unit chosen (`id`, with `-6` or `-7` for the forms): the one of its rarity (the old `onUnitChange`). */
/** An Esper with the text the search of the item picker looks into. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Esper items of the core are open
function searchable(esper: any, units: Record<string, BuilderUnit>): any {
  esper.searchString = buildSearchString(esper, units);
  return esper;
}

function unitIconId(id: string, unit: BuilderUnit): string {
  if (id.endsWith('-6')) return id.slice(0, -3) + '6';
  if (id.endsWith('-7')) return id.slice(0, -3) + '7';
  if (/0[345]$/.test(id)) {
    if (unit['sevenStarForm']) return id.slice(0, -2) + '07';
    if (unit['sixStarForm']) return id.slice(0, -2) + '06';
    if (unit['braveShift']) return id.slice(0, -2) + '17';
    return id;
  }
  return id.slice(0, -1) + (unit.max_rarity === 'NV' ? '7' : unit.max_rarity);
}

type SettingsTab = 'rules' | 'monster' | 'equipments';

/** One tab of the page: a unit being built. */
interface BuilderTab {
  s: BuilderState;
  loader: UnitLoader;
  items: ItemActions;
  customGoal: CustomGoal;
  sharing: BuildSharing;
  challenge: ParamChallenge;
}

/** Builds the best equipment of a unit for a goal (damage, a stat, a skill...), from the items of the game or the owned ones. */
@Component({
  selector: 'app-builder',
  imports: [
    PageContent,
    BusyOverlay,
    SiteFooter,
    ItemPicker,
    LoadStatus,
    BuilderTabs,
    TabPanel,
    Panel,
    Modal,
    Alert,
    Button,
    ChallengePanel,
    EnhancementModal,
    CustomGoalModal,
    ShareLinkModal,
    TextExportModal,
    ImageExportModal,
    UnitPanel,
    GoalPanel,
    EnemyPanel,
    RulesPanel,
    SavedTeamsPanel,
    EquipmentsPanel,
    BuildResult,
    BuildHelp,
  ],
  templateUrl: './builder.html',
  styleUrl: './builder.css',
})
export class Builder {
  protected readonly t = STRINGS.builder;
  private readonly staticData = inject(StaticData);
  protected readonly inventory = inject(Inventory);
  private readonly serverContext = inject(ServerContext);
  private readonly toast = inject(Toast);
  private readonly linkStore = inject(LinkStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userData = inject(UserData);
  protected readonly savedTeams = new SavedTeams(this.userData, this.toast);

  // --- Game data ---
  protected readonly game = new GameData();
  protected readonly ready = signal(false);

  private readonly dataStorage = new DataStorage({
    currentBuild: () => this.s.build(),
    ownedUnits: () => (this.inventory.status() === 'loaded' ? this.inventory.units() : null),
    itemEnchantments: () => this.game.enchantments,
    allBuilds: () => ({ builds: this.tabs().map((tab) => tab.s.build()), index: this.active() }),
  });
  protected readonly runner = new OptimizerRunner(this.dataStorage);
  private readonly picker = viewChild(ItemPicker);
  private readonly chooser = viewChild<UnitPanel>('chooser');
  private readonly injector = inject(Injector);

  // --- The tabs: each one is a unit being built, with its own state and helpers ---
  protected readonly tabs = signal<BuilderTab[]>([this.makeTab()]);
  protected readonly active = signal(0);
  protected readonly maxTabs = 10;
  private get tab(): BuilderTab {
    return this.tabs()[this.active()];
  }
  protected get s(): BuilderState {
    return this.tab.s;
  }
  protected get loader(): UnitLoader {
    return this.tab.loader;
  }
  protected get items(): ItemActions {
    return this.tab.items;
  }
  protected get customGoal(): CustomGoal {
    return this.tab.customGoal;
  }
  protected get sharing(): BuildSharing {
    return this.tab.sharing;
  }
  protected get challenge(): ParamChallenge {
    return this.tab.challenge;
  }

  /** Building a unit, or looking for the unit that passes a Parameter Challenge. */
  protected readonly mode = signal<'build' | 'challenge'>('build');
  protected readonly modes: TabItem<'build' | 'challenge'>[] = [
    { key: 'build', title: STRINGS.builder.buildAUnit },
    { key: 'challenge', title: STRINGS.builder.parameterChallenges },
  ];

  protected readonly helpOpen = signal(false);
  protected readonly loggedIn = computed(() => this.userData.loggedIn());

  /** The settings of the build, in tabs (the challenge only has the equipments). */
  protected readonly settingsTab = signal<SettingsTab>('rules');
  protected readonly settingsTabs = computed<TabItem<SettingsTab>[]>(() =>
    this.mode() === 'build'
      ? [
          { key: 'rules', title: STRINGS.builder.buildRules },
          { key: 'monster', title: STRINGS.builder.monster },
          { key: 'equipments', title: STRINGS.builder.equipments },
        ]
      : [{ key: 'equipments', title: STRINGS.builder.equipments }],
  );
  protected readonly shownSettings = computed<SettingsTab>(() =>
    this.mode() === 'build' ? this.settingsTab() : 'equipments',
  );

  protected tabIcons(): string[] {
    return this.tabs().map((tab) => {
      const unit = tab.s.unit();
      return unit ? `img/units/unit_icon_${unitIconId(pictureId(tab.s.unitId()), unit)}.png` : '';
    });
  }

  protected tabNames(): string[] {
    return this.tabs().map((tab) => tab.s.unit()?.name ?? 'New unit');
  }

  private makeTab(from?: BuilderState): BuilderTab {
    const s = new BuilderState(this.serverContext, from, () =>
      this.inventory.status() === 'loaded' ? this.inventory.units() : null,
    );
    if (from) s.workerCount.set(from.workerCount());
    if (this.inventory.status() === 'loaded') s.source.set('owned');
    const loader = new UnitLoader(s, this.staticData, this.toast, this.dataStorage);
    const items = new ItemActions(s, this.game, this.dataStorage, this.toast, this.inventory, () => this.picker());
    const customGoal = new CustomGoal(s, this.toast);
    const sharing = new BuildSharing(
      s,
      this.game,
      this.dataStorage,
      this.toast,
      this.linkStore,
      this.router,
      this.route,
      this.serverContext,
      this.inventory,
      loader,
      items,
      customGoal,
    );
    const challenge = new ParamChallenge(
      s,
      loader,
      this.runner,
      this.toast,
      () => this.inventory.units(),
      (callbacks) => this.startRun(callbacks),
    );
    return { s, loader, items, customGoal, sharing, challenge };
  }

  /** The + of the tabs: a new tab with the list of the units open, as the old page did. */
  protected addTabAndChoose(): void {
    if (this.addTab()) afterNextRender(() => this.chooser()?.focusUnit(), { injector: this.injector });
  }

  protected addTab(): BuilderTab | null {
    if (this.tabs().length >= this.maxTabs) return null;
    const tab = this.makeTab(this.tabs()[0].s);
    this.tabs.update((tabs) => [...tabs, tab]);
    this.active.set(this.tabs().length - 1);
    return tab;
  }

  /** The tabs with a unit, the active one first: what the "all units" link and text are made of. */
  protected allSharing(): BuildSharing[] {
    return this.tabs().map((tab) => tab.sharing);
  }

  /** Saves the units of all the tabs over the team being edited (or as a new one with a name). */
  protected saveTeam(name?: string): void {
    const data = this.tab.sharing.linkData(this.allSharing());
    if (name === undefined) void this.savedTeams.save(data);
    else void this.savedTeams.saveAs(name, data);
  }

  /** Replaces the units of the builder with the ones of a saved team. */
  protected async loadTeam(index: number): Promise<void> {
    while (this.tabs().length > 1) this.closeTab(this.tabs().length - 1);
    this.active.set(0);
    this.savedTeams.current.set(index);
    await this.tab.sharing.loadData(this.savedTeams.teams()[index].team, () => this.addTab()?.sharing ?? null);
    this.active.set(0);
  }

  /** Adds the units of a saved team to the ones of the builder. */
  protected async importTeam(index: number): Promise<void> {
    const team = this.savedTeams.teams()[index].team;
    const empty = this.tabs().length === 1 && !this.tab.s.unit();
    if ((empty ? 0 : this.tabs().length) + team.units.length > this.maxTabs) {
      this.toast.show(
        STRINGS.builder.importingThisTeamWould,
        'error',
      );
      return;
    }
    const target = empty ? this.tab : this.addTab();
    await target?.sharing.loadData(team, () => this.addTab()?.sharing ?? null);
  }

  protected closeTab(index: number): void {
    if (this.tabs().length === 1) return;
    this.tabs.update((tabs) => tabs.filter((_, i) => i !== index));
    this.active.update((active) => Math.min(index < active ? active - 1 : active, this.tabs().length - 1));
  }

  constructor() {
    this.start();
    // the Builder stays alive behind the Bestiary (`KeepBuilder`): a monster chosen there arrives when it is shown again
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.ready()) this.useBestiaryMonster();
      });
  }

  private async start(): Promise<void> {
    const [data, cards, enchantments, units, espers] = await Promise.all([
      this.staticData.get<Item[]>('data', true),
      this.staticData.get<Record<string, VisionCard>>('visionCards'),
      this.staticData.get<Record<string, any>>('itemEnchants', true),
      this.staticData.get<Record<string, BuilderUnit>>('unitsWithPassives', true),
      this.staticData.get<any[]>('defaultBuilderEspers'),
    ]);
    this.game.data = [...data, ...cardsAsItems(cards)];
    this.game.globalData = this.game.data.filter((item) => item['server'] !== 'JP');
    // the search of the item picker looks into this text
    for (const item of this.game.data) item.searchString = buildSearchString(item, units);
    this.game.enchantments = enchantments;
    this.s.units.set(units);
    this.game.espers = espers.map((esper) => searchable(getEsperItem(esper), units));
    // the Global version: no Esper that only Japan has, and the older board of the others (`global` holds all its values)
    this.game.globalEspers = espers
      .filter((esper) => !esper.jpOnly)
      .map((esper) => searchable(getEsperItem(esper.global ? { id: esper.id, name: esper.name, ...esper.global } : esper), units));
    this.dataStorage.setData(this.game.data);
    this.runner.init(this.s.workerCount(), enchantments);
    if (this.inventory.status() === 'loading') await this.inventory.load();
    if (this.inventory.status() === 'loaded') {
      // logged in: the equipment the user owns, unless a link says otherwise (it comes after)
      this.s.source.set('owned');
      await this.useOwnedEspers();
    }
    this.ready.set(true);
    await this.sharing.loadFromFragment(() => this.addTab()?.sharing ?? null);
    this.active.set(0);
    this.useBestiaryMonster();
  }

  /** A monster chosen in the Bestiary arrives with the navigation: it becomes the enemy of the open tab. */
  private useBestiaryMonster(): void {
    const enemy = history.state?.enemy as (Enemy & { source: string; buffs?: EnemyBuffs }) | undefined;
    if (!enemy) return;
    // used once: coming back to this page of the history must not undo what was changed since
    history.replaceState({ ...history.state, enemy: undefined }, '');
    // the wiki does not say which stats can be broken
    setEnemy(this.s, enemy, enemy.buffs ?? {}, enemy.source === 'wiki' || enemy.source === 'wikiResists');
    this.settingsTab.set('monster');
    const set = `${STRINGS.builder.enemySet} ${enemy.name}`;
    if ([enemy.atk, enemy.def, enemy.mag, enemy.spr].includes(null))
      this.toast.show(`${set}. ${STRINGS.builder.statsNotPublished}`, 'warn');
    else this.toast.show(set, 'success');
  }

  /** With owned Espers saved in the Esper page, those are the ones the builder uses instead of the default ones. */
  private async useOwnedEspers(): Promise<void> {
    try {
      const owned = Object.values(await this.userData.read<Record<string, any>>('espers'));
      for (const esper of owned) {
        // old saves kept the ST Reflection Boost without the `all` level
        if (esper.esperStatsBonus && !esper.esperStatsBonus.all) esper.esperStatsBonus = { all: esper.esperStatsBonus };
      }
      if (owned.length) {
        const ownedItems = owned.map((esper) => searchable(getEsperItem(esper), this.s.units()));
        this.game.ownedEsperIds = new Set(ownedItems.map((esper) => esper.id));
        // the owned ones, with the progress of the user, and the default ones he does not have
        const japanOnly = new Set(this.game.espers.map((e) => e.id).filter((id) => !this.game.globalEspers.some((e) => e.id === id)));
        this.game.espers = [...ownedItems, ...this.game.espers.filter((esper) => !this.game.ownedEsperIds!.has(esper.id))];
        this.game.globalEspers = [
          ...ownedItems.filter((esper) => !japanOnly.has(esper.id)),
          ...this.game.globalEspers.filter((esper) => !this.game.ownedEsperIds!.has(esper.id)),
        ];
      }
    } catch {
      // the default Espers stay
    }
  }

  protected onBuildClick(): void {
    this.applyWorkers();
    const build = this.s.build();
    if (!build.unit) return;
    if (this.runner.running()) {
      this.runner.stop();
      this.s.message.set(
        'The build calculation has been stopped. The best calculated result is displayed, but it may not be the overall best build.',
      );
      return;
    }
    this.s.message.set('');
    this.startRun();
  }

  /** Looks for the best build of the unit of the tab; `callbacks` replace the ones of the page. */
  private startRun(callbacks: Partial<RunCallbacks> = {}): void {
    const build = this.s.build();
    build.emptyBuild();
    this.s.refresh();
    this.dataStorage.calculateAlreadyUsedItems([build], 0);
    readItemOptions(this.s, this.dataStorage, this.inventory);
    this.dataStorage.useElementConditionedMateria = this.s.useElementConditionedMateria();
    const espers: Record<string, any> = {};
    for (const esper of this.game.espersFor(this.s.source())) espers[esper.id] = esper;
    try {
      this.runner.run(
        build,
        {
          forceDoubleHand: this.s.forceDoubleHand(),
          forceDualWield: this.s.forceDualWield(),
          tryEquipSources: this.s.tryEquipSources(),
          forceTmrAbility: this.s.forceTmrAbility(),
          server: this.serverContext.server(),
          espers,
          enemyStats: enemy(this.s),
          monsterAttackFormula: this.s.monsterAttackFormula(),
          goalVariation: this.s.goalVariation(),
          reduceOvercapStat: this.s.tryReduceOvercap() ? this.s.reduceOvercapStat() : null,
        },
        {
          onBetter: () => this.s.tick.update((n) => n + 1),
          onDone: () => this.s.tick.update((n) => n + 1),
          onNoCombination: () =>
            this.s.message.set('The build rules chosen are not compatible with available equipments'),
          onConditionNotMet: () => this.s.message.set('The condition set in the goal are impossible to meet.'),
          onWeaponsSwitched: () => this.toast.show(STRINGS.builder.weaponsHandsWereSwitched, 'success'),
          ...callbacks,
        },
        this.s.excluded(),
      );
    } catch (error) {
      this.runner.running.set(false);
      this.s.message.set(`An error occured while trying to optimize: ${(error as Error).message}`);
    }
  }

  protected setWorkers(value: string): void {
    const count = parseInt(value, 10);
    const number = !count || count < 1 || count > 16 ? 2 : count;
    this.s.workerCount.set(number);
    // creating the workers sends them all the items: wait until the user stops clicking the arrows
    clearTimeout(this.workersTimer);
    this.workersTimer = setTimeout(() => this.applyWorkers(), 500);
  }

  private workersTimer: ReturnType<typeof setTimeout> | undefined;

  /** Creates the workers now if a change of their number is waiting. */
  private applyWorkers(): void {
    if (this.workersTimer === undefined) return;
    clearTimeout(this.workersTimer);
    this.workersTimer = undefined;
    this.runner.init(this.s.workerCount(), this.game.enchantments);
  }
}
