import { Component, computed, input, output, signal } from '@angular/core';
import { weaponList } from '../../../../core/constants/item-types';
import { ItemLine } from '../../../game/components/item-line/item-line';
import { Alert } from '../../../shared/components/alert/alert';
import { Button } from '../../../shared/components/button/button';
import { DropdownMenu, MenuItem } from '../../../shared/components/dropdown-menu/dropdown-menu';
import { Icon } from '../../../shared/components/icon/icon';
import { Item } from '../../../game/helpers/item';
import { ItemSummary } from '../../../game/components/item-summary/item-summary';
import { enemy } from '../shared/build-inputs';
import type { BuildSharing } from '../shared/build-sharing';
import type { GameData } from '../shared/game-data';
import type { ItemActions } from '../shared/item-actions';
import type { OptimizerRunner } from '../shared/optimizer-runner';
import { BuildResultStats } from '../build-result-stats/build-result-stats';
import { resultStats } from '../shared/result-stats';
import { StatePanel } from '../shared/state-panel';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The slots of a build, in the order of `UnitBuild.build`. */
const SLOTS = [
  { index: 0, name: 'Right hand', icon: 'hand' },
  { index: 1, name: 'Left hand', icon: 'hand', mirror: true },
  { index: 2, name: 'Head', icon: 'head' },
  { index: 3, name: 'Body', icon: 'body' },
  { index: 4, name: 'Accessory', icon: 'accessory' },
  { index: 5, name: 'Accessory', icon: 'accessory' },
  { index: 6, name: 'Materia', icon: 'materia' },
  { index: 7, name: 'Materia', icon: 'materia' },
  { index: 8, name: 'Materia', icon: 'materia' },
  { index: 9, name: 'Materia', icon: 'materia' },
  { index: 10, name: 'Vision Card', icon: 'visionCard' },
  { index: 11, name: 'Esper', icon: 'esper' },
];

/** The build button, the items of the build and its totals. */
@Component({
  selector: 'app-build-result',
  imports: [Alert, Button, DropdownMenu, Icon, ItemLine, ItemSummary, BuildResultStats],
  templateUrl: './build-result.html',
  styleUrl: './build-result.css',
})
export class BuildResult extends StatePanel {
  readonly items = input.required<ItemActions>();
  readonly sharing = input.required<BuildSharing>();
  /** The sharing of every tab: the "all units" link and text. */
  readonly allSharing = input<BuildSharing[]>([]);
  readonly runner = input.required<OptimizerRunner>();
  readonly game = input.required<GameData>();
  readonly ready = input.required<boolean>();
  /** the Parameter Challenges search for the units: its own button starts the build */
  readonly challenge = input(false);
  readonly build = output<void>();
  readonly workers = output<string>();
  readonly help = output<void>();

  protected readonly slots = SLOTS;

  /** The best build found: the lines of the slots, the totals of the stats and the value of the goal. */
  protected readonly result = computed(() => {
    this.s.tick();
    const build = this.s.build();
    if (!build.unit || !build.build?.length) return null;
    const variation = this.s.goalVariation() as 'min' | 'avg' | 'max';
    // -1 is the value of a build no search has filled: the value is calculated from the items it has, as the old page did
    const found = build.buildValue?.[variation] !== -1 ? build.buildValue : null;
    return resultStats(build, enemy(this.s), variation, found);
  });
  protected readonly lines = computed(() => {
    this.s.tick();
    const build = this.s.build();
    return SLOTS.map((slot) => {
      let item = build.build?.[slot.index] ?? build.fixedItems?.[slot.index] ?? null;
      if (item?.type === 'unavailable') item = null;
      return {
        slot,
        item: item as Item | null,
        pinned: !!build.fixedItems?.[slot.index],
        weapon: !!item && weaponList.includes(item.type),
        hint: this.items().farmHint(slot.index, item),
      };
    });
  });
  protected readonly shareItems = computed<MenuItem[]>(() => {
    const all = this.allSharing();
    const items: MenuItem[] = [
      { label: 'Link (this unit only)', run: () => this.sharing().openShare() },
      { label: 'Text (this unit only)', run: () => this.sharing().openText() },
      { label: 'Image (this unit only)', run: () => this.sharing().openImage() },
    ];
    if (all.length > 1) {
      items.push(
        { label: 'Link (all units)', run: () => this.sharing().openShare(all) },
        { label: 'Text (all units)', run: () => this.sharing().openText(all) },
        { label: 'Image (all units)', run: () => this.sharing().openImage(all) },
      );
    }
    return items;
  });
  protected readonly clearItems = computed<MenuItem[]>(() => [
    { label: 'Clear not pinned items (for this build)', run: () => this.items().clearItems(true) },
    { label: 'Clear all items (for this build)', run: () => this.items().clearItems(false) },
  ]);

  /** The concise lines show the picture and the name of the items, the detailed ones all their effects. */
  protected readonly concise = signal(true);
}
