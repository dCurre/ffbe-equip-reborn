import { ailmentList, elementList } from '../constants/base-lists.js';
import { simpleImunityValues, simpleResistValues, simpleVariousValues } from './formula-data.js';

export function getSimpleConditions(formula) {
  var simpleConditions: any = {
    forcedElements: [],
    ailmentImunity: [],
    elementalResist: {},
    various: [],
  };

  if (formula && formula.type == 'condition') {
    innerGetSimpleConditions(formula.condition, simpleConditions);
  }
  return simpleConditions;
}

export function getChainMultiplier(formula) {
  let chainMultiplier = 1;
  if (formula) {
    if (formula.type == 'condition') {
      formula = formula.formula;
    }
    if (formula.type == '*' && formula.value1.type == 'chainMultiplier') {
      chainMultiplier = formula.value1.value;
    }
  }
  return chainMultiplier;
}

export function innerGetSimpleConditions(formula, simpleConditions) {
  switch (formula.type) {
    case '>':
      if (formula.value1.type == 'value' && formula.value2.type == 'constant') {
        if (formula.value1.name.startsWith('resist|') && formula.value1.name.endsWith('.percent')) {
          var resist = formula.value1.name.substr(7, formula.value1.name.length - 15);
          if (ailmentList.includes(resist) && formula.value2.value == 100) {
            if (!simpleConditions.ailmentImunity.includes(resist)) {
              simpleConditions.ailmentImunity.push(resist);
            }
          } else if (elementList.includes(resist)) {
            if (
              !simpleConditions.elementalResist[resist] ||
              simpleConditions.elementalResist[resist] < formula.value2.value
            ) {
              simpleConditions.elementalResist[resist] = formula.value2.value;
            }
          }
        } else if (formula.value1.name == 'evade.physical' && formula.value2.value == 100) {
          if (!simpleConditions.various.includes('evade.physical')) {
            simpleConditions.various.push('evade.physical');
          }
        } else if (formula.value1.name == 'accuracy' && formula.value2.value == 100) {
          if (!simpleConditions.various.includes('accuracy')) {
            simpleConditions.various.push('accuracy');
          }
        } else if (formula.value1.name == 'drawAttacks' && formula.value2.value == 100) {
          if (!simpleConditions.various.includes('drawAttacks')) {
            simpleConditions.various.push('drawAttacks');
          }
        }
      }
      break;
    case 'elementCondition':
      if (!simpleConditions.forcedElements.includes(formula.element)) {
        simpleConditions.forcedElements.push(formula.element);
      }
      break;
    case 'AND':
      innerGetSimpleConditions(formula.value1, simpleConditions);
      innerGetSimpleConditions(formula.value2, simpleConditions);
      break;
  }
}

export function makeSureFormulaHaveSimpleConditions(formula, simpleConditions) {
  var currentSimpleConditions = getSimpleConditions(formula);
  for (var i = simpleConditions.forcedElements.length; i--;) {
    if (!currentSimpleConditions.forcedElements.includes(simpleConditions.forcedElements[i])) {
      formula = addCondition(formula, { type: 'elementCondition', element: simpleConditions.forcedElements[i] });
      if (!formula.elements) {
        formula.elements = [];
      }
      if (!formula.elements.includes(simpleConditions.forcedElements[i])) {
        formula.elements.push(simpleConditions.forcedElements[i]);
      }
    }
  }
  for (var i = simpleConditions.ailmentImunity.length; i--;) {
    if (!currentSimpleConditions.ailmentImunity.includes(simpleConditions.ailmentImunity[i])) {
      formula = addCondition(formula, {
        type: '>',
        value1: {
          type: 'value',
          name: 'resist|' + simpleConditions.ailmentImunity[i] + '.percent',
        },
        value2: {
          type: 'constant',
          value: 100,
        },
      });
    }
  }
  var elements = Object.keys(simpleConditions.elementalResist);
  for (let i = elements.length; i--;) {
    if (
      !currentSimpleConditions.elementalResist[elements[i]] ||
      currentSimpleConditions.elementalResist[elements[i]] < simpleConditions.elementalResist[elements[i]]
    ) {
      formula = addCondition(formula, {
        type: '>',
        value1: {
          type: 'value',
          name: 'resist|' + elements[i] + '.percent',
        },
        value2: {
          type: 'constant',
          value: simpleConditions.elementalResist[elements[i]],
        },
      });
    }
  }
  for (var i = simpleConditions.various.length; i--;) {
    if (!currentSimpleConditions.various.includes(simpleConditions.various[i])) {
      formula = addCondition(formula, {
        type: '>',
        value1: {
          type: 'value',
          name: simpleConditions.various[i],
        },
        value2: {
          type: 'constant',
          value: 100,
        },
      });
    }
  }
  return formula;
}

export function addCondition(formula, condition) {
  if (formula.type != 'condition') {
    formula = {
      type: 'condition',
      formula: formula,
      condition: condition,
      elements: formula.elements,
    };
  } else {
    formula.condition = {
      type: 'AND',
      value1: condition,
      value2: formula.condition,
    };
  }
  return formula;
}

export function isSimpleFormula(formula) {
  switch (formula.type) {
    case 'condition':
      return isSimpleFormula(formula.formula) && isSimpleFormula(formula.condition);
    case 'multicast':
    case 'elementCondition':
    case 'skill':
      return true;
      break;
    case 'AND':
      return isSimpleFormula(formula.value1) && isSimpleFormula(formula.value2);
      break;
    case '>':
      if (formula.value1.type == 'value' && formula.value2.type == 'constant') {
        if (
          simpleImunityValues.includes(formula.value1.name) &&
          formula.value2.type == 'constant' &&
          formula.value2.value == 100
        ) {
          return true;
        } else if (simpleResistValues.includes(formula.value1.name)) {
          return true;
        } else if (
          simpleVariousValues.includes(formula.value1.name) &&
          formula.value2.type == 'constant' &&
          formula.value2.value == 100
        ) {
          return true;
        }
      }
      return false;
      break;
    case '*':
      if (formula.value1.type == 'chainMultiplier' && isSimpleFormula(formula.value2)) return true;
      if (formula.value1.type == 'value' && formula.value2.type == 'value') {
        if (formula.value1.name == 'hp' && formula.value2.name == 'def') return true;
        if (formula.value1.name == 'hp' && formula.value2.name == 'spr') return true;
        if (formula.value1.name == 'mp' && formula.value2.name == 'mpRefresh') return true;
      }
      return false;
    case '+':
      return (
        formula.value1.type == '/' &&
        formula.value2.type == '/' &&
        formula.value1.value1.type == 'value' &&
        formula.value1.value1.name == 'spr' &&
        formula.value1.value2.type == 'constant' &&
        formula.value1.value2.value == 2 &&
        formula.value2.value1.type == 'value' &&
        formula.value2.value1.name == 'mag' &&
        formula.value2.value2.type == 'constant' &&
        formula.value2.value2.value == 10
      );
    case 'value':
      return (
        !formula.lb &&
        (formula.name == 'hp' ||
          formula.name == 'mp' ||
          formula.name == 'atk' ||
          formula.name == 'def' ||
          formula.name == 'mag' ||
          formula.name == 'spr' ||
          formula.name == 'evade.physical' ||
          formula.name == 'evade.magical' ||
          formula.name == 'atkDamageWithFixedMechanism' ||
          formula.name == 'physicalDamageMultiCast' ||
          formula.name == 'fixedDamageWithPhysicalMechanism' ||
          formula.name == 'summonerSkillMAG/SPRMechanism' ||
          formula.name == 'summonerSkillSPRMechanism' ||
          formula.name == 'summonerSkillMAGMechanism' ||
          formula.name == 'mpMagPhysicalDamage' ||
          formula.name == 'mpMagMagicalDamage' ||
          formula.name == 'mpSprPhysicalDamage' ||
          formula.name == 'mpSprMagicalDamage')
      );
    default:
      return false;
  }
}
