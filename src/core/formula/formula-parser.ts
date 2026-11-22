import {
  baseVariables,
  elementVariables,
  operators,
  booleanResultOperators,
  operatorPrecedence,
  attributeByVariable,
  formulaByVariable,
  abbreviations,
} from './formula-data.js';
import { hasStack } from './formula-queries.js';

/** A formula the user typed cannot be understood. The message is meant to be shown to the user as is. */
export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

// shortcut: parser state kept at module level (the code is synchronous), as it was; pass it explicitly if parsing ever becomes concurrent
let elementVariablesUsed: any[] = [];
let caracts: any[] = [];

export function parseFormula(formula, unit) {
  formula = formula.toUpperCase();
  formula = formula.replace('MAXIMIZE', '');
  formula = formula.replace('WITH', ';');
  formula = formula.replace('|', ' OR ');
  elementVariablesUsed = [];
  caracts = [];
  var result;

  for (var abbreviation in abbreviations) {
    formula = formula.replace(abbreviation, abbreviations[abbreviation]);
  }

  if (formula == 'EMPTY FORMULA') {
    formula = 'P_DAMAGE'; // in case of empty formula, consider it the default formula
  }

  var separatorIndex = formula.indexOf(';');
  if (separatorIndex == -1) {
    var parsedFormula = parseExpression(formula, 0, unit);
    if (booleanResultOperators.includes(parsedFormula.type)) {
      throw new FormulaError('Maximize goal must result to a value, not to a boolean');
    }
    result = parsedFormula;
  } else {
    var parsedFormula = parseExpression(formula.substr(0, separatorIndex), 0, unit);
    var condition = parseExpression(
      formula
        .substr(separatorIndex + 1)
        .split(';')
        .join(' ; '),
      separatorIndex + 1,
      unit,
    );

    if (booleanResultOperators.includes(parsedFormula.type)) {
      throw new FormulaError('Maximize goal must result to a value, not to a boolean');
    }
    if (parsedFormula && condition) {
      result = { type: 'condition', condition: condition, formula: parsedFormula };
      if (elementVariablesUsed.length > 0) {
        result.elements = elementVariablesUsed;
      }
    }
  }
  if (caracts.includes('stack')) {
    result.stack = true;
  }
  return result;
}

export function parseExpression(formula, pos, unit) {
  var currentVar = '';
  var outputQueue: any[] = [];
  var operatorStack: any[] = [];
  var tokenInfo;
  while ((tokenInfo = getNextToken(formula))) {
    var token = tokenInfo.token;

    if (token.startsWith('MULTICAST(') && token.endsWith(')')) {
      var skills = token
        .substr(10, token.length - 11)
        .split(',')
        .map((x) => x.trim())
        .map((x) => getFormulaFromSkillToken(x, unit, true));
      outputQueue.push({ type: 'multicast', skills: skills });
    } else if (token.startsWith('SKILL(') && token.endsWith(')')) {
      var skillFormula = getFormulaFromSkillToken(token, unit);
      if (skillFormula) {
        outputQueue.push(skillFormula);
      } else {
        throw new FormulaError('Error. skill not understood : ' + token);
      }
    } else if (token.startsWith('CHAIN_MULT(') && token.endsWith(')')) {
      let chainMult = token.substr(11, token.length - 12);
      if (chainMult != 'MAX') {
        chainMult = parseFloat(chainMult);
      }
      outputQueue.push({ type: 'chainMultiplier', value: chainMult });
    } else if (token == 'LB_DAMAGE') {
      outputQueue.push(formulaFromSkill(unit.lb));
    } else if (baseVariables.includes(token)) {
      if (formulaByVariable[attributeByVariable[token]]) {
        outputQueue.push(formulaByVariable[attributeByVariable[token]]);
      } else {
        outputQueue.push({ type: 'value', name: attributeByVariable[token] });
      }
    } else if (token.startsWith('LB_') && baseVariables.includes(token.substr(3))) {
      if (token.startsWith('LB_REPLACED')) {
        outputQueue.push({ type: 'value', name: attributeByVariable[token.substr(3)], lb: true, replacedLb: true });
      } else {
        outputQueue.push({ type: 'value', name: attributeByVariable[token.substr(3)], lb: true });
      }
    } else if (elementVariables.includes(token)) {
      var element = token.substr(2).toLocaleLowerCase().replace('thunder', 'lightning');
      outputQueue.push({ type: 'elementCondition', element: element });
      if (!elementVariablesUsed.includes(element) && element != 'none') {
        elementVariablesUsed.push(element);
      }
    } else if (!isNaN(Number(token))) {
      outputQueue.push({ type: 'constant', value: +token });
    } else if (operators.includes(token)) {
      while (
        operatorStack[operatorStack.length - 1] != '(' &&
        operatorPrecedence[operatorStack[operatorStack.length - 1]] >= operatorPrecedence[token]
      ) {
        popOperator(operatorStack, outputQueue);
      }
      operatorStack.push(token);
    } else if (token == '(') {
      operatorStack.push(token);
    } else if (token == ')') {
      while (operatorStack[operatorStack.length - 1] != '(') {
        popOperator(operatorStack, outputQueue);
      }
      if (operatorStack[operatorStack.length - 1] == '(') {
        operatorStack.pop();
      } else {
        throw new FormulaError('Error. Mismatched parentheses.');
      }
    } else {
      throw new FormulaError('Error at position ' + pos + '. ' + token + ' is not a valid variable.');
    }
    formula = formula.substr(tokenInfo.read);
    pos += tokenInfo.read;
  }
  while (operatorStack.length > 0) {
    if (operatorStack[operatorStack.length - 1] == '(') {
      throw new FormulaError('Error. Mismatched parentheses.');
    } else {
      popOperator(operatorStack, outputQueue);
    }
  }
  if (outputQueue.length != 1) {
    throw new FormulaError('Error. Malformed expression.');
  }
  return outputQueue[0];
}

export function getFormulaFromSkillToken(token, unit, multicast = false) {
  if (token.startsWith('SKILL(') && token.endsWith(')')) {
    var upgradeTriggerUsed = false;
    var skillName = token.substr(6, token.length - 7);
    var skill = getSkillFromName(skillName, unit);
    if (!skill) {
      skill = getSkillFromId(skillName, unit);
    }
    return formulaFromSkill(skill, multicast);
  } else {
    return null;
  }
}

export function getNextToken(formula) {
  var currentVar = '';
  var pos = 0;
  var readingFunction = false;
  var openedBracketInFunction = 0;
  while (pos < formula.length) {
    var char = formula.substr(pos, 1);
    pos++;
    if (!readingFunction && char == ' ') {
      if (currentVar.length != 0) {
        return { token: currentVar, read: pos - 1 };
      }
      continue;
    }
    if (!readingFunction && (operators.includes(char) || char === '(' || char === ')')) {
      if (currentVar.length != 0) {
        if ((currentVar == 'MULTICAST' || currentVar == 'SKILL' || currentVar == 'CHAIN_MULT') && char === '(') {
          readingFunction = true;
          currentVar += char;
        } else {
          return { token: currentVar, read: pos - 1 };
        }
      } else {
        return { token: char, read: pos };
      }
    } else {
      currentVar += char;
      if (readingFunction) {
        if (char == '(') {
          openedBracketInFunction++;
        } else if (char == ')') {
          if (openedBracketInFunction == 0) {
            return { token: currentVar, read: pos };
          } else {
            openedBracketInFunction--;
          }
        }
      }
    }
  }
  if (currentVar.length != 0) {
    return { token: currentVar, read: pos };
  } else {
    null;
  }
}

export function popOperator(operatorStack, outputQueue) {
  var operator = operatorStack.pop();
  if (outputQueue.length < 2) {
    throw new FormulaError('Error. Malformed expression.');
  }
  var value2 = outputQueue.pop();
  var value1 = outputQueue.pop();
  if (operator == ';') {
    operator = 'AND';
  }
  if (operator == 'OR' || operator == 'AND') {
    if (value1.type != 'elementCondition' && !booleanResultOperators.includes(value1.type)) {
      throw new FormulaError('Error. Left part of a ' + operator + ' must evaluate to a boolean.');
    }
    if (value2.type != 'elementCondition' && !booleanResultOperators.includes(value2.type)) {
      throw new FormulaError('Error. Right part of a ' + operator + ' must evaluate to a boolean.');
    }
  } else if (operator == '>') {
    if (value1.type != 'value' && value1.type != 'skill' && !operators.includes(value1.type)) {
      throw new FormulaError('Error. Left part of a ' + operator + ' must evaluate to a value.');
    }
    if (value2.type != 'constant') {
      if (!(
        value1.type === 'value' &&
        value1.name === 'hp' &&
        value2.type === 'value' &&
        value2.name === 'monsterDamage'
      )) {
        throw new FormulaError('Error. Right part of a ' + operator + ' must evaluate to a constant.');
      }
    }
  } else {
    if (booleanResultOperators.includes(value1.type)) {
      throw new FormulaError('Error. Left part of a ' + operator + ' must not evaluate to a boolean.');
    }
    if (booleanResultOperators.includes(value2.type)) {
      throw new FormulaError('Error. Right part of a ' + operator + ' must not evaluate to a boolean.');
    }
  }
  outputQueue.push({ type: operator, value1: value1, value2: value2 });
}

export function parseConstant(formula, pos) {
  while (formula.startsWith(' ')) {
    formula = formula.substr(1);
    pos++;
  }
  formula = formula.trim();
  if (!isNaN(Number(formula))) {
    return { type: 'constant', value: +formula };
  }
  throw new FormulaError('Error at position ' + pos + '. Expected constant.');
}

export function getSkillFromName(skillName, unitWithSkills) {
  if (skillName.endsWith('_UPGRADED')) {
    skillName = skillName.substr(0, skillName.length - 9);
  }
  skillName = skillName.toLocaleUpperCase();
  var skill;
  if (unitWithSkills.lb.name.toLocaleUpperCase() == skillName) {
    skill = unitWithSkills.lb;
  } else {
    for (var i = unitWithSkills.actives.length; i--;) {
      if (unitWithSkills.actives[i].name.toLocaleUpperCase() == skillName) {
        skill = unitWithSkills.actives[i];
        break;
      }
    }
    if (!skill) {
      for (var i = unitWithSkills.magics.length; i--;) {
        if (unitWithSkills.magics[i].name.toLocaleUpperCase() == skillName) {
          skill = unitWithSkills.magics[i];
          break;
        }
      }
    }
    if (!skill) {
      for (var i = unitWithSkills.passives.length; i--;) {
        if (unitWithSkills.passives[i].name.toLocaleUpperCase() == skillName) {
          skill = unitWithSkills.passives[i];
          break;
        }
      }
    }
  }
  return skill;
}

export function getSkillFromId(skillId, unitWithSkills) {
  var skill;

  for (var i = unitWithSkills.actives.length; i--;) {
    if (unitWithSkills.actives[i].id == skillId) {
      skill = unitWithSkills.actives[i];
      break;
    }
  }
  if (!skill) {
    for (var i = unitWithSkills.magics.length; i--;) {
      if (unitWithSkills.magics[i].id == skillId) {
        skill = unitWithSkills.magics[i];
        break;
      }
    }
  }
  if (!skill) {
    for (var i = unitWithSkills.passives.length; i--;) {
      if (unitWithSkills.passives[i].id == skillId) {
        skill = unitWithSkills.passives[i];
        break;
      }
    }
  }
  return skill;
}

export function formulaFromSkill(skill, multicast = false, isLb = false) {
  var canBeGoal = false;
  var hasStack = false;
  var isUpgradable = false;
  var formula;

  var effects;
  if (skill.maxEffects) {
    effects = skill.maxEffects;
    isLb = true;
  } else {
    effects = skill.effects;
  }
  for (var i = 0, len = effects.length; i < len; i++) {
    if (!effects[i].effect) {
      if (effects.length === 1) {
        return { type: 'skill', id: skill.id, name: skill.name, notSupported: true };
      } else {
        continue;
      }
    }
    var formulaToAdd = formulaFromEffect(effects[i], multicast);
    if (formulaToAdd) {
      if (formulaToAdd.notSupported) {
        return { type: 'skill', id: skill.id, name: skill.name, notSupported: true };
      }
      if (formulaToAdd.type == 'damage' || formulaToAdd.type == 'heal' || formulaToAdd.type == 'skill') {
        canBeGoal = true;
      }
      if (formulaToAdd.value.stack) {
        hasStack = true;
      }
      if (!formula) {
        formula = formulaToAdd;
      } else {
        formula = {
          type: '+',
          value1: formula,
          value2: formulaToAdd,
        };
      }
    }
  }
  if (formula) {
    formula = { type: 'skill', id: skill.id, name: skill.name, value: formula, stack: hasStack, lb: isLb };
    if (skill.preventDualCastWithDualWield) {
      formula.preventDualCastWithDualWield = true;
    }
  }
  if (canBeGoal || multicast) {
    if (hasStack && !caracts.includes('stack')) {
      caracts.push('stack');
    }
    return formula;
  }
  return null;
}

export function formulaFromEffect(effect, multicast = false) {
  if (effect.effect.damage) {
    var damage = effect.effect.damage;
    if (damage.mechanism === 'none' || damage.mechanism === undefined) {
      // Not an attack on enemies: HP cost to the caster, or a token damage to an ally that only carries buffs.
      if (effect.effect.target === 'SELF' || effect.effect.target === 'ALLY') {
        return null;
      }
      // The game data gives attack type "None" (the wiki's Fixed attack type) and no mechanism: the damage type
      // tells the stat. Fixed ignores killers, dual wield and weapon elements (formula.value.fixedAttack).
      // Missing damageType means a hybrid. The data itself is left untouched: copy.
      var mechanismByDamageType = { body: 'physical', mind: 'magical' };
      var mechanism = mechanismByDamageType[damage.damageType] || (damage.mechanism === 'none' ? 'hybrid' : undefined);
      if (mechanism) {
        damage = Object.assign({}, damage, { mechanism: mechanism });
        if (effect.effect.damage.mechanism === 'none') {
          damage.fixedAttack = true;
        }
      }
    }
    return { type: 'damage', value: damage };
  } else if (effect.effect.imperil) {
    return {
      type: 'imperil',
      value: effect.effect.imperil,
    };
  } else if (effect.effect.statsBuff) {
    return {
      type: 'statsBuff',
      value: effect.effect.statsBuff,
    };
  } else if (effect.effect.break) {
    return {
      type: 'break',
      value: effect.effect.break,
    };
  } else if (effect.effect.imbue) {
    return {
      type: 'imbue',
      value: effect.effect.imbue,
    };
  } else if (effect.effect.killers) {
    return {
      type: 'killers',
      value: effect.effect,
    };
  } else if (effect.effect.heal) {
    return {
      type: 'heal',
      value: effect.effect.heal,
    };
  } else if (effect.effect.skillEnhancement) {
    return {
      type: 'skillEnhancement',
      value: effect.effect.skillEnhancement,
    };
  } else if (effect.effect.cooldownSkill) {
    return formulaFromSkill(effect.effect.cooldownSkill, multicast);
  } else if (effect.effect.berserk) {
    return {
      type: 'berserk',
      value: effect.effect.berserk.percent,
      duration: effect.effect.berserk.duration,
    };
  }

  return null;
}
