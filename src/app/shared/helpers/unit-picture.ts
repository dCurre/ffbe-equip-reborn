/** The Japan version of a unit (`jp-<id>`) has the pictures of the unit it is a version of. */
export const pictureId = (id: string): string => id.replace(/^jp-/, '');
