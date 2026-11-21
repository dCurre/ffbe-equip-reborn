export function getValue(item, valuePath, defaultValue = 0) {
  var value: any = item[valuePath];

  if (value === undefined) {
    if (valuePath.indexOf('.') > -1) {
      value = getValueFromPath(item, valuePath);
    } else {
      value = defaultValue;
    }
    item[valuePath] = value;
  }

  if (value && value.min && value.max) {
    value = (value.min + value.max) / 2;
  }

  return value;
}

export function getValueFromPath(item, valuePath) {
  var pathTokens: any = valuePath.split('.');
  var currentItem: any = item;
  for (var index = 0, len = pathTokens.length; index < len; index++) {
    if (currentItem[pathTokens[index]]) {
      currentItem = currentItem[pathTokens[index]];
    } else if (pathTokens[index].indexOf('|') > -1) {
      var tmpToken: any = pathTokens[index].split('|');
      var property: any = tmpToken[0];
      var name: any = tmpToken[1];
      if (currentItem[property]) {
        for (var listIndex = currentItem[property].length; listIndex--;) {
          if (currentItem[property][listIndex].name == name) {
            currentItem = currentItem[property][listIndex];
            break;
          }
        }
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }
  return currentItem;
}

export function isStackable(item) {
  return !(item.special && item.special.includes('notStackable'));
}

export function isTwoHanded(item) {
  return item && item.special && item.special.includes('twoHanded');
}

export function hasDualWieldOrPartialDualWield(item) {
  return hasDualWield(item) || item.partialDualWield;
}

export function hasDualWield(item) {
  return item.special && item.special.includes('dualWield');
}
