import { TestBed } from '@angular/core/testing';
import { TabBar } from './tab-bar';

describe('TabBar', () => {
  it('is one stop for the Tab key, and the arrows and Space choose a tab', async () => {
    const fixture = TestBed.createComponent(TabBar<string>);
    fixture.componentRef.setInput('tabs', [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
    ]);
    fixture.componentRef.setInput('active', 'a');
    const chosen: string[] = [];
    fixture.componentInstance.selected.subscribe((key) => chosen.push(key));
    await fixture.whenStable();
    const [first, second] = fixture.nativeElement.querySelectorAll('li') as NodeListOf<HTMLElement>;
    expect([first.tabIndex, second.tabIndex]).toEqual([0, -1]);
    expect(first.getAttribute('aria-selected')).toBe('true');

    const press = (tab: HTMLElement, key: string) => tab.dispatchEvent(new KeyboardEvent('keydown', { key }));
    press(first, 'ArrowRight');
    press(first, 'ArrowLeft');
    press(second, ' ');
    expect(chosen).toEqual(['b', 'b']);
  });
});
