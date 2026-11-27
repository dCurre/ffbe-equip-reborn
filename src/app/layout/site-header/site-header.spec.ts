import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { GoogleDrive } from '../../shared/services/google-drive';
import { Inventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { SiteHeader } from './site-header';

@Component({ imports: [SiteHeader], template: '<app-site-header title="Units" banner="Rain" />' })
class Host {}

describe('SiteHeader', () => {
  let page: HTMLElement;
  let router: Router;

  const click = async (selector: string, index = 0) => {
    (page.querySelectorAll(selector)[index] as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([{ path: '**', children: [] }])] });
    router = TestBed.inject(Router);
    TestBed.inject(Inventory).status.set('notLoaded');
    await router.navigateByUrl('/units');
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  it('shows the page title and the login status', () => {
    expect(page.querySelector('h1')?.textContent).toBe('Units');
    expect(page.querySelector('.status')?.textContent).toContain('Inventory not loaded');
  });

  it('reloads the page with the new language, and has no server buttons', async () => {
    const navigate = vi
      .spyOn(ServerContext.prototype as unknown as { navigate(url: URL): void }, 'navigate')
      .mockImplementation(() => undefined);
    await click('.languages button', 3); // fr
    expect(navigate.mock.calls[0][0].search).toBe('?l=fr');
    expect(page.querySelector('.servers')).toBeNull();
    navigate.mockRestore();
  });

  it('shows the counts of the loaded inventory', () => {
    TestBed.inject(Inventory).status.set('loaded');
    fixture.detectChanges();
    expect(page.querySelector('.status')?.textContent).toContain('0 units');
  });

  it('keeps the language in the menu links', async () => {
    await router.navigateByUrl('/units?l=de');
    fixture.detectChanges();
    const links = [...page.querySelectorAll('.desktop a:not(.logo)')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/builder?l=de');
  });

  it('starts the Google login from the login dialog', async () => {
    const proto = HTMLDialogElement.prototype;
    proto.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    const login = vi.spyOn(TestBed.inject(GoogleDrive), 'login').mockReturnValue(new Promise(() => undefined));
    await click('.login');
    const buttons = [...page.querySelectorAll('app-modal .footer button')] as HTMLElement[];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Cancel', 'Continue']);
    buttons[1].click();
    expect(login).toHaveBeenCalled();
    login.mockRestore();
  });

  it('opens and closes the mobile menu', async () => {
    expect(page.querySelector('.dropdown')).toBeNull();
    await click('.mobile .logo');
    expect(page.querySelectorAll('.dropdown li').length).toBe(10);
    await click('.mobile .logo');
    expect(page.querySelector('.dropdown')).toBeNull();
  });
});
