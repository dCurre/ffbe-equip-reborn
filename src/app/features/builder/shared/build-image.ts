/* eslint-disable @typescript-eslint/no-explicit-any -- the unit data of a link is open */
import { pictureId } from '../../../shared/helpers/unit-picture';

/** The picture of a team (the old `exportBuildAsImage.js`): one card per unit, a second one for its Brave Shifted form. */

const CARD_HEIGHT = 267;
export const CARD_WIDTH = 730;
const RACES = [
  'aquatic',
  'beast',
  'bird',
  'bug',
  'demon',
  'dragon',
  'human',
  'machine',
  'plant',
  'undead',
  'stone',
  'spirit',
];
const ELEMENTS = ['fire', 'ice', 'lightning', 'water', 'wind', 'earth', 'light', 'dark'];
const AILMENTS = [
  'poison',
  'blind',
  'sleep',
  'silence',
  'paralysis',
  'confuse',
  'disease',
  'petrification',
  'death',
  'charm',
  'stop',
];
const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spr'];
const RED = '#ff0000';
const GREEN = '#00ff00';

const loaded = new Map<string, Promise<HTMLImageElement | null>>();

/** A picture of the site, or null when it cannot be loaded. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let image = loaded.get(url);
  if (!image) {
    image = new Promise((resolve) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = url;
    });
    loaded.set(url, image);
  }
  return image;
}

/** The picture at `url`, or the one at `fallback` when it does not exist. */
async function loadWithFallback(url: string, fallback: string): Promise<HTMLImageElement | null> {
  return (await loadImage(url)) ?? loadImage(fallback);
}

interface TextStyle {
  style?: string;
  size: number;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  color?: string;
  /** the text goes on several lines when wider than this */
  maxWidth?: number;
}

function lines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const result: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    if (ctx.measureText(`${current} ${word}`).width < maxWidth) current += ` ${word}`;
    else {
      result.push(current);
      current = word;
    }
  }
  result.push(current);
  return result;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string | number,
  x: number,
  y: number,
  options: TextStyle,
): void {
  ctx.globalAlpha = 1;
  ctx.font = `${options.style ? `${options.style} ` : ''}${options.size}px Arial`;
  ctx.textBaseline = options.baseline;
  ctx.textAlign = options.align;
  ctx.fillStyle = options.color ?? 'white';
  const rows = options.maxWidth ? lines(ctx, String(text), options.maxWidth) : [String(text)];
  const first = options.baseline === 'middle' ? (-(rows.length - 1) * (options.size + 2)) / 2 : 0;
  rows.forEach((row, i) => ctx.fillText(row, x, first + y + i * (options.size + 2)));
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const radius = 10;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPicture(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
  rounded = false,
): void {
  if (!image) return;
  ctx.globalAlpha = alpha;
  if (rounded) {
    ctx.save();
    roundedPath(ctx, x, y, width, height);
    ctx.clip();
  }
  ctx.drawImage(image, x, y, width, height);
  if (rounded) ctx.restore();
}

/** A bar of 15 pixels (the black part, then the green one for the potted share). */
function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, share: number): void {
  ctx.strokeStyle = 'black';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 15, y);
  ctx.stroke();
  ctx.strokeStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 15 * Math.min(1, share), y);
  ctx.stroke();
}

/** The icon of the unit: the picture of its rarity, or the one of its base form. */
function unitIconId(unit: any): string {
  const id: string = pictureId(unit.id);
  if (id.endsWith('03') || id.endsWith('04') || id.endsWith('05')) {
    if (unit.rarity === 'NV') return `${id.substring(0, id.length - 2)}17`;
    if (unit.rarity === 7) return `${id.substring(0, id.length - 2)}07`;
    if (unit.rarity === 6) return `${id.substring(0, id.length - 2)}06`;
    return id;
  }
  return id.substring(0, id.length - 1) + (unit.rarity === 'NV' ? '7' : unit.rarity);
}

async function drawStats(ctx: CanvasRenderingContext2D, unit: any, top: number): Promise<void> {
  const x = 105;
  const y = 35 + top;
  drawText(ctx, unit.exAwakening ? `${unit.name} EX+${unit.exAwakening}` : unit.name, 105, y - 5, {
    size: 16,
    align: 'start',
    baseline: 'bottom',
  });
  STATS.forEach((stat, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    drawText(ctx, stat.toUpperCase(), x + column * 120, y + 16 + line * 25, {
      style: 'italic',
      size: 12,
      align: 'start',
      baseline: 'bottom',
    });
    drawText(ctx, unit.calculatedValues[stat].value, x + 80 + column * 120, y + 21 + line * 25, {
      style: 'bold',
      size: 18,
      align: 'end',
      baseline: 'bottom',
    });
    const barY = y + 18 + line * 25;
    const pots = unit.pots[stat];
    const maxPots = unit.maxPots[stat];
    if (pots) drawBar(ctx, x + column * 120, barY, pots / maxPots);
    if (pots > maxPots) drawBar(ctx, x + 17 + column * 120, barY, (pots - maxPots) / (maxPots / 2));
    if (unit.buffs[stat]) {
      drawText(ctx, `↑${unit.buffs[stat]}${stat === 'hp' ? '' : '%'}`, x + 82 + column * 120, barY, {
        style: 'italic',
        size: 10,
        align: 'start',
        baseline: 'bottom',
        color: '#aaaaaa',
      });
    }
  });

  const values = unit.calculatedValues;
  const additional = [
    { name: 'Evasion', value: values.physicalEvasion.value, buff: 0 },
    { name: 'Provoke', value: values.drawAttacks.value, buff: unit.buffs.drawAttacks },
    { name: 'LB Dmg', value: values.lbDamage.value, buff: unit.buffs.lbDamage },
    { name: 'MP/turn', value: (values.mpRefresh.value * values.mp.value) / 100, buff: 0 },
    { name: 'LB/turn', value: values.lbPerTurn.value, buff: 0 },
    { name: 'LB fill', value: values.lbFillRate.value, buff: unit.buffs.lbFillRate },
    { name: 'Jmp Dmg', value: values.jumpDamage.value, buff: 0 },
    { name: 'EVO mag', value: values.evoMag.value, buff: 0 },
    { name: 'Evoke', value: values.evokeDamageBoost.value, buff: 0 },
  ].filter((entry) => entry.value);
  additional.forEach((entry, index) => {
    const column = index % 3;
    const line = Math.floor(index / 3);
    const left = 25 + column * 100;
    const baseline = 130 + top + line * 20;
    drawText(ctx, entry.name, left + 50, baseline, { style: 'italic', size: 12, align: 'end', baseline: 'bottom' });
    drawText(ctx, entry.value, left + 54, baseline, { style: 'bold', size: 14, align: 'start', baseline: 'bottom' });
    if (entry.buff) {
      drawText(ctx, `↑${entry.buff}`, left + 56 + ctx.measureText(String(entry.value)).width, baseline, {
        style: 'italic',
        size: 10,
        align: 'start',
        baseline: 'bottom',
        color: '#aaaaaa',
      });
    }
  });
}

async function drawItems(ctx: CanvasRenderingContext2D, unit: any, top: number): Promise<void> {
  const x = 355;
  const y = 5 + top;
  for (const item of unit.items) {
    if (!item || item.id === 'unavailable') continue;
    const column = item.slot % 2;
    const textX = x + 40 + column * 180;
    const textY = y + Math.floor(item.slot / 2) * 30 + 20;
    if (item.name) {
      const picture = await loadWithFallback(`img/items/${item.icon}`, 'img/items/icon_unknown.png');
      drawPicture(ctx, picture, x + column * 180, y + Math.floor(item.slot / 2) * 30, 40, 40);
      const enhanced = unit.itemEnchantments?.[unit.items.indexOf(item)];
      drawText(ctx, item.name, textX, textY, {
        style: 'bold',
        size: 12,
        align: 'start',
        baseline: 'middle',
        maxWidth: 130,
        color: enhanced ? '#e74c3c' : 'white',
      });
    } else {
      // a placeholder: an item type without a chosen item, its id is the type
      drawText(ctx, `Any ${item.id}`, textX, textY, {
        style: 'italic',
        size: 12,
        align: 'start',
        baseline: 'middle',
        maxWidth: 130,
        color: '#6fa8dc',
      });
    }
  }
  // the slots with nothing at all (unavailable slots, as the left hand with a two-handed weapon, stay blank)
  for (let slot = 0; slot < 11; slot++) {
    if (unit.items.some((item: any) => item && item.slot === slot)) continue;
    drawText(ctx, 'Empty', x + 40 + (slot % 2) * 180, y + Math.floor(slot / 2) * 30 + 20, {
      style: 'italic',
      size: 12,
      align: 'start',
      baseline: 'middle',
      maxWidth: 130,
      color: '#888888',
    });
  }
  const picture = await loadImage(unit.esperId ? `img/espers/${unit.esperId}.jpg` : 'img/espers/ALL.png');
  drawPicture(ctx, picture, x + 185, y + 155, 30, 30, 1, true);
  drawText(ctx, unit.esperId ? unit.esperId.replace('_', ' ') : 'No esper', x + 220, y + 170, {
    style: 'bold',
    size: 12,
    align: 'start',
    baseline: 'middle',
    maxWidth: 130,
  });
}

/** A row of icons (elements, ailments, killers) with the value of each over its corner; the ones without a value are dim. */
async function drawIconRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  names: string[],
  path: (name: string) => string,
  value: (name: string) => number,
  look: { shade: number; color: (value: number) => string },
): Promise<void> {
  for (const [index, name] of names.entries()) {
    const amount = value(name);
    const picture = await loadImage(path(name));
    drawPicture(ctx, picture, x + index * 30, y, 30, 30, amount ? 1 : 0.4);
    if (!amount) continue;
    ctx.font = 'bold 14px Arial';
    const width = ctx.measureText(String(amount)).width;
    ctx.fillStyle = 'black';
    ctx.globalAlpha = look.shade;
    ctx.fillRect(x + 29 - width + index * 30, y + 16, width, 12);
    drawText(ctx, amount, x + 28 + index * 30, y + 30, {
      style: 'bold',
      size: 12,
      align: 'end',
      baseline: 'bottom',
      color: look.color(amount),
    });
  }
}

async function drawCard(ctx: CanvasRenderingContext2D, unit: any, line: number, braveShifted: boolean): Promise<void> {
  const top = line * CARD_HEIGHT;
  const gradient = ctx.createLinearGradient(0, 0, 900, CARD_HEIGHT);
  gradient.addColorStop(0, '#0000b2');
  gradient.addColorStop(1, '#00002d');
  ctx.fillStyle = gradient;
  ctx.fillRect(4, 4 + top, 726, 258);
  drawPicture(ctx, await loadImage('img/box.png'), 0, top, CARD_WIDTH, CARD_HEIGHT);
  if (braveShifted) drawPicture(ctx, await loadImage('img/icons/braveShift_small.png'), 5, -6 + top, 66, 12);

  const portrait = await loadWithFallback(
    `img/units/unit_ills_${unitIconId(unit)}.png`,
    'img/units/unit_ills_999999999.png',
  );
  if (portrait) {
    ctx.globalAlpha = 1;
    ctx.drawImage(portrait, 52 - portrait.width / 2, 52 + top - portrait.height / 2);
  }
  await drawStats(ctx, unit, top);
  await drawItems(ctx, unit, top);

  const values = unit.calculatedValues;
  const resist = { shade: 1, color: (value: number) => (value < 0 ? RED : GREEN) };
  const killer = { shade: 0.5, color: () => 'white' };
  await drawIconRow(
    ctx,
    10,
    196 + top,
    ELEMENTS,
    (n) => `img/icons/elements/${n}.png`,
    (n) => values.elementResists[n],
    resist,
  );
  await drawIconRow(
    ctx,
    10,
    228 + top,
    AILMENTS,
    (n) => `img/icons/ailments/${n}.png`,
    (n) => Math.min(100, values.ailmentResists[n]),
    resist,
  );
  await drawIconRow(
    ctx,
    355,
    196 + top,
    RACES,
    (n) => `img/icons/killers/physical-${n}.png`,
    (n) => values.killers[n].physical,
    killer,
  );
  await drawIconRow(
    ctx,
    355,
    228 + top,
    RACES,
    (n) => `img/icons/killers/magical-${n}.png`,
    (n) => values.killers[n].magical,
    killer,
  );
}

const showsBraveShift = (unit: any): boolean =>
  !!unit.braveShiftedUnit?.items.filter((item: any) => item.slot < 10).length;

/** Draws the units (the `units` of a link) on the canvas, which is resized to fit them. */
export async function drawTeam(canvas: HTMLCanvasElement, units: any[]): Promise<void> {
  const cards = units.reduce((total, unit) => total + (showsBraveShift(unit) ? 2 : 1), 0);
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT * cards;
  const ctx = canvas.getContext('2d')!;
  let line = 0;
  for (const unit of units) {
    await drawCard(ctx, unit, line++, false);
    if (showsBraveShift(unit)) await drawCard(ctx, unit.braveShiftedUnit, line++, true);
  }
}
