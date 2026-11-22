import { baseStats } from '../constants/base-lists.js';

export function computeFarmableStmr(data, ownedUnits, itemInventory) {
  let result = {};
  if (ownedUnits) {
    let stmrs = data.filter((item) => {
      return (
        item.stmrUnit &&
        ownedUnits[item.stmrUnit] &&
        (ownedUnits[item.stmrUnit].farmableStmr > 0 || ownedUnits[item.stmrUnit].number >= 2)
      );
    });
    stmrs = stmrs.map((item) => getItemEntry(item.originalItem || item, itemInventory?.[item.id] || 0));
    stmrs.forEach((stmr) => {
      stmr.stmrAccess = {
        base: '',
        sevenStar: 0,
        sixStar: 0,
        stmrMoogle: 100,
      };
      if (ownedUnits[stmr.item.stmrUnit].farmableStmr) {
        stmr.stmrAccess.base = 'sevenStar';
      } else {
        stmr.stmrAccess.base = 'sixStar';
      }
      if (ownedUnits[stmr.item.stmrUnit].farmableStmr > 1) {
        stmr.stmrAccess.sevenStar = 1;
        stmr.stmrAccess.stmrMoogle = 0;
      } else {
        let sixStarNumber =
          stmr.stmrAccess.base == 'sixStar'
            ? ownedUnits[stmr.item.stmrUnit].number - 2
            : ownedUnits[stmr.item.stmrUnit].number;
        if (sixStarNumber >= 2) {
          stmr.stmrAccess.sixStar = 2;
          stmr.stmrAccess.stmrMoogle = 0;
        } else if (sixStarNumber == 1) {
          stmr.stmrAccess.sixStar = 1;
          stmr.stmrAccess.stmrMoogle = 50;
        }
      }
    });
    stmrs.forEach((stmr) => (result[stmr.item.id] = stmr));
  }
  return result;
}

let itemEntryId = 0;

export function getItemEntry(item, number, enhanced = false, enhancementPos = 0) {
  let itemEntry = {
    item: item,
    name: item.name,
    defenseValue: 0,
    mpValue: 0,
    available: number,
    owned: number > 0,
    ownedNumber: number,
    id: itemEntryId++ + '',
    enhanced: enhanced,
    enhancementPos: enhancementPos,
  };
  for (var index = 0, len = baseStats.length; index < len; index++) {
    item['total_' + baseStats[index]] = item[baseStats[index] + '%'] || 0;
  }
  return itemEntry;
}

export function getPlaceHolder(type) {
  return { name: 'Any ' + type, type: type, placeHolder: true };
}
