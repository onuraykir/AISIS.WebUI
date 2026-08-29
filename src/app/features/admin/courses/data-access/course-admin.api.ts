import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  CourseCreateCommand,
  CourseDepartmentCreateCommand,
  CourseDepartmentUpdateCommand,
  CourseDetail,
  CourseFilter,
  CourseListItem,
  CourseUpdateCommand,
} from './course.models';

/** `api/CourseAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class CourseAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'CourseAdmin';

  getList(filter: CourseFilter): Observable<CourseListItem[]> {
    const params: Record<string, string | number | boolean> = {};

    if (filter.departmentId !== null) params['departmentId'] = filter.departmentId;
    if (filter.search.trim().length > 0) params['search'] = filter.search.trim();

    return this.api.get<CourseListItem[]>(this.base, params);
  }

  getById(id: number): Observable<CourseDetail> {
    return this.api.get<CourseDetail>(`${this.base}/${id}`);
  }

  create(command: CourseCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: CourseUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }

  // ── Müfredat bağı ──

  addDepartment(courseId: number, command: CourseDepartmentCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${courseId}/departments`, command);
  }

  updateDepartment(linkId: number, command: CourseDepartmentUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/departments/${linkId}`, command);
  }

  removeDepartment(linkId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/departments/${linkId}`);
  }

  // ── Yeterlilik havuzu ──

  /** "Bu hoca bu dersi verebilir." Atama değildir. */
  addInstructor(courseId: number, instructorId: number): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${courseId}/instructors`, { instructorId });
  }

  removeInstructor(linkId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/instructors/${linkId}`);
  }
}
