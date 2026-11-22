import { attributeByVariable, abbreviations } from './formula-data.js';

export function formulaToString(formula, addPrefix = true) {
  if (!formula) {
    return 'EMPTY FORMULA';
  }
  let result = '';
  if (addPrefix) {
    result += 'Maximize ';
  }
  result += innerFormulaToString(formula);
  return result;
}

export function innerFormulaToString(formula, useParentheses = false) {
  if (formula.type == 'skill') {
    if (formula.lb) {
      return 'LB_DAMAGE';
    } else if (formula.formulaName) {
      return getVariableName(formula.formulaName);
    } else {
      return 'SKILL(' + formula.id + ')';
    }
  } else if (formula.type == 'multicast') {
    return 'MULTICAST(' + formula.skills.map(innerFormulaToString).join(',') + ')';
  } else if (formula.type == 'value') {
    var name = getVariableName(formula.name);
    if (formula.lb) {
      if (formula.replacedLb) {
        name = 'LB_REPLACED_' + name;
      } else {
        name = 'LB_' + name;
      }
    }
    return name;
  } else if (formula.type == 'constant') {
    return formula.value.toString();
  } else if (formula.type == 'chainMultiplier') {
    return 'CHAIN_MULT(' + formula.value + ')';
  } else if (formula.type == 'elementCondition') {
    return 'E_' + formula.element.replace('lightning', 'thunder').toUpperCase();
  } else if (formula.type == 'condition') {
    var result = innerFormulaToString(formula.formula) + ' with ' + innerFormulaToString(formula.condition);
    for (var abbreviation in abbreviations) {
      result = result.replace(abbreviations[abbreviation], abbreviation);
    }
    result = result.replace(abbreviations['I_AILMENTS'], 'I_AILMENTS');
    return result;
  } else {
    let result = '';
    if (useParentheses) {
      result += '(';
    }
    result +=
      innerFormulaToString(formula.value1, true) +
      ' ' +
      formula.type +
      ' ' +
      innerFormulaToString(formula.value2, true);
    if (useParentheses) {
      result += ')';
    }
    return result;
  }
}

export function getVariableName(attribute) {
  for (var variable in attributeByVariable) {
    if (attributeByVariable[variable] == attribute) {
      return variable;
    }
  }
}
