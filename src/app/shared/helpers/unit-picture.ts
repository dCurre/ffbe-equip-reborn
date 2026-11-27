/** The ids Japan gave to another unit (`ownUnit` in tools/jpUnitNames.json): their `jp-` entry has its own pictures. */
const OWN_PICTURE = /^jp-40101(42|43|45|46)/;

/** The id of the pictures of a unit: a Japan version (`jp-<id>`) has the ones of the unit it is a version of. */
export const pictureId = (id: string): string => (OWN_PICTURE.test(id) ? id : id.replace(/^jp-/, ''));
