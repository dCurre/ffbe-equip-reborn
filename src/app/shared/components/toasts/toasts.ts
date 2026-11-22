import { Component, inject } from '@angular/core';
import { Toast } from '../../services/toast';

@Component({
  selector: 'app-toasts',
  templateUrl: './toasts.html',
  styleUrl: './toasts.css',
})
export class Toasts {
  protected readonly toast = inject(Toast);
}
