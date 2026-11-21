import { TestBed } from '@angular/core/testing';
import { Theme } from './theme';

describe('Theme', () => {
  beforeEach(() => localStorage.clear());

  it('is dark by default and applies the choice to <html>, saving it', () => {
    const theme = TestBed.inject(Theme);
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    theme.current.set('light');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('shows a forced theme without changing the saved choice', () => {
    const theme = TestBed.inject(Theme);
    theme.forced.set('light');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('theme')).toBe('dark');
    theme.forced.set(null);
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
