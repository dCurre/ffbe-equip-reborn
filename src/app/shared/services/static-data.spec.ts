import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { StaticData } from './static-data';
import { Toast } from './toast';

describe('StaticData', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{"a":1}'));
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads a file once and keeps it in memory', async () => {
    const data = TestBed.inject(StaticData);
    expect(await data.get('units')).toEqual({ a: 1 });
    await data.get('units');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('ALL/units.json');
  });

  it('asks for the localized variant from the URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/x?l=fr');
    await TestBed.inject(StaticData).get('data', true);
    expect(fetchSpy).toHaveBeenCalledWith('ALL/data_fr.json');
  });

  it('tells with a toast the download that is slow, and only that one', async () => {
    vi.useFakeTimers();
    try {
      let finish!: (response: Response) => void;
      fetchSpy.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
      const toast = TestBed.inject(Toast);
      const slow = TestBed.inject(StaticData).get('units');
      await vi.advanceTimersByTimeAsync(400);
      expect(toast.messages().map((m) => m.text)).toEqual(['Downloading ALL/units.json']);
      finish(new Response('{"a":1}'));
      await slow;
      await TestBed.inject(StaticData).get('data'); // fast: no toast
      expect(toast.messages().length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not remember a failed download', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
    const data = TestBed.inject(StaticData);
    await expect(data.get('monstersAll')).rejects.toThrow('404');
    expect(await data.get('monstersAll')).toEqual({ a: 1 });
  });
});
