import { STRINGS } from '../../strings/en';
/** The groups of enhancements the dialog offers: label, then the choices `[value, label]`. */
export const ENHANCEMENT_GROUPS: { title: string; choices: [string, string][] }[] = [
  ...['hp', 'mp', 'atk', 'def', 'mag', 'spr'].map((stat) => ({
    title: stat.toUpperCase(),
    choices: [20, 15, 12, 10, 7, 5, 3, 1].map((n) => [`${stat}_${n}`, `${n}%`] as [string, string]),
  })),
  { title: STRINGS.enhancementGroups.autoRegen, choices: [4, 3, 2, 1].map((n) => [`autoRegen_${n}`, `Lvl. ${n}`] as [string, string]) },
  { title: STRINGS.enhancementGroups.autoRefresh, choices: [2, 1].map((n) => [`autoRefresh_${n}`, `Lvl. ${n}`] as [string, string]) },
  { title: STRINGS.enhancementGroups.autoProtect, choices: [5, 4, 3, 2, 1].map((n) => [`autoProtect_${n}`, `Lvl. ${n}`] as [string, string]) },
  { title: STRINGS.enhancementGroups.autoShell, choices: [5, 4, 3, 2, 1].map((n) => [`autoShell_${n}`, `Lvl. ${n}`] as [string, string]) },
  {
    title: STRINGS.enhancementGroups.other,
    choices: [
      ['atk_mag_1', 'ATK/MAG +30%'],
      ['hp_def_1', 'HP/DEF +20%'],
      ['hp_spr_1', 'HP/SPR +20%'],
      ['autoFillLb_2', '+2 LB/turn'],
      ['autoFillLb_1', '+1 LB/turn'],
      ['reduceMp_2', '-10% MP'],
      ['reduceMp_1', '-5% MP'],
    ],
  },
];
