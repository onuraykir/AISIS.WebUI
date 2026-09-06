import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  AvailableCourse,
  BulkAssignResult,
  CourseInstructorRoleValue,
  InstructorCandidate,
  OfferingActivityCreateCommand,
  OfferingActivityItemCreateCommand,
  OfferingActivityItemUpdateCommand,
  OfferingActivityUpdateCommand,
  OfferingDetail,
  OfferingListItem,
  StudentCandidate,
} from './offering.models';

/**
 * `api/CourseInSemesterAdmin` uç noktalarının tipli karşılığı.
 *
 * Dönem verilmezse sunucu GÜNCEL dönemi kullanır; ekran yine de açıkça gönderiyor
 * ki kullanıcının seçtiği dönem ile sunucunun varsaydığı ayrışmasın.
 */
@Injectable({ providedIn: 'root' })
export class OfferingAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'CourseInSemesterAdmin';

  getList(semesterId: number | null, search: string): Observable<OfferingListItem[]> {
    const params: Record<string, string | number | boolean> = {};

    if (semesterId !== null) params['semesterId'] = semesterId;
    if (search.trim().length > 0) params['search'] = search.trim();

    return this.api.get<OfferingListItem[]>(this.base, params);
  }

  getById(id: number): Observable<OfferingDetail> {
    return this.api.get<OfferingDetail>(`${this.base}/${id}`);
  }

  getAvailableCourses(
    semesterId: number | null,
    departmentId: number | null,
    search: string,
  ): Observable<AvailableCourse[]> {
    const params: Record<string, string | number | boolean> = {};

    if (semesterId !== null) params['semesterId'] = semesterId;
    if (departmentId !== null) params['departmentId'] = departmentId;
    if (search.trim().length > 0) params['search'] = search.trim();

    return this.api.get<AvailableCourse[]>(`${this.base}/available-courses`, params);
  }

  /** Toplu açılış. Zaten açılmış dersler gerekçesiyle atlanır. */
  create(semesterId: number, courseIds: readonly number[]): Observable<BulkAssignResult> {
    return this.api.post<BulkAssignResult>(this.base, { semesterId, courseIds });
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }

  // ── Hoca ──

  getInstructorCandidates(offeringId: number): Observable<InstructorCandidate[]> {
    return this.api.get<InstructorCandidate[]>(`${this.base}/${offeringId}/instructor-candidates`);
  }

  addInstructor(
    offeringId: number,
    instructorId: number,
    role: CourseInstructorRoleValue,
  ): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${offeringId}/instructors`, {
      instructorId,
      role,
    });
  }

  updateInstructorRole(assignmentId: number, role: CourseInstructorRoleValue): Observable<string> {
    return this.api.putCommand(`${this.base}/instructors/${assignmentId}`, { role });
  }

  removeInstructor(assignmentId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/instructors/${assignmentId}`);
  }

  // ── Öğrenci ──

  getStudentCandidates(
    offeringId: number,
    departmentId: number | null,
    search: string,
  ): Observable<StudentCandidate[]> {
    const params: Record<string, string | number | boolean> = {};

    if (departmentId !== null) params['departmentId'] = departmentId;
    if (search.trim().length > 0) params['search'] = search.trim();

    return this.api.get<StudentCandidate[]>(
      `${this.base}/${offeringId}/student-candidates`,
      params,
    );
  }

  /** Toplu ekleme; sunucu adaylığı yeniden denetler. */
  addStudents(offeringId: number, studentIds: readonly number[]): Observable<BulkAssignResult> {
    return this.api.post<BulkAssignResult>(`${this.base}/${offeringId}/students`, { studentIds });
  }

  removeStudent(enrollmentId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/students/${enrollmentId}`);
  }

  // ── Değerlendirme etkinliği ──

  addActivity(offeringId: number, command: OfferingActivityCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${offeringId}/activities`, command);
  }

  updateActivity(activityId: number, command: OfferingActivityUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/activities/${activityId}`, command);
  }

  removeActivity(activityId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/activities/${activityId}`);
  }

  // ── Sorular ──
  // Etkinliğin bir alt seviyesi; aynı uç ailesi, aynı kapı. Tam puan buradan girilir.

  addActivityItem(
    activityId: number,
    command: OfferingActivityItemCreateCommand,
  ): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/activities/${activityId}/items`, command);
  }

  updateActivityItem(
    itemId: number,
    command: OfferingActivityItemUpdateCommand,
  ): Observable<string> {
    return this.api.putCommand(`${this.base}/items/${itemId}`, command);
  }

  removeActivityItem(itemId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/items/${itemId}`);
  }
}
