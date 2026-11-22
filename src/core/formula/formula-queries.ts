export function isAttackFormula(formula) {
  switch (formula.type) {
    case '*':
    case '+':
      return isAttackFormula(formula.value1) && isAttackFormula(formula.value2);
    case 'constant':
      return true;
    case 'skill':
      return (
        !formula.lb &&
        (formula.formulaName == 'physicalDamage' ||
          formula.formulaName == 'magicalDamage' ||
          formula.formulaName == 'hybridDamage' ||
          formula.formulaName == 'fixedDamageWithPhysicalMechanism' ||
          formula.formulaName == 'atkDamageWithFixedMechanism')
      );
    default:
      return false;
  }
}

export function getSkillIds(formula) {
  if (formula.type == 'skill') {
    if (formula.id) {
    }
    return [formula.id];
  } else if (formula.type == 'multicast') {
    return formula.skills
      .map((skill) => getSkillIds(skill))
      .reduce((arr, ids) => {
        if (ids && ids.length > 0) {
          return [...arr, ...ids];
        } else {
          return arr;
        }
      }, []);
  } else if (formula.type == 'condition') {
    return getSkillIds(formula.formula).concat(getSkillIds(formula.condition));
  } else if (
    formula.type == 'value' ||
    formula.type == 'constant' ||
    formula.type == 'chainMultiplier' ||
    formula.type == 'elementCondition' ||
    formula.type == 'damage' ||
    formula.type == 'lbFill'
  ) {
    return [];
  } else {
    return getSkillIds(formula.value1).concat(getSkillIds(formula.value2));
  }
  return [];
}

export function getMulticastSkillAbleToMulticast(skills, unit) {
  for (var skillList of [unit.actives, unit.passives]) {
    for (var i = skillList.length; i--;) {
      var skill = skillList[i];
      for (var j = skill.effects.length; j--;) {
        if (skill.effects[j].effect && skill.effects[j].effect.multicast) {
          if (multicaEffectMatch(skill.effects[j].effect.multicast, skills)) {
            return skill;
          }
        }
      }
    }
  }
}

export function multicaEffectMatch(multicastEffect, skills) {
  if (multicastEffect.time === skills.length) {
    return skills.every((skill) => {
      if (
        multicastEffect.excludedSkills &&
        multicastEffect.excludedSkills.some((excludedSkill) => excludedSkill.id === skill.id)
      )
        return false;
      if (
        (skill.magic === 'white' && multicastEffect.type.includes('whiteMagic')) ||
        (skill.magic === 'green' && multicastEffect.type.includes('greenMagic')) ||
        (skill.magic === 'black' && multicastEffect.type.includes('blackMagic'))
      ) {
        return true;
      }
      if (!skill.magic && multicastEffect.type.includes('allSkills')) return true;
      if (multicastEffect.skills && multicastEffect.skills.some((includedSkill) => skill.id === includedSkill.id))
        return true;
      return false;
    });
  }
  return false;
}

export function hasMulticast(unit) {
  var actives = unit.actives;
  for (var i = actives.length; i--;) {
    var skill = actives[i];
    for (var j = skill.effects.length; j--;) {
      if (skill.effects[j].effect && skill.effects[j].effect.multicast) {
        return true;
      }
    }
  }
  return false;
}

export function hasStack(formula) {
  if (!formula) {
    return false;
  }
  if (formula.type == 'multicast') {
    for (var i = formula.skills.length; i--;) {
      if (hasStack(formula.skills[i])) {
        return true;
      }
    }
    return false;
  } else if (formula.type == 'skill') {
    return formula.stack;
  } else if (formula.type == 'condition') {
    return hasStack(formula.formula);
  } else {
    return false;
  }
}
