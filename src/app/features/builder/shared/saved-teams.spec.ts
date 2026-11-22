import { describe, expect, it } from 'vitest';
import type { Toast } from '../../../shared/services/toast';
import type { UserData } from '../../../shared/services/user-data';
import { SavedTeams } from './saved-teams';

function setup(stored: unknown = { teams: [] }, fail = false) {
  const written: any[] = [];
  const userData = {
    read: async () => stored,
    write: async (_table: string, data: unknown) => {
      if (fail) throw new Error('drive');
      written.push(data);
    },
  } as unknown as UserData;
  const toast = { show: () => undefined } as unknown as Toast;
  return { saved: new SavedTeams(userData, toast), written };
}

describe('SavedTeams', () => {
  it('is a new team until one is saved, then it is the one being edited', async () => {
    const { saved, written } = setup();
    expect(saved.title()).toBe('New team');
    await saved.saveAs('Fire team', { units: [] });
    expect(saved.title()).toBe('Saved team : Fire team');
    expect(written[0].teams).toEqual([{ name: 'Fire team', team: { units: [] } }]);
  });

  it('saves over the team being edited and keeps the other fields of the file', async () => {
    const { saved, written } = setup({ other: 1, teams: [{ name: 'a', team: 1 }] });
    await saved.load();
    saved.current.set(0);
    await saved.save(2);
    expect(written[0]).toEqual({ other: 1, teams: [{ name: 'a', team: 2 }] });
  });

  it('keeps pointing at the same team when an earlier one is removed, and at none when it is removed', async () => {
    const { saved } = setup({
      teams: [
        { name: 'a', team: 1 },
        { name: 'b', team: 2 },
        { name: 'c', team: 3 },
      ],
    });
    await saved.load();
    saved.current.set(2);
    await saved.remove(0);
    expect(saved.title()).toBe('Saved team : c');
    await saved.remove(1);
    expect(saved.current()).toBe(-1);
  });

  it('changes nothing when the Drive refuses the write', async () => {
    const { saved } = setup({ teams: [{ name: 'a', team: 1 }] }, true);
    await saved.load();
    await saved.remove(0);
    expect(saved.teams()).toHaveLength(1);
  });
});
