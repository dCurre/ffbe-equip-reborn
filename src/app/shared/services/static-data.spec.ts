import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { StaticData } from './static-data';

describe('StaticData', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{"a":1}'));
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads a file of the current server once and keeps it in memory', async () => {
    const data = TestBed.inject(StaticData);
    expect(await data.get('units')).toEqual({ a: 1 });
    await data.get('units');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('GL/units.json');
  });

  it('asks for the localized variant and the JP folder from the URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/x?l=fr');
    await TestBed.inject(StaticData).get('data', true);
    expect(fetchSpy).toHaveBeenCalledWith('GL/data_fr.json');
    await TestBed.inject(Router).navigateByUrl('/x?server=JP');
    await TestBed.inject(StaticData).get('data', true);
    expect(fetchSpy).toHaveBeenCalledWith('JP/data.json');
  });

  it('does not remember a failed download', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
    const data = TestBed.inject(StaticData);
    await expect(data.get('monsters')).rejects.toThrow('404');
    expect(await data.get('monsters')).toEqual({ a: 1 });
  });
});
