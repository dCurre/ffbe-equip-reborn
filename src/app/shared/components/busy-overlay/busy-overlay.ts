import { Component } from '@angular/core';

/** A transparent layer over the page with a wait cursor, to block the clicks during a long operation: `@if (busy()) { <app-busy-overlay /> }`. */
@Component({
  selector: 'app-busy-overlay',
  templateUrl: './busy-overlay.html',
  styleUrl: './busy-overlay.css',
})
export class BusyOverlay {}
