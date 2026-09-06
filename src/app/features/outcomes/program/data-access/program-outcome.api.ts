import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import {
  ProgramOutcome,
  ProgramOutcomeCreateCommand,
  ProgramOutcomeThreshold,
  ProgramOutcomeThresholdCreateCommand,
  ProgramOutcomeThresholdUpdateCommand,
  ProgramOutcomeUpdateCommand,
} from './program-outcome.models';

/**
 * `api/ProgramOutcome` ve `api/ProgramOutcomeThreshold` uç noktalarının tipli
 * karşılığı. İki controller, tek ekran ailesi.
 */
@Injectable({ providedIn: 'root' })
export class ProgramOutcomeApi {
  private readonly api = inject(ApiClient);
  private readonly outcomes = 'ProgramOutcome';
  private readonly thresholds = 'ProgramOutcomeThreshold';

  // ── Program çıktısı ──

  getAll(): Observable<ProgramOutcome[]> {
    return this.api.get<ProgramOutcome[]>(`${this.outcomes}/get-all-program-outcomes`);
  }

  create(command: ProgramOutcomeCreateCommand): Observable<string> {
    return this.api.postCommand(`${this.outcomes}/create-program-outcome`, command);
  }

  update(id: number, command: ProgramOutcomeUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.outcomes}/update-program-outcome/${id}`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.outcomes}/delete-program-outcome/${id}`);
  }

  // ── Eşik ──

  getThresholds(programOutcomeId: number): Observable<ProgramOutcomeThreshold[]> {
    return this.api.get<ProgramOutcomeThreshold[]>(
      `${this.thresholds}/get-program-outcome-threshold-by-program-outcome-id/${programOutcomeId}`,
    );
  }

  createThreshold(command: ProgramOutcomeThresholdCreateCommand): Observable<string> {
    return this.api.postCommand(
      `${this.thresholds}/create-program-outcome/${command.programOutcomeId}/threshold`,
      command,
    );
  }

  updateThreshold(command: ProgramOutcomeThresholdUpdateCommand): Observable<string> {
    return this.api.putCommand(
      `${this.thresholds}/update-program-outcome/${command.programOutcomeId}/threshold/${command.id}`,
      command,
    );
  }

  /** Yürürlüğü devreder; eskisi sunucuda aynı işlemde düşer. */
  activateThreshold(programOutcomeId: number, thresholdId: number): Observable<string> {
    return this.api.putCommand(
      `${this.thresholds}/make-active-program-outcome/${programOutcomeId}/threshold/${thresholdId}`,
      null,
    );
  }

  removeThreshold(programOutcomeId: number, thresholdId: number): Observable<string> {
    return this.api.deleteCommand(
      `${this.thresholds}/delete-program-outcome/${programOutcomeId}/threshold/${thresholdId}`,
    );
  }
}
