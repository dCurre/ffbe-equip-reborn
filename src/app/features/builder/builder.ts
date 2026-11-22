import { Component, inject, signal, viewChild } from '@angular/core';
import { DataStorage } from '../../../core/builder/data-storage';
import { getEsperItem } from '../../../core/builder/item-conditions';
import { ActivatedRoute, Router } from '@angular/router';
import { LinkStore } from '../../shared/services/link-store';
import { Item } from '../../game/helpers/item';
import { cardsAsItems, VisionCard } from '../../game/helpers/vision-cards';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { Inventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { Sprites } from '../../shared/services/sprites';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { UserData } from '../../shared/services/user-data';
import { LoadStatus } from '../../shared/components/load-status/load-status';
import { TabBar, TabItem } from '../../shared/components/tab-bar/tab-bar';
import { ShareLinkModal } from '../../shared/components/share-link-modal/share-link-modal';
import { TextExportModal } from '../../shared/components/text-export-modal/text-export-modal';
import { ImageExportModal } from './image-export-modal/image-export-modal';
import { ItemPicker } from './item-picker/item-picker';
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

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

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
    SiteFooter,
    ItemPicker,
    LoadStatus,
    BuilderTabs,
    TabBar,
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
  });
  protected readonly runner = new OptimizerRunner(this.dataStorage);
  private readonly picker = viewChild(ItemPicker);

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
    { key: 'build', title: 'Build a unit' },
    { key: 'challenge', title: 'Parameter challenges' },
  ];

  protected tabNames(): string[] {
    return this.tabs().map((tab) => tab.s.unit()?.name ?? 'New unit');
  }

  private makeTab(from?: BuilderState): BuilderTab {
    const s = new BuilderState(this.serverContext, from);
    if (from) s.workerCount.set(from.workerCount());
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
        'Importing this team would result in more than 10 units. Please remove some units before doing that.',
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
    inject(Sprites).load('equipments', 'elements', 'ailments', 'killers', 'espers', 'stats');
    this.start();
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
    this.game.enchantments = enchantments;
    this.s.units.set(units);
    this.game.espers = espers.map((esper) => getEsperItem(esper));
    this.dataStorage.setData(this.game.data);
    this.runner.init(this.s.workerCount(), enchantments);
    if (this.inventory.status() === 'loading') await this.inventory.load();
    if (this.inventory.status() === 'loaded') await this.useOwnedEspers();
    this.ready.set(true);
    await this.sharing.loadFromFragment(() => this.addTab()?.sharing ?? null);
    this.active.set(0);
  }

  /** With owned Espers saved in the Esper page, those are the ones the builder uses instead of the default ones. */
  private async useOwnedEspers(): Promise<void> {
    try {
      const owned = Object.values(await this.userData.read<Record<string, any>>('espers'));
      for (const esper of owned) {
        // old saves kept the ST Reflection Boost without the `all` level
        if (esper.esperStatsBonus && !esper.esperStatsBonus.all) esper.esperStatsBonus = { all: esper.esperStatsBonus };
      }
      if (owned.length) this.game.espers = owned.map((esper) => getEsperItem(esper));
    } catch {
      // the default Espers stay
    }
  }

  protected onBuildClick(): void {
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
          onWeaponsSwitched: () => this.toast.show('Weapons hands were switched to optimize build', 'success'),
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
    this.runner.init(number, this.game.enchantments);
  }
}
