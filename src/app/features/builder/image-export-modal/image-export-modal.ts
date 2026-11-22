import { Component, effect, ElementRef, input, model, viewChild } from '@angular/core';
import { Modal } from '../../../shared/components/modal/modal';
import { downloadBlob } from '../../../shared/helpers/export';
import { drawTeam } from '../shared/build-image';

/** The picture of the team (one card per unit) with a Download button. */
@Component({
  selector: 'app-image-export-modal',
  imports: [Modal],
  templateUrl: './image-export-modal.html',
  styleUrl: './image-export-modal.css',
})
export class ImageExportModal {
  readonly open = model(false);
  /** the `units` of a link */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the unit data of a link is open
  readonly units = input<any[]>([]);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      if (this.open()) void drawTeam(this.canvas().nativeElement, this.units());
    });
  }

  protected download(): void {
    this.canvas().nativeElement.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(
        blob,
        `${this.units()
          .map((unit) => unit.name)
          .join('-')}.png`,
      );
      this.open.set(false);
    });
  }
}
