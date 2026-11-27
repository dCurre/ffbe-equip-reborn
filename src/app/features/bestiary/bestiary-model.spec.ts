import {
  eventType,
  matchingDungeons,
  matchingStages,
  missionCount,
  Monster,
  monsterHits,
  sortEvents,
  stageLabel,
} from './bestiary-model';

describe('bestiary model', () => {
  const events = [
    { name: 'Rush #10', date: '2018-01-01' },
    { name: 'Undated' },
    { name: 'Rush #2', date: '2017-01-01' },
  ];
  const names = (by: 'name' | 'date', descending: boolean) => sortEvents(events, { by, descending }).map((e) => e.name);

  it('sorts by name, reading the numbers as numbers', () => {
    expect(names('name', false)).toEqual(['Rush #2', 'Rush #10', 'Undated']);
    expect(names('name', true)).toEqual(['Undated', 'Rush #10', 'Rush #2']);
  });

  it('sorts by date, with the undated events always last', () => {
    expect(names('date', false)).toEqual(['Rush #2', 'Rush #10', 'Undated']);
    expect(names('date', true)).toEqual(['Rush #10', 'Rush #2', 'Undated']);
  });

  it('reads the type without the marks of the schedule', () => {
    expect(eventType({ name: 'a', kind: 'Rerun) King Mog events' })).toBe('King Mog Event');
    expect(eventType({ name: 'a', kind: 'Chamber of Arms trial-1' })).toBe('Chamber of Arms trial');
    expect(eventType({ name: 'a' })).toBe('');
  });

  it('finds the dungeons of an event, and the stages they do not already say, with the stage to open', () => {
    const amon = {
      id: 1,
      name: 'Scorn of Amon',
      missions: [
        { id: 1, name: 'Scorn of Amon - INT' },
        { id: 2, name: 'Amon Returns' },
        { id: 3, name: null },
      ],
    };
    const event = { name: 'Chamber', dungeons: [amon] };
    expect(matchingDungeons(event, 'amon')).toEqual([{ name: 'Scorn of Amon', stage: 1 }]);
    expect(matchingStages(event, 'amon')).toEqual([{ name: 'Amon Returns', stage: 2 }]);
    expect(matchingStages(event, 'int')).toEqual([{ name: 'Scorn of Amon - INT', stage: 1 }]);
    expect(matchingDungeons({ name: 'Scorn of Amon', dungeons: [amon] }, 'amon')).toEqual([]);
  });

  it('lists each monster of an event once, with the first stage that has it', () => {
    const monster = (name: string) => ({ name }) as Monster;
    const data = { monsters: [monster('Ifrit'), monster('Bomb')], missions: { 1: [0], 2: [0, 1] } };
    const missions = [1, 2, 3].map((id) => ({ id, name: null }));
    expect(monsterHits({ name: 'a', dungeons: [{ id: 1, name: null, missions }] }, data)).toEqual([
      { name: 'Ifrit', stage: 1 },
      { name: 'Bomb', stage: 2 },
    ]);
  });

  it('shortens the name of a stage on its tab', () => {
    expect(stageLabel('Omega Spawn Lvl. 1', 'Omega Spawn')).toBe('Lvl. 1');
    expect(stageLabel('Chamber of Arms - Mech of Fury', 'Elnath', 'Chamber of Arms')).toBe('Mech of Fury');
    expect(stageLabel('Cactuar Dunes', 'Cactuar Dunes')).toBe('Cactuar Dunes');
  });

  it('counts the missions of all the dungeons', () => {
    const mission = { id: 1, name: null };
    const dungeons = [
      { id: 1, name: null, missions: [mission, mission] },
      { id: 2, name: null, missions: [mission] },
    ];
    expect(missionCount({ name: 'a', dungeons })).toBe(3);
  });
});
