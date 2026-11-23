import { Component, input } from '@angular/core';
import { Alert } from '../../../shared/components/alert/alert';
import { Button } from '../../../shared/components/button/button';
import { Panel } from '../../../shared/components/panel/panel';
import { CHALLENGES, ParamChallenge, UnitPool } from '../shared/param-challenge';
import { STRINGS } from '../../../strings/en';

/** The Parameter Challenges: the stat to pass and the units to try; the page looks for the owned unit that does it. */
@Component({
  selector: 'app-challenge-panel',
  imports: [Alert, Button, Panel],
  templateUrl: './challenge-panel.html',
  styleUrl: './challenge-panel.css',
})
export class ChallengePanel {
  protected readonly t = STRINGS.challengePanel;
  readonly challenge = input.required<ParamChallenge>();
  /** the challenges need the owned units and items: a logged-in user */
  readonly available = input.required<boolean>();

  protected readonly challenges = CHALLENGES;
  protected readonly pools: { value: UnitPool; label: string }[] = [
    { value: 'sevenStar', label: STRINGS.challengePanel.only7Units },
    { value: 'potentialSevenStar', label: STRINGS.challengePanel.n7UnitsAndPotential },
    { value: 'rainbows', label: STRINGS.challengePanel.allRainbowUnits },
  ];

  protected chooseChallenge(value: string): void {
    this.challenge().challenge.set(value);
    this.challenge().reset();
  }

  protected choosePool(value: UnitPool): void {
    this.challenge().pool.set(value);
    this.challenge().reset();
  }
}
