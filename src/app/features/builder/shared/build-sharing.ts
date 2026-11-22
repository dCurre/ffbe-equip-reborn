import { signal } from '@angular/core';
import type { ActivatedRoute, Router } from '@angular/router';
import { baseStats, elementList } from '../../../../core/constants/base-lists';
import { itemEnhancementLabels } from '../../../../core/constants/item-enhancement-labels';
import { typeList, weaponList } from '../../../../core/constants/item-types';
import type { DataStorage } from '../../../../core/builder/data-storage';
import { findBestItemVersion, getEsperItem } from '../../../../core/builder/item-conditions';
import { applyEnhancements } from '../../../../core/builder/item-combination';
import { getPlaceHolder } from '../../../../core/builder/item-entry';
import { calculateStatValue } from '../../../../core/builder/stat-calculation';
import { formulaToString } from '../../../../core/formula/formula-text';
import { parseFormula } from '../../../../core/formula/formula-parser';
import { copyToClipboard } from '../../../shared/helpers/clipboard';
import { ShareLinkState } from '../../../shared/state/share-link-state';
import type { Inventory } from '../../../shared/services/inventory';
import type { LinkStore } from '../../../shared/services/link-store';
import type { ServerContext } from '../../../shared/services/server-context';
import type { Toast } from '../../../shared/services/toast';
import { enemy } from './build-inputs';
import type { BuilderState } from './builder-state';
import type { CustomGoal } from './custom-goal';
import type { GameData } from './game-data';
import { formulaByGoal } from './goal';
import type { ItemActions } from './item-actions';
import { ADDITIONAL_FILTERS, oldLinkToData, shortLinkToData, stateData, unitState } from './state-hash';
import type { UnitLoader } from './unit-loader';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The link of a build, its text, and the opening of a link. */
export class BuildSharing {
  // --- Sharing ---

  readonly share = new ShareLinkState();
  readonly textOpen = signal(false);
  readonly textValue = signal('');
  readonly imageOpen = signal(false);
  readonly imageUnits = signal<any[]>([]);

  constructor(
    private readonly s: BuilderState,
    private readonly game: GameData,
    private readonly dataStorage: DataStorage,
    private readonly toast: Toast,
    private readonly linkStore: LinkStore,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly serverContext: ServerContext,
    private readonly inventory: Inventory,
    private readonly loader: UnitLoader,
    private readonly items: ItemActions,
    private readonly customGoal: CustomGoal,
  ) {}

  /** The unit of the tab as a link keeps it. */
  private unitData(): any {
    this.s.refresh();
    const build = this.s.build();
    const server = this.serverContext.server();
    const state = unitState(build, server);
    if (build.hasBraveShift()) {
      build.braveShift();
      state.braveShiftedUnit = unitState(build, server);
      build.braveShift();
    }
    return state;
  }

  /** The data of the link: the units (this tab, or all the tabs), the enemy and the options of this tab. */
  linkData(all: BuildSharing[]): any {
    const units = all.filter((tab) => tab.s.unit()).map((tab) => tab.unitData());
    const build = this.s.build();
    const foe = enemy(this.s);
    const monster = {
      races: foe.races,
      atk: foe.atk,
      mag: foe.mag,
      elementalResist: foe.elementalResists,
      def: foe.def,
      spr: foe.spr,
      breaks: foe.breaks,
      buffs: foe.buffs,
      breakability: foe.breakability,
      imperils: foe.imperils,
      attackFormula: formulaToString(this.s.monsterAttackFormula()),
    };
    return stateData(
      units,
      monster,
      'all',
      ADDITIONAL_FILTERS.filter((name) => this.filters[name]()),
    );
  }

  /** The item filters of the page by their name in the links. */
  private get filters(): Record<(typeof ADDITIONAL_FILTERS)[number], () => boolean> {
    return {
      includeEasilyObtainableItems: this.s.includeEasyItems,
      includeChocoboItems: this.s.includeChocoboItems,
      includeTMROfOwnedUnits: this.s.includeTmrOfOwnedUnits,
      includeTmrMoogles: this.s.includeTmrMoogles,
      includeFarmableStmr: this.s.includeFarmableStmr,
      includeTrialRewards: this.s.includeTrialRewards,
      exludeEvent: this.s.excludeEvent,
      excludePremium: this.s.excludePremium,
      excludeTMR5: this.s.excludeTmr5,
      excludeSTMR: this.s.excludeStmr,
      excludeNotReleasedYet: this.s.excludeNotReleased,
    };
  }

  /** `all`: the tabs to put in the link, this one included (by default only this one). */
  async openShare(all: BuildSharing[] = [this]): Promise<void> {
    if (!this.s.unit()) return;
    try {
      const id = await this.linkStore.save(this.linkData(all));
      const url = new URL('builder', document.baseURI);
      url.search = `?server=${this.serverContext.server()}`;
      this.share.show(`${url.href}#${id}`);
    } catch {
      this.toast.show('Failed to generate url', 'error');
    }
  }

  openText(all: BuildSharing[] = [this]): void {
    if (!this.s.unit()) return;
    this.textValue.set(
      all
        .filter((tab) => tab.s.unit())
        .map((tab) => tab.buildText())
        .join('\n\n'),
    );
    this.textOpen.set(true);
  }

  openImage(all: BuildSharing[] = [this]): void {
    if (!this.s.unit()) return;
    this.imageUnits.set(this.linkData(all).units);
    this.imageOpen.set(true);
  }

  private buildText(): string {
    const build = this.s.build();
    this.s.refresh();
    const names = [
      'Right hand',
      'Left hand',
      'Head',
      'Body',
      'Accessory 1',
      'Accessory 2',
      'Materia 1',
      'Materia 2',
      'Materia 3',
      'Materia 4',
      'Vision Card',
      'Esper',
    ];
    const rarity = build.unit.sixStarForm ? 6 : build.unit.max_rarity;
    let text = `${build.unit.name} ${rarity}★  \n`;
    names.forEach((name, slot) => (text += this.itemAsText(name, slot)));
    text += `Total: ${baseStats.map((stat) => `${stat.toUpperCase()}:${Math.floor(calculateStatValue(build.build, stat, build).total)}`).join(', ')}`;
    return text;
  }

  private itemAsText(prefix: string, slot: number): string {
    const build = this.s.build();
    const item = build.build[slot];
    if (!item) return '';
    let coefficient = 1;
    if (item.type === 'esper') {
      for (const other of build.build) {
        const bonus = other?.esperStatsBonus;
        if (!bonus) continue;
        if (bonus.all) coefficient += bonus.all.hp / 100;
        if (build.build[11] && bonus[build.build[11].id]) coefficient += bonus[build.build[11].id].hp / 100;
      }
      coefficient = Math.min(3, coefficient);
    }
    const parts: string[] = [];
    for (const stat of baseStats) {
      if (item[stat]) parts.push(`${stat.toUpperCase()}+${Math.floor(item[stat] * coefficient)}`);
      if (item[`${stat}%`]) parts.push(`${stat.toUpperCase()}+${item[`${stat}%`]}%`);
    }
    let line = `${prefix}: ${item.name} ${parts.join(', ')}`;
    if (item.enhancements) {
      const label = (e: string | number): string =>
        typeof e === 'number'
          ? this.game.enchantments[e]?.name
          : e === 'special_1'
            ? (itemEnhancementLabels.special_1 as Record<string, string>)[item.id]
            : ((itemEnhancementLabels as unknown as Record<string, string>)[e] ?? e);
      line += ` (IW :${item.enhancements.map(label).join(', ')})`;
    }
    return `${line}  \n`;
  }

  copyText(): void {
    void copyToClipboard(this.textValue()).then((ok) => ok && this.toast.show('Copied', 'success'));
  }

  // --- Opening a link ---

  /** `nextTab` gives a new tab for each unit of the link after the first (null: no more room). */
  async loadFromFragment(nextTab: () => BuildSharing | null): Promise<void> {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) return;
    try {
      let data: any;
      if (this.linkStore.isLinkId(fragment)) {
        data = await this.linkStore.load(fragment);
      } else if (this.linkStore.isOldLinkId(fragment)) {
        this.toast.show('This link was made by FFBE Equip Next and its data is no longer available.', 'error');
        return;
      } else {
        const parsed = JSON.parse(atob(fragment));
        if (Array.isArray(parsed)) {
          const result = shortLinkToData(parsed, this.s.units());
          if (result.error || !result.data) {
            this.toast.show(`Wrong link data: ${result.error}`, 'error');
            return;
          }
          if (result.warning) this.toast.show(result.warning, 'warn');
          data = result.data;
        } else {
          data = oldLinkToData(parsed, (goal) => formulaToString(formulaByGoal[goal]));
        }
      }
      await this.loadData(data, nextTab);
      // the link is not kept in the address: a reload starts from an empty page
      this.router.navigate([], { fragment: undefined, queryParamsHandling: 'preserve', replaceUrl: true });
    } catch {
      this.toast.show('This build link does not exist or could not be loaded.', 'error');
    }
  }

  /** Opens the data of a link: its first unit in this tab, the others in the tabs `nextTab` gives. */
  async loadData(data: any, nextTab: () => BuildSharing | null): Promise<void> {
    await this.loadState(data, 0);
    for (let i = 1; i < (data.units?.length ?? 0); i++) {
      const tab = nextTab();
      if (!tab) break;
      await tab.loadState(data, i);
    }
  }

  /** Fills the page with the data of a link (the old `loadStateHashAndBuild`). */
  private async loadState(data: any, index: number): Promise<void> {
    const version = data.version ?? 0;
    const selector = data.itemSelector;
    if (selector?.mainSelector === 'owned' && this.inventory.status() !== 'loaded') {
      this.toast.show('This build uses your owned equipments: log in to open it', 'warn');
      return;
    }
    const monster = data.monster;
    if (monster) {
      this.s.races.set(monster.races ?? []);
      this.s.monster.set({
        atk: monster.atk ? String(monster.atk) : '',
        mag: monster.mag ? String(monster.mag) : '',
        def: monster.def ? String(monster.def) : '',
        spr: monster.spr ? String(monster.spr) : '',
      });
      const resists: Record<string, string> = {};
      const imperils: Record<string, string> = {};
      for (const element of elementList) {
        resists[element] = monster.elementalResist?.[element] ? String(monster.elementalResist[element]) : '';
        imperils[element] = monster.imperils?.[element] ? String(monster.imperils[element]) : '';
      }
      for (const weapon of weaponList) {
        imperils[weapon] = monster.imperils?.[weapon] ? String(monster.imperils[weapon]) : '';
      }
      const perStat = (values: Record<string, number> | undefined): Record<string, string> =>
        Object.fromEntries(
          ['atk', 'def', 'mag', 'spr'].map((stat) => [stat, values?.[stat] ? String(values[stat]) : '']),
        );
      this.s.monsterBreaks.set(perStat(monster.breaks));
      this.s.monsterBuffs.set(perStat(monster.buffs));
      this.s.monsterBreakability.set({ atk: true, def: true, mag: true, spr: true, ...monster.breakability });
      this.s.monsterResists.set(resists);
      this.s.monsterImperils.set(imperils);
    }
    if (selector) {
      this.s.source.set(selector.mainSelector ?? 'all');
      for (const name of selector.additionalFilters ?? []) {
        (this.filters as any)[name]?.set?.(true);
      }
    }
    const unit = data.units?.[index];
    if (!unit) return;
    const state = unit;
    if (!String(state.id).endsWith('7')) this.s.onlyNvUnits.set(false);
    let toSelect = String(state.id);
    if (state.rarity == 6 && this.s.units()[state.id]?.['6_form']) toSelect += '-6';
    else if (state.rarity == 7 && this.s.units()[state.id]?.['7_form']) toSelect += '-7';
    this.loader.pendingEnhancementLevels = state.enhancementLevels;
    await this.loader.choose(toSelect);
    if (!this.s.build().unit) return;
    if (monster?.attackFormula) {
      const attack = parseFormula(monster.attackFormula, null);
      this.s.monsterAttackFormula.set(attack);
      this.s.build().monsterAttackFormula = attack;
    }
    this.applyUnitState(state, version);
    if (state.braveShiftedUnit) {
      this.loader.braveShift();
      this.applyUnitState(state.braveShiftedUnit, version);
      this.loader.braveShift();
    }
  }

  private applyUnitState(state: any, version: number): void {
    const build = this.s.build();
    this.customGoal.applyFormula(parseFormula(state.goal, this.s.unitWithSkills()));
    if (state.level) {
      build.level = state.level;
      this.s.level.set(String(state.level));
    }
    if (state.exAwakening) {
      build.setExAwakeningLevel(state.exAwakening);
      this.s.exLevel.set(String(state.exAwakening));
    }
    this.s.innateElements.set(state.innateElements ?? []);
    this.s.recalculateApplicableSkills();
    (state.items ?? []).forEach((entry: any, index: number) => {
      if (!entry) return;
      let id = version >= 1 ? entry.id : entry;
      const slot = version >= 1 ? entry.slot : -1;
      if (slot === 10 && entry.level) id = `${id}-${entry.level}`;
      const enhancements = state.itemEnchantments?.[index] ?? undefined;
      const item = this.itemFromKey(id, enhancements);
      if (item) this.items.fixItem(item, slot, version >= 2 ? entry.pinned : true);
    });
    if (state.esperId) {
      const pinned = version >= 2 ? state.esperPinned : true;
      const esper = state.esper ? getEsperItem(state.esper) : this.game.espers.find((e) => e.id === state.esperId);
      if (esper) this.items.fixItem(esper, 11, pinned);
    }
    const pots: Record<string, string> = { ...this.s.pots() };
    const buffs: Record<string, string> = { ...this.s.buffs() };
    for (const stat of baseStats) {
      if (state.pots?.[stat] !== undefined) pots[stat] = String(state.pots[stat]);
      if (state.buffs?.[stat] !== undefined) buffs[stat] = state.buffs[stat] ? String(state.buffs[stat]) : '';
    }
    this.s.pots.set(pots);
    this.s.buffs.set(buffs);
    if (state.buffs) {
      if (state.buffs.lbFillRate) this.s.lbFillRate.set(String(state.buffs.lbFillRate));
      this.s.killerBuffs.set(
        Object.fromEntries(
          (state.buffs.killers ?? []).map((k: any) => [
            k.name,
            { physical: String(k.physical ?? ''), magical: String(k.magical ?? '') },
          ]),
        ),
      );
      this.s.elementBuffs.set(
        Object.fromEntries(Object.entries(state.buffs.elements ?? {}).map(([e, v]) => [e, String(v)])),
      );
    }
    if (state.lbShardsPerTurn) this.s.lbShards.set(String(state.lbShardsPerTurn));
    const mitigation = state.buffs?.mitigation || state.mitigation;
    if (mitigation)
      this.s.mitigations.set({
        physical: String(mitigation.physical || ''),
        magical: String(mitigation.magical || ''),
        global: String(mitigation.global || ''),
      });
    const drawAttacks = state.buffs?.drawAttacks || state.drawAttacks;
    if (drawAttacks) this.s.drawAttacks.set(String(drawAttacks));
    const lbDamage = state.buffs?.lbDamage || state.lbDamage;
    if (lbDamage) this.s.lbDamage.set(String(lbDamage));
    if (state.stack) this.s.stack.set(String(state.stack));
    this.s.refresh();
  }

  /** An item from its id (the old `fixItem` with a key): a placeholder, an Esper, or the best version of an item. */
  private itemFromKey(key: string, enhancements?: any[]): any {
    const build = this.s.build();
    if (typeList.includes(key)) return getPlaceHolder(key);
    if (key === 'unavailable') return { name: 'Unavailable slot', type: 'unavailable', placeHolder: true };
    const esper = this.game.espers.find((e) => e.id === key);
    if (esper) return esper;
    const base = this.dataStorage.allItemVersions[key]?.[0];
    if (!base) return null;
    const item = findBestItemVersion(
      build.build,
      base,
      this.dataStorage.itemWithVariation,
      build.unit,
      this.game.enchantments,
    );
    return enhancements?.length
      ? applyEnhancements(
          item,
          enhancements.map((e) => (e === 'rare' ? 'rares' : e)),
          this.game.enchantments,
        )
      : item;
  }
}
