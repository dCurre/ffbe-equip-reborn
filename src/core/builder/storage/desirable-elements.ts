import type { DataStorage } from '../data-storage.js';
import { elementList } from '../../constants/base-lists.js';

export function addDesirableElementsFromFormula(storage: DataStorage, formula) {
  if (storage.currentBuild.formula.type === 'condition' && storage.currentBuild.formula.elements) {
    for (var i: any = storage.currentBuild.formula.elements.length; i--;) {
      if (!storage.desirableElements.includes(storage.currentBuild.formula.elements[i])) {
        storage.desirableElements.push(storage.currentBuild.formula.elements[i]);
      }
    }
  }
  storage.addDesirableElementsFromImperilInFormula(formula);
}

export function addDesirableElementsFromImperilInFormula(storage: DataStorage, formula) {
  if (formula.type === 'multicast') {
    for (var i: any = formula.skills.length; i--;) {
      storage.addDesirableElementsFromImperilInFormula(formula.skills[i]);
    }
  } else if (formula.type === 'skill') {
    storage.addDesirableElementsFromImperilInFormula(formula.value);
  } else if (formula.type === 'imperil') {
    var elements: any = Object.keys(formula.value);
    if (elements.length === 8) {
      // Full imperil, ignore it
    } else {
      for (var i: any = elements.length; i--;) {
        if (!storage.desirableElements.includes(elements[i])) {
          storage.desirableElements.push(elements[i]);
        }
      }
    }
  } else if (formula.type === 'condition') {
    storage.addDesirableElementsFromImperilInFormula(formula.formula);
    storage.addDesirableElementsFromImperilInFormula(formula.condition);
  } else if (
    formula.type !== 'elementCondition' &&
    formula.type !== 'constant' &&
    formula.type !== 'chainMultiplier' &&
    formula.type !== 'break' &&
    formula.type !== 'imbue' &&
    formula.type !== 'statsBuff' &&
    formula.type !== 'value' &&
    formula.type !== 'damage' &&
    formula.type !== 'heal' &&
    formula.type !== 'killers' &&
    formula.type !== 'skillEnhancement' &&
    formula.type !== 'mitigation' &&
    formula.type !== 'berserk'
  ) {
    storage.addDesirableElementsFromImperilInFormula(formula.value1);
    storage.addDesirableElementsFromImperilInFormula(formula.value2);
  }
}

export function addDesirableElementsFromItems(storage: DataStorage, enemyStats) {
  storage.data.forEach((i) => {
    if (i.equipedConditions && storage.itemCanBeOfUseForGoal(i, enemyStats)) {
      i.equipedConditions.forEach((c) => {
        if (elementList.includes(c) && !storage.desirableElements.includes(c)) {
          storage.desirableElements.push(c);
        }
      });
    }
  });
}
