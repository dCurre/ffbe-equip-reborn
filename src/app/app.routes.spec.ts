import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { StaticData } from './shared/services/static-data';

describe('routes', () => {
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        // the pages opened by these tests only need to exist: their data never arrives
        { provide: StaticData, useValue: { get: () => new Promise(() => undefined) } },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('keeps query and fragment of an old page link', async () => {
    await RouterTestingHarness.create('/contribute.html?server=JP#abc');
    expect(router.url).toBe('/contribute?server=JP#abc');
  });

  it('sends an old homepage link with a fragment to the encyclopedia', async () => {
    await RouterTestingHarness.create('/#eyJ4IjoxfQ');
    expect(router.url).toBe('/encyclopedia#eyJ4IjoxfQ');
  });

  it('opens the homepage without a fragment', async () => {
    await RouterTestingHarness.create('/homepage.html');
    expect(router.url).toBe('/');
  });
});
