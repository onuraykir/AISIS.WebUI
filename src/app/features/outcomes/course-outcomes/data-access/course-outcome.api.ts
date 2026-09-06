import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import {
  CourseOutcome,
  CourseOutcomeCreateCommand,
  CourseOutcomeUpdateCommand,
} from './course-outcome.models';

/** `api/CourseOutcome` uç noktalarının tipli karşılığı. */
@Injectable({ providedIn: 'root' })
export class CourseOutcomeApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'CourseOutcome';

  /** Bir açılışın çıktıları. Çıktısı olmayan açılışta da 200 döner, liste boş gelir. */
  getByOffering(courseInSemesterId: number): Observable<CourseOutcome[]> {
    return this.api.get<CourseOutcome[]>(
      `${this.base}/get-all-course-outcome-by-course-in-semester-id/${courseInSemesterId}`,
    );
  }

  create(command: CourseOutcomeCreateCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/create-course-outcome`, command);
  }

  /**
   * Adresteki değer AÇILIŞIN Id'sidir, çıktının değil; çıktı Id'si gövdede gider.
   * Sunucu ikisini karşılaştırıp "bu çıktı gerçekten bu açılışa mı ait?" diye
   * doğruluyor — yanlış eşleşmede "Güvenlik ihlali" ile reddediyor.
   */
  update(courseInSemesterId: number, command: CourseOutcomeUpdateCommand): Observable<string> {
    return this.api.putCommand(
      `${this.base}/update-course-outcome/${courseInSemesterId}`,
      command,
    );
  }

  /** Burada Id ÇIKTININ Id'si. Silme yumuşak: kayıt durur, sorgu filtresi dışarıda bırakır. */
  remove(courseOutcomeId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/delete-course-outcome/${courseOutcomeId}`);
  }
}
