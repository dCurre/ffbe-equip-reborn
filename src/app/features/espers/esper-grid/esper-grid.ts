import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { KillerList } from '../../../game/components/killer-list/killer-list';
import { ResistList } from '../../../game/components/resist-list/resist-list';
import { Icon } from '../../../shared/components/icon/icon';
import {
  BoardNode,
  distance,
  EsperBoard as Board,
  EsperInfo,
  boardReach,
  esperSprite,
  findPathTo,
  isOutsideBoard,
  OwnedEsper,
  positionString,
  toggleNode,
} from '../esper-model';
import { NodeView, nodeView } from '../node-view';

interface Cell {
  x: number;
  y: number;
  position: string;
  left: number;
  top: number;
  isCenter: boolean;
  selected: boolean;
  /** what the node gives (`hp`, `ability`…), as the classes that color it */
  kinds: string;
  /** the ring is new after a rarity increase: it fades in while the rest of the board stays */
  fresh?: boolean;
  /** a physical and a magical killer: two lines of icons */
  bothKillers?: boolean;
  view?: NodeView;
}

interface Line {
  key: string;
  fresh?: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The size of a hexagon cell, and the distance between two of them in a row and between two rows (pixels of the board). */
const CELL_WIDTH = 92.857;
const CELL_HEIGHT = 107.225;
const COLUMN_PITCH = 102.857;
const ROW_PITCH = 87.225;

/** The training board of an Esper: hexagons to pick the skills from, the lines between them, and the full screen view of phones. */
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
  protected readonly cellWidth = CELL_WIDTH;
  protected readonly cellHeight = CELL_HEIGHT;
  protected readonly hover = signal<ReadonlySet<string>>(new Set());
  private scroll: { top: number; left: number } | null = null;
  private readonly panWrapper = viewChild<ElementRef<HTMLElement>>('panWrapper');
  private readonly gridContainer = viewChild<ElementRef<HTMLElement>>('gridContainer');

  /** After a rarity increase, the distance from the center that the old rarity reached (the nodes farther out are new); otherwise 0. */
  private readonly oldReach = linkedSignal<OwnedEsper | undefined, number>({
    source: this.current,
    computation: (esper, previous) => {
      const before = previous?.source;
      return esper && before && before.name === esper.name && esper.rarity > before.rarity ? boardReach(before.rarity) : 0;
    },
  });

  /** The center and the nodes of the rarity, each placed by where its hexagon goes on the board. */
  protected readonly cells = computed<Cell[]>(() => {
    const esper = this.current();
    const board = this.board();
    const cells: Cell[] = [];
    const place = (x: number, y: number, extra: Partial<Cell>): void => {
      cells.push({
        x,
        y,
        position: positionString(x, y),
        // columns are half a hexagon apart from one row to the next
        left: (x - y / 2 + 4) * COLUMN_PITCH,
        top: (y + 4) * ROW_PITCH,
        isCenter: false,
        selected: false,
        kinds: '',
        ...extra,
      });
    };
    const oldReach = this.oldReach();
    if (!board || !esper) return cells;
    place(0, 0, { isCenter: true, selected: true });
    const collect = (list: BoardNode[]): void =>
      list.forEach((node) => {
        const [x, y] = node.position;
        if (!isOutsideBoard(node, esper.rarity)) {
          const view = nodeView(node);
          place(x, y, {
            selected: esper.selectedSkills.includes(positionString(x, y)),
            fresh: oldReach > 0 && distance(x, y) > oldReach,
            bothKillers: !!node.killers?.some((k) => k.physical) && !!node.killers.some((k) => k.magical),
            kinds: view.kinds.join(' '),
            view,
          });
        }
        collect(node.children);
      });
    collect(board.nodes);
    return cells;
  });

  /** The lines between the nodes, from the center of the hexagon of a node to the one of its parent. */
  protected readonly lines = computed<Line[]>(() => {
    const esper = this.current();
    if (!esper) return [];
    const centers = new Map(
      this.cells().map(({ position, left, top }) => [position, { x: left + CELL_WIDTH / 2, y: top + CELL_HEIGHT / 2 }]),
    );
    const lines: Line[] = [];
    const oldReach = this.oldReach();
    const walk = (node: BoardNode, parent: string): void => {
      const position = positionString(...node.position);
      // a node outside the rarity has no hexagon: no line
      const from = centers.get(parent);
      const to = centers.get(position);
      if (from && to) {
        const fresh = distance(...node.position) > oldReach;
        lines.push({ key: position, x1: from.x, y1: from.y, x2: to.x, y2: to.y, fresh });
      }
      node.children.forEach((child) => walk(child, position));
    };
    this.board().nodes.forEach((node) => walk(node, '0_0'));
    return lines;
  });

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
}
