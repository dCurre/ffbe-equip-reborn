import { isTwoHanded } from './item-values.js';
import { bodyList, headList, shieldList, weaponList } from '../constants/item-types.js';

export class TypeCombinationGenerator {
  forceDoubleHand: any;
  forceDualWield: any;
  unitBuild: any;
  dualWieldSources: any;
  equipSourcesByType: any;
  forceTmrAbility: any;
  dataStorage: any;
  dataByType: any;
  weaponsByTypeAndHands: any;
  tryEquipSources: any;

  /** `dataStorage` is read lazily (its available TMR/STMR are set by prepareData, after this object is created). */
  constructor(
    forceDoubleHand,
    forceDualWield,
    tryEquipSources,
    unitBuild,
    dualWieldSources,
    equipSources,
    dataByType,
    weaponsByTypeAndHands,
    forceTmrAbility = false,
    dataStorage?,
  ) {
    this.forceDoubleHand = forceDoubleHand;
    this.forceDualWield = forceDualWield;
    this.unitBuild = unitBuild;
    this.dualWieldSources = dualWieldSources;
    this.equipSourcesByType = {};
    this.forceTmrAbility = forceTmrAbility;
    this.dataStorage = dataStorage;
    for (var index: any = equipSources.length; index--;) {
      let allowUseOfs = equipSources[index].allowUseOf;
      if (!Array.isArray(equipSources[index].allowUseOf)) {
        allowUseOfs = [allowUseOfs];
      }
      allowUseOfs.forEach((allowUseOf) => {
        if (!this.equipSourcesByType[allowUseOf]) {
          this.equipSourcesByType[allowUseOf] = [];
        }
        if (!this.equipSourcesByType[allowUseOf].map((i) => i.id).includes(equipSources[index].id)) {
          this.equipSourcesByType[allowUseOf].push(equipSources[index]);
        }
      });
    }
    this.dataByType = dataByType;
    this.weaponsByTypeAndHands = weaponsByTypeAndHands;
    this.tryEquipSources = tryEquipSources;
  }

  generateTypeCombinations(forcedItem) {
    var combinations: any = [];
    const baseForcedItems = forcedItem ? [forcedItem] : [];

    if (this.forceTmrAbility && !forcedItem) {
      let tmrPinned =
        this.dataStorage.availableTmr &&
        this.unitBuild.fixedItems.some((i) => i && i.id === this.dataStorage.availableTmr.id);
      let stmrPinned =
        this.dataStorage.availableStmr &&
        this.unitBuild.fixedItems.some((i) => i && i.id === this.dataStorage.availableStmr.id);

      if (!tmrPinned && !stmrPinned) {
        if (
          this.dataStorage.availableTmr &&
          !this.unitBuild.bannedEquipableTypes.includes(this.dataStorage.availableTmr.type)
        ) {
          combinations = combinations.concat(this.generateTypeCombinations(this.dataStorage.availableTmr));
        }
        if (
          this.dataStorage.availableStmr &&
          !this.unitBuild.bannedEquipableTypes.includes(this.dataStorage.availableStmr.type)
        ) {
          combinations = combinations.concat(this.generateTypeCombinations(this.dataStorage.availableStmr));
        }
        return combinations;
      }
    }

    let forcedItemSlot = -1;
    if (forcedItem) {
      forcedItemSlot = this.unitBuild.getItemSlotFor(forcedItem, this.forceDoubleHand);
      if (forcedItemSlot === -1) {
        return [];
      }
      this.unitBuild.fixedItems = this.unitBuild.fixedItems.slice();
      this.unitBuild.fixedItems[forcedItemSlot] = forcedItem;
    }

    var typeCombination: any = Array(11).fill(null);
    this.buildTypeCombination(0, typeCombination, combinations, baseForcedItems);
    this.unitBuild.build.splice(0, 11, ...this.unitBuild.fixedItems);

    if (
      !this.unitBuild.build[0] &&
      !this.unitBuild.build[1] &&
      this.unitBuild.unit.skills.some((skill) => skill.equipedConditions && skill.equipedConditions.includes('unarmed'))
    ) {
      // If no weapons are pinned and the unit has an "unarmed" passive, try combinations without weapons
      this.buildTypeCombination(2, Array(11).fill(null), combinations, baseForcedItems);
    }

    var unitPartialDualWield: any = this.unitBuild.getPartialDualWield();
    if (unitPartialDualWield) {
      unitPartialDualWield = unitPartialDualWield.filter((type) => !this.unitBuild.bannedEquipableTypes.includes(type));
      if (!unitPartialDualWield.length) {
        unitPartialDualWield = null;
      }
    }
    if (
      !this.forceDoubleHand &&
      unitPartialDualWield &&
      (!this.unitBuild.fixedItems[0] || unitPartialDualWield.includes(this.unitBuild.fixedItems[0].type))
    ) {
      // Only try partial dual wield if no weapon fixed, or one weapon fixed of the partial dual wield type
      var savedEquipable0: any = this.unitBuild.equipable[0];
      var savedEquipable1: any = this.unitBuild.equipable[1];

      this.unitBuild.equipable[0] = unitPartialDualWield;
      this.unitBuild.equipable[1] = unitPartialDualWield;
      this.buildTypeCombination(0, typeCombination, combinations, baseForcedItems);

      this.unitBuild.equipable[0] = savedEquipable0;
      this.unitBuild.equipable[1] = savedEquipable1;
    }
    if (
      !this.forceDoubleHand &&
      !this.unitBuild.hasDualWield() &&
      !(this.unitBuild.fixedItems[0] && isTwoHanded(this.unitBuild.fixedItems[0]))
    ) {
      // If TMR grants DW
      var tmr: any = this.dataStorage.availableTmr;
      if (tmr && this.unitBuild.hasDualWieldIfItemEquiped(tmr.id)) {
        this.buildWithDualWieldGrantingItem(tmr, typeCombination, combinations, baseForcedItems);
      }

      // If STMR grants DW
      var stmr: any = this.dataStorage.availableStmr;
      if (stmr && this.unitBuild.hasDualWieldIfItemEquiped(stmr.id)) {
        this.buildWithDualWieldGrantingItem(stmr, typeCombination, combinations, baseForcedItems);
      }

      if (this.dualWieldSources.length > 0) {
        var savedForceDualWield: any = this.forceDualWield;
        this.forceDualWield = true;
        var equipableList: any = this.unitBuild.getCurrentUnitEquip();
        for (var dualWieldSourceIndex: any = this.dualWieldSources.length; dualWieldSourceIndex--;) {
          var item: any = this.dualWieldSources[dualWieldSourceIndex];
          if (equipableList.includes(item.type)) {
            var slot: any = this.unitBuild.getItemSlotFor(item, this.forceDoubleHand);
            if (slot != -1) {
              this.buildWithFixedItem(
                item,
                slot,
                item,
                item.partialDualWield,
                typeCombination,
                combinations,
                baseForcedItems,
              );
            }
          }
        }
        this.forceDualWield = savedForceDualWield;
      }
    }

    if (forcedItemSlot != -1) {
      this.unitBuild.fixedItems[forcedItemSlot] = null;
    }
    return combinations;
  }

  // Builds the combinations with every version of the TMR/STMR pinned, since it grants dual wield
  buildWithDualWieldGrantingItem(item, typeCombination, combinations, baseForcedItems) {
    var savedForceDualWield: any = this.forceDualWield;
    this.forceDualWield = true;
    var slot: any = this.unitBuild.getItemSlotFor(item, this.forceDoubleHand);
    if (slot != -1) {
      this.dataByType[item.type]
        .filter((entry) => entry.item.id == item.id)
        .forEach((version) => {
          this.buildWithFixedItem(version.item, slot, item, null, typeCombination, combinations, baseForcedItems);
        });
    }
    this.forceDualWield = savedForceDualWield;
  }

  // Builds the combinations with `fixedItem` pinned to `slot`, both hands using the partial dual wield types (or the right hand ones)
  buildWithFixedItem(fixedItem, slot, forcedItem, partialDualWield, typeCombination, combinations, baseForcedItems) {
    var savedFixedItems: any = this.unitBuild.fixedItems;
    this.unitBuild.fixedItems = this.unitBuild.fixedItems.slice();
    this.unitBuild.fixedItems[slot] = fixedItem;
    var savedEquipable0: any = this.unitBuild.equipable[0];
    var savedEquipable1: any = this.unitBuild.equipable[1];
    if (partialDualWield) {
      this.unitBuild.equipable[0] = partialDualWield;
      this.unitBuild.equipable[1] = partialDualWield;
    } else {
      this.unitBuild.equipable[1] = this.unitBuild.equipable[0];
    }

    let forcedItems;
    if (baseForcedItems.map((i) => i.id).includes(forcedItem.id)) {
      forcedItems = baseForcedItems;
    } else {
      forcedItems = baseForcedItems.concat([forcedItem]);
    }

    this.buildTypeCombination(0, typeCombination, combinations, forcedItems);
    this.unitBuild.fixedItems = savedFixedItems;
    this.unitBuild.equipable[0] = savedEquipable0;
    this.unitBuild.equipable[1] = savedEquipable1;
  }

  buildTypeCombination(index, typeCombination, combinations, forcedItems) {
    if (this.unitBuild.fixedItems[index]) {
      if (this.unitBuild.fixedItems[index].type == 'unavailable') {
        this.tryType(index, typeCombination, null, combinations, forcedItems);
      } else if (
        this.unitBuild.equipable[index].length > 0 &&
        this.unitBuild.equipable[index].includes(this.unitBuild.fixedItems[index].type)
      ) {
        this.tryType(index, typeCombination, this.unitBuild.fixedItems[index].type, combinations, forcedItems);
      } else {
        return;
      }
    } else {
      if (this.unitBuild.equipable[index].length > 0) {
        if (
          index == 1 &&
          ((this.unitBuild.fixedItems[0] && isTwoHanded(this.unitBuild.fixedItems[0])) || this.forceDoubleHand)
        ) {
          // if a two-handed weapon was fixed, no need to try smething in the second hand
          this.tryType(index, typeCombination, null, combinations, forcedItems);
        } else {
          var found: any = false;
          for (var typeIndex: any = 0, len = this.unitBuild.equipable[index].length; typeIndex < len; typeIndex++) {
            var type: any = this.unitBuild.equipable[index][typeIndex];
            if (
              index == 1 &&
              !this.unitBuild.fixedItems[0] &&
              this.alreadyTriedInSlot0(type, typeCombination[0], this.unitBuild.equipable[0])
            ) {
              continue;
            }
            if (this.dataByType[type].length > 0) {
              this.tryType(index, typeCombination, type, combinations, forcedItems);
              found = true;
            }
          }
          if (!found) {
            this.tryType(index, typeCombination, null, combinations, forcedItems);
          } else if (index == 1 && !this.forceDualWield) {
            this.tryType(index, typeCombination, null, combinations, forcedItems);
          }
        }
      } else {
        this.tryType(index, typeCombination, null, combinations, forcedItems);
      }
      if (this.tryEquipSources && index < 4) {
        var typesToTry: any = this.getEquipSourceToTry(index);
        for (var typeIndex: any = 0, lenType = typesToTry.length; typeIndex < lenType; typeIndex++) {
          var typeToTry: any = typesToTry[typeIndex];
          if (this.equipSourcesByType[typeToTry] && !this.unitBuild.bannedEquipableTypes.includes(typeToTry)) {
            for (
              var equipSourceIndex: any = 0, lenEquipSources = this.equipSourcesByType[typeToTry].length;
              equipSourceIndex < lenEquipSources;
              equipSourceIndex++
            ) {
              var equipSource: any = this.equipSourcesByType[typeToTry][equipSourceIndex];
              var slot: any = this.unitBuild.getItemSlotFor(equipSource, this.forceDoubleHand);
              if (slot >= 0) {
                let savedEquipable = this.unitBuild.equipable.slice();
                let allowUseOfs = equipSource.allowUseOf;
                if (!Array.isArray(allowUseOfs)) {
                  allowUseOfs = [allowUseOfs];
                }
                allowUseOfs.forEach((type) => {
                  if (type != typeToTry) {
                    if (
                      index == 0 &&
                      weaponList.includes(type) &&
                      !this.unitBuild.equipable[1].includes(type) &&
                      this.unitBuild.hasDualWield()
                    ) {
                      this.unitBuild.equipable[1] = this.unitBuild.equipable[1].concat([type]);
                    } else if (shieldList.includes(type) && !this.unitBuild.equipable[1].includes(type)) {
                      this.unitBuild.equipable[1] = this.unitBuild.equipable[1].concat([type]);
                    } else if (headList.includes(type) && !this.unitBuild.equipable[2].includes(type)) {
                      this.unitBuild.equipable[2] = this.unitBuild.equipable[2].concat([type]);
                    } else if (bodyList.includes(type) && !this.unitBuild.equipable[3].includes(type)) {
                      this.unitBuild.equipable[3] = this.unitBuild.equipable[3].concat([type]);
                    }
                  }
                });
                var savedFixedItems: any = this.unitBuild.fixedItems;
                this.unitBuild.fixedItems = this.unitBuild.fixedItems.slice();
                this.unitBuild.fixedItems[slot] = equipSource;
                this.unitBuild.equipable[index] = this.unitBuild.equipable[index].concat([typeToTry]);
                this.tryType(index, typeCombination, typeToTry, combinations, forcedItems.concat([equipSource]));
                this.unitBuild.fixedItems = savedFixedItems;
                this.unitBuild.equipable = savedEquipable;
              }
            }
          }
        }
      }
    }
  }

  getEquipSourceToTry(index) {
    var typesToTry: any;
    var self: any = this;
    if (index == 0) {
      typesToTry = weaponList.filter(function (type) {
        return !self.unitBuild.equipable[index].includes(type);
      });
    } else if (index == 1) {
      typesToTry = [];
      if (this.unitBuild.hasDualWield()) {
        typesToTry = weaponList.filter(function (type) {
          return !self.unitBuild.equipable[index].includes(type);
        });
      }
      typesToTry = typesToTry.concat(
        shieldList.filter(function (type) {
          return !self.unitBuild.equipable[index].includes(type);
        }),
      );
    } else if (index == 2) {
      typesToTry = headList.filter(function (type) {
        return !self.unitBuild.equipable[index].includes(type);
      });
    } else if (index == 3) {
      typesToTry = bodyList.filter(function (type) {
        return !self.unitBuild.equipable[index].includes(type);
      });
    }
    return typesToTry;
  }

  alreadyTriedInSlot0(type, typeSlot0, equipableSlot0) {
    if (type == typeSlot0) {
      return false;
    }
    var indexOfTypeSlot0: any = equipableSlot0.indexOf(typeSlot0);
    if (indexOfTypeSlot0 >= 0) {
      for (var index: any = 0; index <= indexOfTypeSlot0; index++) {
        if (equipableSlot0[index] == type) {
          return true;
        }
      }
    }
    return false;
  }

  tryType(index, typeCombination, type, combinations, forcedItems) {
    if (index == 1 && this.forceDualWield && (type == null || !weaponList.includes(type))) {
      // if force dualwield, need 2 weapons
      return;
    }
    if (index == 1 && weaponList.includes(type) && weaponList.includes(typeCombination[0])) {
      if (!this.weaponsByTypeAndHands[typeCombination[0]][1]) {
        if (
          !this.unitBuild.fixedItems[0] ||
          (this.unitBuild.fixedItems[0].special && this.unitBuild.fixedItems[0].special.includes('twoHanded'))
        ) {
          return;
        }
      }
      if (!this.weaponsByTypeAndHands[type][1]) {
        if (
          !this.unitBuild.fixedItems[1] ||
          (this.unitBuild.fixedItems[1].special && this.unitBuild.fixedItems[1].special.includes('twoHanded'))
        ) {
          return;
        }
      }
    }
    if (index == 2 && forcedItems.length > 0) {
      let forcedHeadGear = forcedItems
        .map((i) => i.type)
        .filter((t) => headList.includes(t))
        .filter(this.onlyUnique);
      if (forcedHeadGear.length > 1) {
        return; // impossible to have more that one type of forced head gear;
      }
      if (forcedHeadGear.length == 1 && !forcedHeadGear.includes(type)) {
        return; // impossible to try a head gear type different than the forced one
      }
    }

    if (index == 3 && forcedItems.length > 0) {
      let forcedBodyGear = forcedItems
        .map((i) => i.type)
        .filter((t) => bodyList.includes(t))
        .filter(this.onlyUnique);
      if (forcedBodyGear.length > 1) {
        return; // impossible to have more that one type of forced body gear;
      }
      if (forcedBodyGear.length == 1 && !forcedBodyGear.includes(type)) {
        return; // impossible to try a body gear type different than the forced one
      }
    }
    typeCombination[index] = type;
    if (index == 10) {
      combinations.push({
        combination: typeCombination.slice(),
        fixedItems: this.unitBuild.fixedItems.slice(),
        forcedItems: forcedItems.map((i) => i.id),
      });
    } else {
      this.buildTypeCombination(index + 1, typeCombination, combinations, forcedItems);
    }
  }

  onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }
}
