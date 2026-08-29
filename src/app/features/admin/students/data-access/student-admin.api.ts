import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import { RoleRecordCreated } from '@features/admin/shared/person/person.models';
import {
  EnrollmentCloseCommand,
  StudentCreateCommand,
  StudentDetail,
  StudentEndCommand,
  StudentEnrollmentCreateCommand,
  StudentEnrollmentUpdateCommand,
  StudentFilter,
  StudentListItem,
  StudentUpdateCommand,
} from './student.models';

/** Öğrenciliğin tamamını kapatan dört uç. Sebep gövdede değil UÇTA (K-D). */
export type StudentEndKind = 'graduate' | 'withdraw' | 'dismiss' | 'transfer';

/** `api/StudentAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class StudentAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'StudentAdmin';

  getList(filter: StudentFilter): Observable<StudentListItem[]> {
    const params: Record<string, string | number | boolean> = {};

    // Boş süzgeç sorgu dizesine HİÇ konmaz: `onlyOpen=` gibi bir parametre
    // sunucuda "false" diye okunur ve sessizce yanlış listeyi getirirdi.
    if (filter.departmentId !== null) params['departmentId'] = filter.departmentId;
    if (filter.onlyOpen !== null) params['onlyOpen'] = filter.onlyOpen;
    if (filter.search.trim().length > 0) params['search'] = filter.search.trim();

    return this.api.get<StudentListItem[]>(this.base, params);
  }

  getById(id: number): Observable<StudentDetail> {
    return this.api.get<StudentDetail>(`${this.base}/${id}`);
  }

  create(command: StudentCreateCommand): Observable<RoleRecordCreated> {
    return this.api.post<RoleRecordCreated>(this.base, command);
  }

  update(id: number, command: StudentUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  // ── Bölüm bağları (K-D, bağ seviyesi) ──

  addEnrollment(studentId: number, command: StudentEnrollmentCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${studentId}/enrollments`, command);
  }

  updateEnrollment(
    enrollmentId: number,
    command: StudentEnrollmentUpdateCommand,
  ): Observable<string> {
    return this.api.putCommand(`${this.base}/enrollments/${enrollmentId}`, command);
  }

  /** Tek bir bölüm bağını kapatır; öğrencilik bundan etkilenmez. */
  closeEnrollment(enrollmentId: number, command: EnrollmentCloseCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/enrollments/${enrollmentId}/close`, command);
  }

  // ── Öğrenciliğin tamamı (K-D, kayıt seviyesi) ──

  /** Kalan açık bölüm bağlarını da aynı sebeple kapatır (E7). */
  end(id: number, kind: StudentEndKind, command: StudentEndCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/${id}/${kind}`, command);
  }

  /** Kayıt dondurma. Sonlandırma DEĞİL: kayıt açık kalır, durumu değişir. */
  setOnLeave(id: number, onLeave: boolean): Observable<string> {
    return this.api.postCommand(`${this.base}/${id}/${onLeave ? 'leave' : 'resume'}`, null);
  }
}
