import { TestBed } from '@angular/core/testing';
import { ImportModal } from './import-modal';

describe('ImportModal', () => {
  it('reads a file dropped on the zone like a chosen one', async () => {
    const fixture = TestBed.createComponent(ImportModal);
    fixture.componentRef.setInput('heading', 'Import');
    const loaded: unknown[] = [];
    fixture.componentInstance.fileLoaded.subscribe((data) => loaded.push(data));
    fixture.detectChanges();
    const zone = fixture.nativeElement.querySelector('.drop') as HTMLElement;
    const file = new File(['{"a":1}'], 'data.json', { type: 'application/json' });
    const drop = Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: { files: [file] } });
    zone.dispatchEvent(drop);
    await fixture.whenStable();
    expect(loaded).toEqual([{ a: 1 }]);
    expect(drop.defaultPrevented).toBe(true);
  });
});
