import { computeFarmableStmr, getItemEntry } from './item-entry.js';
import { getValue } from './item-values.js';
import { elementList } from '../constants/base-lists.js';
import { percentValues } from '../constants/stat-values.js';
import { getAvailableNumbers, getOwnedNumber, getOwnedCardNumber, calculateAlreadyUsedItems } from './storage/item-ownership.js';
import {
  itemCanBeOfUseForGoal,
  itemWithUnstackableSkillOnlyUsefulInOne,
  removeStat,
} from './storage/item-usefulness.js';
import {
  addDesirableElementsFromFormula,
  addDesirableElementsFromImperilInFormula,
  addDesirableElementsFromItems,
} from './storage/desirable-elements.js';
import { prepareItem, addToWeaponsByTypeAndHands } from './storage/item-preparation.js';
import { prepareData } from './storage/prepare-data.js';

/** What the builder page provides to the data storage. Functions, because these values change while the page lives. */
export interface DataStorageContext {
  currentBuild(): any;
  ownedUnits(): any;
  itemEnchantments(): any;
  /** Every build of the page and the one being worked on: the items of the others are already used. */
  allBuilds(): { builds: any[]; index: number } | null;
}

const defaultContext: DataStorageContext = {
  currentBuild: () => null,
  ownedUnits: () => null,
  itemEnchantments: () => null,
  allBuilds: () => null,
};

export class DataStorage {
  context: DataStorageContext;
  onlyUseOwnedItems: any;
  onlyUseShopRecipeItems: any;
  exludeEventEquipment: any;
  excludeNotReleasedYet: any;
  /** only the equipment of the Global version */
  excludeJapan: any;
  excludeTMR5: any;
  excludePremium: any;
  excludeSTMR: any;
  includeTrialRewards: any;
  includeTMROfOwnedUnits: any;
  includeTmrMoogles: any;
  includeEasilyObtainableItems: any;
  includeChocoboItems: any;
  includeFarmableStmr: any;
  alreadyUsedItems: any;
  unstackablePinnedItems: any;
  alreadyUsedEspers: any;
  itemInventory: any;
  availableTmr: any;
  availableStmr: any;
  defaultWeaponEnhancement: any;
  defaultVisionCardLevel: any;
  useElementConditionedMateria: any;
  farmableStmrs: any;
  data: any;
  allItemVersions: any;
  itemWithVariation: any;
  itemsToExclude: any;
  unitBuild: any;
  desirableElements: any;
  desiredEquipmentType: any;
  dataByType: any;
  dataWithCondition: any;
  dualWieldSources: any;
  equipSources: any;
  weaponsByTypeAndHands: any;
  skillIds: any;
  addEntriesToResult: any;
  itemsToInclude: any;

  constructor(context: DataStorageContext = defaultContext) {
    this.context = context;
    this.onlyUseOwnedItems = false;
    this.onlyUseShopRecipeItems = false;
    this.exludeEventEquipment = false;
    this.excludeNotReleasedYet = true;
    this.excludeJapan = false;
    this.excludeTMR5 = false;
    this.exludeEventEquipment = false;
    this.excludePremium = false;
    this.excludeSTMR = false;
    this.includeTrialRewards = false;
    this.includeTMROfOwnedUnits = false;
    this.includeTmrMoogles = false;
    this.includeEasilyObtainableItems = false;
    this.includeChocoboItems = false;
    this.includeFarmableStmr = false;
    this.alreadyUsedItems = {};
    this.unstackablePinnedItems = [];
    this.alreadyUsedEspers = [];
    this.itemInventory = null;
    this.availableTmr = null;
    this.availableStmr = null;
    this.defaultWeaponEnhancement = null;
    this.defaultVisionCardLevel = 10;
    this.useElementConditionedMateria = false;
    this.farmableStmrs = {};
  }

  /** The build being edited (builds[currentUnitIndex] on the page): read at every use, it changes. */
  get currentBuild() {
    return this.context.currentBuild();
  }

  get ownedUnits() {
    return this.context.ownedUnits();
  }

  get itemEnchantments() {
    return this.context.itemEnchantments();
  }

  setData(data) {
    this.data = data ? data : [];
    this.prepareAllItemsVersion();
  }

  setDefaultWeaponEnhancement(defaultWeaponEnhancement) {
    this.defaultWeaponEnhancement = defaultWeaponEnhancement;
  }

  prepareAllItemsVersion() {
    this.allItemVersions = {};
    this.itemWithVariation = {};
    this.farmableStmrs = computeFarmableStmr(this.data, this.ownedUnits, this.itemInventory);
    var currentId: any = 0;
    var currentItemVersions: any = [];
    for (var index: any = 0, len = this.data.length; index < len; index++) {
      var item: any = this.data[index];
      item.meanDamageVariance = 1;
      if (item.damageVariance) {
        item.damageVariance.avg = (item.damageVariance.min + item.damageVariance.max) / 2;
        item.meanDamageVariance = item.damageVariance.avg;
      }
      if (item.id !== currentId) {
        if (
          currentItemVersions.length > 1 ||
          (currentItemVersions.length == 1 && currentItemVersions[0].equipedConditions)
        ) {
          this.itemWithVariation[currentId] = currentItemVersions;
        }
        this.allItemVersions[currentId] = currentItemVersions;
        currentId = item.id;
        currentItemVersions = [];
      }
      currentItemVersions.push(item);
    }
    if (currentItemVersions.length > 1) {
      this.itemWithVariation[currentId] = currentItemVersions;
    }
    this.allItemVersions[currentId] = currentItemVersions;
  }

  setItemsToExclude(itemsToExclude) {
    this.itemsToExclude = itemsToExclude;
  }

  setUnitBuild(unitBuild) {
    this.unitBuild = unitBuild;
    this.desirableElements = [];
    this.desiredEquipmentType = [];
    for (var index: any = 0, len = this.unitBuild.unit.skills.length; index < len; index++) {
      var skill: any = this.unitBuild.unit.skills[index];
      if (skill.equipedConditions) {
        for (var i: any = skill.equipedConditions.length; i--;) {
          var condition: any = skill.equipedConditions[i];
          if (elementList.includes(condition)) {
            if (!this.desirableElements.includes(condition)) {
              this.desirableElements.push(skill.equipedConditions[0]);
            }
          } else if (!this.desiredEquipmentType.includes(condition)) {
            this.desiredEquipmentType.push(condition);
          }
        }
      }
    }
    if (this.unitBuild._formula) {
      this.addDesirableElementsFromFormula(this.unitBuild._formula);
    }
    this.prepareAllItemsVersion();
  }

  addDesirableElementsFromFormula(formula) {
    return addDesirableElementsFromFormula(this, formula);
  }

  addDesirableElementsFromImperilInFormula(formula) {
    return addDesirableElementsFromImperilInFormula(this, formula);
  }

  addDesirableElementsFromItems(enemyStats) {
    return addDesirableElementsFromItems(this, enemyStats);
  }

  prepareData(itemsToExclude, enemyStats, elementBuffs, formula) {
    return prepareData(this, itemsToExclude, enemyStats, elementBuffs, formula);
  }

  /*addEntriesToResult(tree, result, keptNumber, keepEntry) {
        tree.equivalents.sort(function(entry1, entry2) {
            if (entry1.defenseValue == entry2.defenseValue) {
                if (entry2.available == entry1.available) {
                    return getValue(entry2.item, "atk%") + getValue(entry2.item, "mag%") + getValue(entry2.item, "atk") + getValue(entry2.item, "mag") - (getValue(entry1.item, "atk%") + getValue(entry1.item, "mag%") + getValue(entry1.item, "atk") + getValue(entry1.item, "mag"))
                } else {
                    return entry2.available - entry1.available;    
                }
            } else {
                return entry2.defenseValue - entry1.defenseValue;    
            }
        });
        for (var index: any = 0, len = tree.equivalents.length; index < len; index++) {
            if (keepEntry) {
                result.push(tree.equivalents[index]);
            } else {
                result.push(tree.equivalents[index].item);
            }
        }
        for (var index: any = 0, len = tree.children.length; index < len; index++) {
            this.addEntriesToResult(tree.children[index], result, keptNumber, keepEntry);    
        }
    }*/

  getItemEntry(item, availableNumber: any = null, owned = false) {
    let ownedNumber = 0;
    if (owned) {
      ownedNumber = this.getOwnedNumber(item).totalOwnedNumber;
    }
    return {
      item: item,
      name: item.name,
      defenseValue: this.getDefenseValue(item),
      mpValue: this.getMpValue(item),
      available: availableNumber || this.getAvailableNumbers(item).available,
      owned: owned,
      ownedNumber: ownedNumber,
    };
  }

  getDefenseValue(item) {
    var hpBaseValue: any = this.unitBuild.baseValues.hp.total;
    var defBaseValue: any = this.unitBuild.baseValues.def.total;
    var sprBaseValue: any = this.unitBuild.baseValues.spr.total;
    return (
      this.getStatValueIfExists(item, 'hp', hpBaseValue) +
      this.getStatValueIfExists(item, 'def', defBaseValue) +
      this.getStatValueIfExists(item, 'spr', sprBaseValue)
    );
  }

  getMpValue(item) {
    return this.getStatValueIfExists(item, 'mp', this.unitBuild.baseValues.mp.total);
  }

  getStatValueIfExists(item, stat, baseStat) {
    var result: any = 0;
    if (item[stat]) result += item[stat];
    if (item[percentValues[stat]]) result += (item[percentValues[stat]] * baseStat) / 100;
    return result;
  }

  prepareItem(
    item,
    baseValues,
    enemyStats,
    elementBuffs,
    availableNumber,
    ownedAvailableNumber,
    adventurersAvailable,
    alreadyAddedIds,
    equipable,
    pinnedItemIds,
    tmrAbilityEnhancedItem = false,
  ) {
    return prepareItem(
      this,
      item,
      baseValues,
      enemyStats,
      elementBuffs,
      availableNumber,
      ownedAvailableNumber,
      adventurersAvailable,
      alreadyAddedIds,
      equipable,
      pinnedItemIds,
      tmrAbilityEnhancedItem,
    );
  }

  addToWeaponsByTypeAndHands(item) {
    return addToWeaponsByTypeAndHands(this, item);
  }

  itemCanBeOfUseForGoal(item, enemyStats, elementBuffs = {}) {
    return itemCanBeOfUseForGoal(this, item, enemyStats, elementBuffs);
  }

  itemWithUnstackableSkillOnlyUsefulInOne(item, enemyStats, elementBuffs) {
    return itemWithUnstackableSkillOnlyUsefulInOne(this, item, enemyStats, elementBuffs);
  }

  removeStat(item, stat, value) {
    return removeStat(this, item, stat, value);
  }

  getAvailableNumbers(item) {
    return getAvailableNumbers(this, item);
  }

  getOwnedNumber(item) {
    return getOwnedNumber(this, item);
  }

  getOwnedCardNumber(cardId: string) {
    return getOwnedCardNumber(this, cardId);
  }

  /** The items the other builds of the page use (`builds` and `currentUnitIndex` are only for a page with a single build). */
  calculateAlreadyUsedItems(builds, currentUnitIndex) {
    const all = this.context.allBuilds();
    return calculateAlreadyUsedItems(this, all ? all.builds : builds, all ? all.index : currentUnitIndex);
  }
}
