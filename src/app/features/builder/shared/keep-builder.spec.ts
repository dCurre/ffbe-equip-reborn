import { Component, OnDestroy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { KeepBuilder } from './keep-builder';

let ended = 0;

@Component({ template: '' })
class Page {}

@Component({ template: '' })
class Build implements OnDestroy {
  ngOnDestroy(): void {
    ended++;
  }
}

describe('KeepBuilder', () => {
  it('keeps the Builder through the Bestiary and ends it on any other page', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'builder', component: Build },
          { path: 'bestiary', component: Page },
          { path: 'units', component: Page },
        ]),
        { provide: RouteReuseStrategy, useClass: KeepBuilder },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const build = await harness.navigateByUrl('/builder', Build);

    await harness.navigateByUrl('/bestiary');
    await harness.navigateByUrl('/bestiary?event=a');
    expect(await harness.navigateByUrl('/builder', Build)).toBe(build);
    expect(ended).toBe(0);

    await harness.navigateByUrl('/bestiary');
    await harness.navigateByUrl('/units');
    expect(ended).toBe(1);
    const next = await harness.navigateByUrl('/builder', Build);
    expect(next).not.toBe(build);

    await harness.navigateByUrl('/units');
    expect(ended).toBe(2);
    await harness.navigateByUrl('/bestiary');
    expect(await harness.navigateByUrl('/builder', Build)).not.toBe(next);
  });
});
