import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { KillerList } from '../../../game/components/killer-list/killer-list';
import { ResistList } from '../../../game/components/resist-list/resist-list';
import { Icon } from '../../../shared/components/icon/icon';
import {
  BoardNode,
  distance,
  EsperBoard as Board,
  EsperInfo,
  esperSprite,
  findPathTo,
  OwnedEsper,
  positionString,
  toggleNode,
} from '../esper-model';
import { NodeView, nodeView } from '../node-view';

interface Cell {
  x: number;
  y: number;
  position: string;
  tier: 'star1' | 'star2' | 'star3';
  hidden: boolean;
  isCenter: boolean;
  selected: boolean;
  view?: NodeView;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const GRID_SIZE = 9;

/** The training board of an Esper: 81 hexagons to pick the skills from, the lines between them, and the full screen view of phones. */
@Component({
  selector: 'app-esper-grid',
  imports: [KillerList, ResistList, Icon],
  templateUrl: './esper-grid.html',
  styleUrl: './esper-grid.css',
})
export class EsperGrid {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly info = input.required<EsperInfo>();
  readonly current = input.required<OwnedEsper | undefined>();
  readonly board = input.required<Board>();
  readonly sp = input.required<{ used: number; available: number } | null>();
  /** show the fixed SP label (the one of the header is scrolled out of view) */
  readonly spFixed = input(false);
  /** the board fills the screen (phones) */
  readonly gridView = model(false);
  /** the picked nodes changed: the page saves them */
  readonly changed = output<void>();

  protected readonly sprite = esperSprite;
  protected readonly lines = signal<Line[]>([]);
  protected readonly hover = signal<ReadonlySet<string>>(new Set());
  private scroll: { top: number; left: number } | null = null;
  private readonly panWrapper = viewChild<ElementRef<HTMLElement>>('panWrapper');
  private readonly gridContainer = viewChild<ElementRef<HTMLElement>>('gridContainer');
  private readonly hexagons = viewChildren<ElementRef<HTMLElement>>('hexagon');

  /** The 81 positions of the board and what each one shows. */
  protected readonly cells = computed<Cell[]>(() => {
    const esper = this.current();
    const board = this.board();
    const nodes = new Map<string, BoardNode>();
    const collect = (list: BoardNode[]): void =>
      list.forEach((node) => {
        nodes.set(positionString(...node.position), node);
        collect(node.children);
      });
    if (board && esper) collect(board.nodes);
    return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
      const y = Math.trunc(i / GRID_SIZE) - 4;
      const x = (i % GRID_SIZE) - 4 + Math.round(y / 2);
      const position = positionString(x, y);
      const dist = distance(x, y);
      const node = nodes.get(position);
      const used = !!esper && !!node && dist <= esper.rarity + 2;
      return {
        x,
        y,
        position,
        tier: dist > 3 ? 'star3' : dist > 2 ? 'star2' : 'star1',
        hidden: dist > 4 && !used,
        isCenter: position === '0_0',
        selected: position === '0_0' || (used && esper.selectedSkills.includes(position)),
        view: used ? nodeView(node) : undefined,
      };
    });
  });

  constructor() {
    // the lines between the nodes follow where the browser put the hexagons
    afterRenderEffect(() => {
      this.cells();
      untracked(() => this.lines.set(this.measureLines()));
    });
  }

  protected isHover(cell: Cell): boolean {
    return this.hover().has(cell.position);
  }

  protected selectNode(cell: Cell): void {
    const esper = this.current();
    if (!esper || !toggleNode(this.board(), esper, cell.x, cell.y)) return;
    this.changed.emit();
  }

  protected hoverNode(cell: Cell | null): void {
    const path = cell && findPathTo(cell.x, cell.y, this.board().nodes);
    this.hover.set(new Set(path ? path.map((node) => positionString(...node.position)) : []));
  }

  /** Leaves the full screen view and forgets the scroll (another Esper is shown). */
  close(): void {
    if (this.gridView()) this.toggleGrid();
    this.scroll = null;
  }

  toggleGrid(): void {
    const pan = this.panWrapper()?.nativeElement;
    if (!pan) return;
    if (this.gridView()) {
      this.scroll = { top: pan.scrollTop, left: pan.scrollLeft };
    } else {
      pan.style.height = `${window.innerHeight - this.host.nativeElement.closest('.esper')!.getBoundingClientRect().top - 15}px`;
    }
    this.gridView.update((v) => !v);
    // the panel is laid out only after the switch
    setTimeout(() => {
      this.scroll ??= this.centerScroll(pan);
      pan.scrollTop = this.scroll.top;
      pan.scrollLeft = this.scroll.left;
    });
  }

  private centerScroll(pan: HTMLElement): { top: number; left: number } {
    const container = this.gridContainer()!.nativeElement;
    const center = container.querySelector<HTMLElement>('li.center');
    if (!center) return { top: 0, left: 0 };
    const scale = this.scale();
    const style = getComputedStyle(container);
    const originTop = center.offsetTop + parseInt(style.marginTop, 10) + center.offsetHeight / 2;
    const originLeft = center.offsetLeft + parseInt(style.marginLeft, 10) + center.offsetWidth / 2;
    return {
      top: Math.abs(pan.offsetHeight / 2 - originTop * scale),
      left: Math.abs(window.innerWidth / 2 - originLeft * scale),
    };
  }

  /** The grid is drawn smaller on phones (a CSS scale). */
  private scale(): number {
    const container = this.gridContainer()?.nativeElement;
    return container ? container.getBoundingClientRect().width / container.offsetWidth || 1 : 1;
  }

  private measureLines(): Line[] {
    const container = this.gridContainer()?.nativeElement;
    const esper = this.current();
    if (!container || !esper) return [];
    const scale = this.scale();
    const origin = container.getBoundingClientRect();
    const centers = new Map<string, { x: number; y: number }>();
    for (const hexagon of this.hexagons()) {
      const rect = hexagon.nativeElement.getBoundingClientRect();
      centers.set(hexagon.nativeElement.dataset['position']!, {
        x: (rect.left - origin.left + rect.width / 2) / scale,
        y: (rect.top - origin.top + rect.height / 2) / scale,
      });
    }
    const lines: Line[] = [];
    const walk = (node: BoardNode, parent: string): void => {
      const position = positionString(...node.position);
      if (distance(...node.position) <= esper.rarity + 1) {
        const from = centers.get(parent);
        const to = centers.get(position);
        if (from && to) lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      }
      node.children.forEach((child) => walk(child, position));
    };
    this.board().nodes.forEach((node) => walk(node, '0_0'));
    return lines;
  }
}
