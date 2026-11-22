import { Injectable } from '@angular/core';

/** Shared links (builds, unit collections) live in the Cloudflare Worker of `/worker`, which maps a short id to the data. */
export const LINK_STORE_URL = 'https://ffbe-equip-reborn.ffbe-equip-reborn.workers.dev';

const LINK_ID = /^[A-Za-z0-9]{10}$/;
/** Ids of the links made by FFBE Equip Next (Firebase): that data is lost. */
const OLD_LINK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class LinkStore {
  isLinkId(value: string): boolean {
    return LINK_ID.test(value);
  }

  isOldLinkId(value: string): boolean {
    return OLD_LINK_ID.test(value);
  }

  /** Stores the data and returns its id (the same data always gets the same id). */
  async save(data: unknown): Promise<string> {
    const response = await fetch(LINK_STORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Cannot save the link (${response.status})`);
    return ((await response.json()) as { id: string }).id;
  }

  async load<T>(id: string): Promise<T> {
    const response = await fetch(`${LINK_STORE_URL}/${id}`);
    if (!response.ok) throw new Error(`Cannot load the link (${response.status})`);
    return (await response.json()) as T;
  }
}
