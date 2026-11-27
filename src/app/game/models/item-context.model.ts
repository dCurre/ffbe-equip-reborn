/** every unit by id, to name the units a TMR belongs to */
export type ItemUnits = Readonly<Record<string, { name: string; jpname?: string; wikiEntry?: string }>>;

/** the enchantments (`itemEnchants.json`), to name the rare enhancements of an item */
export type ItemEnchantments = Readonly<Record<string, { effects: string }>>;
