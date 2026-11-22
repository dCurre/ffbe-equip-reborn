/**
 * An item of `data.json` (equipment, materia, esper...). The game data has many optional fields (`element`, `resist`,
 * `killers`, `special`, ...), so the fields are open; the ones every item has are typed.
 */
export interface Item {
  id: string;
  name: string;
  type: string;
  access: string[];
  searchString?: string;
  calculatedValue?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [field: string]: any;
}
