import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { ScoreGridStore } from './data-access/score-grid.store';

/**
 * Öğrenci Notları ekranı — elle giriş kolu.
 *
 * Dosya kolunun aynı omurgası ama üç aşama yok: uzlaştırılacak bir dosya olmadığı
 * için ekran doğrudan notlara açılıyor. Yapı burada **değiştirilemez** — etkinlik ve
 * soru eklemek/silmek ders açılışı ekranının işi.
 *
 * SATIRLAR SINIF LİSTESİNDEN gelir; notu olmayan öğrenci de görünür. Eskiden grid
 * öğrenciyi "en az bir notu olan" diye tanımlıyordu ve ilk notu buradan girmek
 * mümkün değildi.
 */
@Component({
  selector: 'app-scores-page',
  imports: [FormsModule, Message, Select, Skeleton, Tooltip, HasAction],
  providers: [OfferingContextStore, ScoreGridStore],
  templateUrl: './scores-page.html',
  styleUrl: './scores-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoresPage implements OnInit {
  protected readonly store = inject(ScoreGridStore);
  protected readonly context = inject(OfferingContextStore);

  ngOnInit(): void {
    void this.context.load();
  }

  protected onSemesterChange(semesterId: number | null): void {
    this.context.semesterId.set(semesterId);
    void this.context.loadOfferings().then(() => this.store.load());
  }

  protected onOfferingChange(offeringId: number | null): void {
    this.context.offeringId.set(offeringId);
    void this.store.load();
  }

  protected onScoreInput(studentId: number, itemId: number, raw: string): void {
    const value = raw.trim();
    this.store.setValue(studentId, itemId, value === '' ? null : Number(value));
  }

  /**
   * Puan sorunun tam puanını aşıyor mu?
   *
   * Sunucu da reddediyor (`SCORE_EXCEEDS_MAX_POINT`), ama hata hesaba sessizce
   * sızan türden: <code>Puan / TamPuan</code> oranı 1'i aşınca o etkinliğin çıktıya
   * katkısı ağırlığının üstüne çıkar ve sonuç yine makul görünür. Bu yüzden hücrenin
   * kendisinde, yazıldığı anda görünmesi gerekiyor.
   */
  protected exceedsMax(studentId: number, itemId: number, maxPoint: number): boolean {
    const value = this.store.valueOf(studentId, itemId);
    return value !== null && maxPoint > 0 && value > maxPoint;
  }

  protected preview(): void {
    void this.store.preview();
  }

  protected save(): void {
    void this.store.save();
  }

  /** Kaydetme neden kapalı? Boşsa serbest. */
  protected readonly saveBlockedReason = computed(() => {
    if (this.store.dirtyCount() === 0) return 'Değişiklik yok.';
    return null;
  });
}
