import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { ChangeState } from '@features/assessment/data-access/assessment.models';
import { ImportStage, ScoreImportStore } from './data-access/score-import.store';

/** Adım şeridi; şablonda döngüyle basılıyor. */
interface StageStep {
  readonly id: ImportStage;
  readonly no: number;
  readonly label: string;
}

/**
 * Not Yükleme ekranı — ÜÇ ONAYLI AKIŞ.
 *
 * Sıra bilinçli: önce **kim**, sonra **ne**, en son **kaç puan**. Öğrenci ve yapı
 * uzlaştırılmadan not göstermek, hocaya sonradan geçersiz çıkacak bir tablo
 * göstermek olurdu.
 *
 * DURUMSUZ: taslak istemcide; sunucu her adımda karşılaştırmayı yeniden kuruyor.
 * Sayfadan çıkılırsa yükleme kaybolur — yarım kalmış bir sunucu kaydı bırakmaz.
 */
@Component({
  selector: 'app-score-import-page',
  imports: [FormsModule, Message, Select, Tooltip, HasAction],
  providers: [OfferingContextStore, ScoreImportStore],
  templateUrl: './score-import-page.html',
  styleUrl: './score-import-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreImportPage implements OnInit {
  protected readonly store = inject(ScoreImportStore);
  protected readonly context = inject(OfferingContextStore);

  protected readonly ChangeState = ChangeState;

  protected readonly steps: readonly StageStep[] = [
    { id: 'students', no: 1, label: 'Öğrenciler' },
    { id: 'structure', no: 2, label: 'Etkinlik ve sorular' },
    { id: 'grades', no: 3, label: 'Notlar' },
  ];

  /** Şerit, dosya seçilene kadar gösterilmiyor: henüz bir akış başlamadı. */
  protected readonly showSteps = computed(() => this.store.stage() !== 'file');

  protected readonly currentStepNo = computed(() => {
    const stage = this.store.stage();
    if (stage === 'done') return 4;
    return this.steps.find((step) => step.id === stage)?.no ?? 0;
  });

  ngOnInit(): void {
    void this.context.load();
    void this.store.loadDefinitions();
  }

  protected onSemesterChange(semesterId: number | null): void {
    this.context.semesterId.set(semesterId);
    this.store.reset();
    void this.context.loadOfferings();
  }

  protected onOfferingChange(offeringId: number | null): void {
    this.context.offeringId.set(offeringId);
    this.store.reset();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) void this.store.upload(file);

    // Aynı dosya ikinci kez seçilebilsin diye alan temizleniyor.
    input.value = '';
  }

  protected onScoreInput(studentNumber: string, key: string, raw: string): void {
    const [activityName, itemName] = key.split('::');
    const value = raw.trim();

    this.store.setScore(
      studentNumber,
      activityName ?? '',
      itemName ?? '',
      value === '' ? null : Number(value),
    );
  }

  /**
   * Eksik tam puanı yerinde doldurma. Tanımlayıcı sunucudan `"MT1/MT1_Q3"` biçiminde
   * geliyor; ayrıştırma şablonda değil burada yapılıyor.
   */
  /**
   * Puan sorunun tam puanını aşıyor mu? Sunucu da reddediyor
   * (`SCORE_EXCEEDS_MAX_POINT`), ama hata hesaba sessizce sızan türden — hücrenin
   * kendisinde, yazıldığı anda görünmesi gerekiyor.
   */
  protected exceedsMax(studentNumber: string, key: string, maxPoint: number): boolean {
    const value = this.store.scoreOf(studentNumber, key);
    return value !== null && maxPoint > 0 && value > maxPoint;
  }

  protected onMissingMaxPointInput(identifier: string | undefined, raw: string): void {
    const [activityName, itemName] = (identifier ?? '').split('/');
    if (!activityName || !itemName) return;

    const value = raw.trim();
    this.store.setItemMaxPoint(activityName, itemName, value === '' ? 0 : Number(value));
  }

  /** Taslaktaki etkinliğin seçili türü; karar kutusu bunu okuyor. */
  protected typeOf(activityName: string): number | null {
    const activity = this.store
      .draft()
      ?.assessmentActivityCreates.find((a) => a.activityName === activityName);

    return activity && activity.activityDefinitionId > 0 ? activity.activityDefinitionId : null;
  }

  protected isExcluded(activityName: string): boolean {
    return (
      this.store.draft()?.assessmentActivityCreates.find((a) => a.activityName === activityName)
        ?.isExcluded ?? false
    );
  }

  protected maxPointOf(activityName: string, itemName: string): number | null {
    const item = this.store
      .draft()
      ?.assessmentActivityCreates.find((a) => a.activityName === activityName)
      ?.items.find((i) => i.name === itemName);

    return item && item.totalPoints > 0 ? item.totalPoints : null;
  }

  protected onTypeChange(activityName: string, definitionId: number | null): void {
    if (definitionId === null) return;
    this.store.setActivityType(activityName, definitionId);
  }

  protected toggleExcluded(activityName: string, excluded: boolean): void {
    this.store.setActivityExcluded(activityName, excluded);
  }

  protected back(stage: ImportStage): void {
    this.store.goTo(stage);
  }

  protected approveStudents(): void {
    this.store.approveStudents();
  }

  protected approveStructure(): void {
    void this.store.approveStructure();
  }

  protected confirm(): void {
    void this.store.confirm();
  }

  protected startOver(): void {
    this.store.reset();
  }

  /**
   * 3. aşamanın uyarı metni. "Hazır" DEMİYOR bilerek (D6): puanı girilmemiş öğrenci
   * hesapta 0 sayılıyor ve ders bu hâlde kapatılamıyor.
   */
  protected readonly emptyCellNotice = computed(() => {
    const missing = this.store.missingStudents().length;
    if (missing === 0) return null;

    return (
      `${missing} öğrencinin puanı boş. Boş hücre kayıt yazmaz; çıktı hesabında ` +
      '0 sayılır ve ders bu hâlde kapatılamaz.'
    );
  });
}
