import { SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminFilterBar } from '../shared/admin-filter-bar/admin-filter-bar';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { PeopleStore } from './data-access/people.store';
import {
  PersonRoleRecord,
  PersonSearchItem,
  PersonUpdateCommand,
} from './data-access/people.models';
import { PersonFormDialog } from './ui/person-form-dialog';

/** Künyedeki üç kutu. Şeritler tek listede BİRLEŞTİRİLMEZ. */
interface Lane {
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly numberLabel: string;
  readonly empty: string;
  readonly records: readonly PersonRoleRecord[];
}

/**
 * Kişiler ekranı (akıllı bileşen).
 *
 * ŞERİTLERİN BULUŞMA NOKTASI, kayıt yeri değil: buradan yeni kayıt açılmaz —
 * kayıt her zaman şeridin kendi ekranından, TCKN ile başlar (K-A). Silme de yok:
 * kişiyi silmek üç şeridin geçmişini birden götürürdü.
 *
 * Şeritler tek listede birleştirilmedi. Birleştirilseydi "kişinin numarası" diye
 * tek bir sütun olurdu; oysa öğrenci numarası ile akademik sicil ayrı kütüklerin
 * sayılarıdır ve aynı anda ikisi de bulunabilir.
 */
@Component({
  selector: 'app-people-page',
  imports: [
    SlicePipe,
    Message,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    AdminFilterBar,
    PersonFormDialog,
  ],
  providers: [PeopleStore],
  templateUrl: './people-page.html',
  styleUrl: './people-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePage implements OnInit {
  private readonly router = inject(Router);

  protected readonly store = inject(PeopleStore);

  protected readonly formOpen = signal(false);

  protected readonly detail = this.store.detail;

  /** Üç şerit, aynı sırayla, hep aynı kutularda. */
  protected readonly lanes = computed<Lane[]>(() => {
    const detail = this.detail();

    return [
      {
        title: 'Öğrencilik',
        icon: 'pi pi-graduation-cap',
        route: '/tanim/ogrenci',
        numberLabel: 'Öğrenci no',
        empty: 'Öğrencilik kaydı yok.',
        records: detail?.studentRecords ?? [],
      },
      {
        title: 'Akademik',
        icon: 'pi pi-id-card',
        route: '/tanim/ogretim-elemani',
        numberLabel: 'Sicil',
        empty: 'Akademik kayıt yok.',
        records: detail?.instructorRecords ?? [],
      },
      {
        title: 'İdari',
        icon: 'pi pi-briefcase',
        route: '/tanim/personel',
        numberLabel: 'Sicil',
        empty: 'İdari kayıt yok.',
        records: detail?.staffRecords ?? [],
      },
    ];
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  /** Arama sunucuda; her tuş vuruşunda istek atılmaz. */
  protected onSearchChange(value: string): void {
    this.store.search.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.store.load(), 350);
  }

  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.store.resetFilters();
    void this.store.load();
  }

  protected select(item: PersonSearchItem): void {
    void this.store.select(item.id);
  }

  protected openRecordCount(item: PersonSearchItem): number {
    return item.openStudentCount + item.openInstructorCount + item.openStaffCount;
  }

  /** Şeridin kendi ekranına geçer; oradaki arama kutusu TCKN ile süzülür. */
  protected openLane(lane: Lane): void {
    const nationalId = this.detail()?.person.nationalId;

    void this.router.navigate([lane.route], {
      queryParams: nationalId ? { ara: nationalId } : undefined,
    });
  }

  protected openEdit(): void {
    if (this.detail()) {
      this.formOpen.set(true);
    }
  }

  protected async onSave(command: PersonUpdateCommand): Promise<void> {
    if (await this.store.update(this.detail()!.person.id, command)) {
      this.formOpen.set(false);
    }
  }
}
