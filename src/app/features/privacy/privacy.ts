import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Credits } from '../../shared/components/credits/credits';

/** The privacy policy: what the site stores in the browser and what the Google login gives access to. */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink, Credits],
  templateUrl: './privacy.html',
  styleUrl: './privacy.css',
})
export class Privacy {}
