import { afterNextRender, Component, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { ServerContext } from '../../shared/services/server-context';
import { STRINGS } from '../../strings/en';

const MAX_DELTA_PX = 50;
/** Below this width the background is a fixed picture, without the parallax. */
const PARALLAX_MIN_WIDTH = 770;
const THROTTLE_MS = 25;

interface Layer {
  element: HTMLElement;
  scrollSpeedFactor: number;
  mouseSpeedFactor: number;
  x: string;
  y: string;
  top: number;
  height: number;
}

const MENU_BUTTONS = [
  [{ path: '/builder', title: STRINGS.homepage.unitBuilder, character: 'Lid' }],
  [
    { path: '/encyclopedia', title: STRINGS.homepage.encyclopedia, character: 'Sakura' },
    { path: '/unitSearch', title: STRINGS.homepage.unitSearch, character: 'Lasswell' },
  ],
  [
    { path: '/inventory', title: STRINGS.homepage.myInventory, character: 'Jake' },
    { path: '/units', title: STRINGS.homepage.myUnits, character: 'Rain' },
    { path: '/espers', title: STRINGS.homepage.myEspers, character: 'Nichol' },
  ],
  [{ path: '/data-import', title: STRINGS.homepage.dataImport, character: 'Charlotte' }],
];

/** The start page: the menu over a background of four layers that move with the mouse and the scroll. */
@Component({
  selector: 'app-homepage',
  imports: [RouterLink, SiteFooter],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage {
  protected readonly t = STRINGS.homepage;
  protected readonly lines = MENU_BUTTONS;
  protected readonly serverContext = inject(ServerContext);
  private readonly mainmenu = viewChild.required<ElementRef<HTMLElement>>('mainmenu');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const stop = this.startParallax();
      destroyRef.onDestroy(stop);
    });
  }

  /** The layers move by the pointer position and by the scroll, each one by a different amount (layer 1 stays still). */
  private startParallax(): () => void {
    const menu = this.mainmenu().nativeElement;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    if (width < PARALLAX_MIN_WIDTH) return () => {};

    const layers: Layer[] = [
      { selector: '.layer-2', scroll: 0.15, mouse: 0.02 },
      { selector: '.layer-3', scroll: 0.25, mouse: 0.1 },
      { selector: '.layer-4', scroll: 0.35, mouse: 0.3 },
    ].map(({ selector, scroll, mouse }) => {
      const element = menu.querySelector<HTMLElement>(selector)!;
      element.style.transform = 'translate3d(0px, 0px, 0px)';
      const rect = element.getBoundingClientRect();
      return {
        element,
        scrollSpeedFactor: scroll,
        mouseSpeedFactor: mouse,
        x: '0',
        y: '0',
        top: rect.top + window.scrollY,
        height: rect.height,
      };
    });
    const last = layers[layers.length - 1];
    const border = menu.querySelector<HTMLElement>('.layer-border')!;
    const next = menu.nextElementSibling as HTMLElement | null;
    const lastLayerVisibleLimit = (next?.offsetTop ?? menu.offsetTop + height) - border.offsetHeight / 2;
    const maxScrollPosition = last.element.offsetTop;

    let pointerX = 0;
    let pointerY = 0;
    let scrollTop = 0;
    let lastRun = 0;

    const animate = () => {
      for (const layer of layers) layer.element.style.transform = `translate3d(${layer.x}px, ${layer.y}px, 0px)`;
    };
    const calculate = () => {
      let changed = false;
      let lastBottom = 0;
      for (const layer of layers) {
        const x = (((MAX_DELTA_PX * (pointerX - width / 2)) / width) * layer.mouseSpeedFactor).toFixed(2);
        const yMouse = ((MAX_DELTA_PX * (pointerY - height / 2)) / height) * layer.mouseSpeedFactor;
        const yPosition = yMouse - scrollTop * layer.scrollSpeedFactor;
        const y = yPosition.toFixed(2);
        if (layer.x !== x || layer.y !== y) {
          layer.x = x;
          layer.y = y;
          changed = true;
        }
        lastBottom = layer.top + yPosition + layer.height;
      }
      // once the last layer has scrolled out of view there is nothing to animate
      if (lastBottom < lastLayerVisibleLimit) changed = false;
      if (changed) requestAnimationFrame(animate);
    };
    const throttled = (handler: (event: Event) => void) => (event: Event) => {
      const now = Date.now();
      if (now - lastRun < THROTTLE_MS) return;
      lastRun = now;
      handler(event);
    };
    const onMouseMove = throttled((event) => {
      pointerX = (event as MouseEvent).pageX;
      pointerY = (event as MouseEvent).pageY;
      if (scrollTop < maxScrollPosition) requestAnimationFrame(calculate);
    });
    const onScroll = throttled(() => {
      scrollTop = window.scrollY;
      if (scrollTop < maxScrollPosition) requestAnimationFrame(calculate);
    });

    menu.addEventListener('mousemove', onMouseMove);
    document.addEventListener('scroll', onScroll);
    return () => {
      menu.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('scroll', onScroll);
    };
  }
}
