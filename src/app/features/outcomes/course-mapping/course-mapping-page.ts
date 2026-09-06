import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { DepartmentAdminApi } from '@features/admin/departments/data-access/department-admin.api';
import { DepartmentOption } from '@features/admin/departments/data-access/department.models';
import { CourseMappingStore } from './data-access/course-mapping.store';
import { MatrixProgramOutcome } from './data-access/course-mapping.models';

/**
 * PÇ – Ders Eşleştirme (akıllı bileşen).
 *
 * ZİNCİRİN İLK HALKASI: bu bağ kurulmadan bir dersin çıktı sonuçları hiçbir program
 * çıktısına yazılmaz. Hesap artık bunu söylüyor (`PROGRAM_OUTCOME_LINK_MISSING`);
 * eskiden sessizce eksik sonuç üretiyordu.
 *
 * MATRİS BİÇİMİ BİLİNÇLİ: bu bağ ders başına tek tek değil, program açılırken **toplu**
 * kurulur ve yıllarca aynı kalır. Ders künyesine gömülü bir panel kırk dersi tek tek
 * gezdirirdi. Matris ayrıca "hangi çıktının hiç dersi yok" sorusunu tek bakışta
 * cevaplıyor.
 */
@Component({
  selector: 'app-course-mapping-page',
  imports: [FormsModule, Message, Select, Skeleton, Tooltip, HasAction],
  providers: [CourseMappingStore],
  templateUrl: './course-mapping-page.html',
  styleUrl: './course-mapping-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseMappingPage implements OnInit {
  private readonly departmentApi = inject(DepartmentAdminApi);

  protected readonly store = inject(CourseMappingStore);

  protected readonly departments = signal<readonly DepartmentOption[]>([]);

  /** `path` tam yolu taşıyor ("Mühendislik / Bilgisayar Müh."); ayırt edici olan o. */
  protected readonly departmentOptions = computed(() => [
    { value: null as number | null, label: 'Tüm bölümler' },
    ...this.departments().map((d) => ({ value: d.id as number | null, label: d.path })),
  ]);

  /** Kaydetme neden kapalı? Boşsa serbest. */
  protected readonly saveBlockedReason = computed(() =>
    this.store.dirtyCount() === 0 ? 'Değişiklik yok.' : null,
  );

  ngOnInit(): void {
    void this.loadDepartments();
    void this.store.load();
  }

  private async loadDepartments(): Promise<void> {
    try {
      this.departments.set(await firstValueFrom(this.departmentApi.getOptions()));
    } catch {
      // Sessiz: süzgeç çalışmazsa matris yine tüm derslerle açılır.
      this.departments.set([]);
    }
  }

  protected onDepartmentChange(departmentId: number | null): void {
    this.store.departmentId.set(departmentId);
    void this.store.load();
  }

  protected onSearchChange(term: string): void {
    this.store.search.set(term);
  }

  protected applySearch(): void {
    void this.store.load();
  }

  protected toggle(courseId: number, outcomeId: number): void {
    this.store.toggle(courseId, outcomeId);
  }

  protected save(): void {
    void this.store.save();
  }

  protected discard(): void {
    this.store.discard();
  }

  /** Kolon başlığındaki ipucu: eşik ve katkı dersi sayısı bir arada. */
  protected outcomeHint(outcome: MatrixProgramOutcome): string {
    const linked = this.store.linkedCountOf(outcome);
    const threshold =
      outcome.passingThreshold === null
        ? 'eşik yok — hesap durur'
        : `eşik ${outcome.passingThreshold}`;

    return `${outcome.description}\n${linked} katkı dersi · ${threshold}`;
  }

  protected isOrphan(outcome: MatrixProgramOutcome): boolean {
    return this.store.linkedCountOf(outcome) === 0;
  }
}
