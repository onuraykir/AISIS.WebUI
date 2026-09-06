/**
 * PÇ – DERS EŞLEŞTİRME MATRİSİ — `api/CourseProgramOutcomeAdmin` sözleşmesi.
 *
 * Bağ **ders tanımına** aittir, açılışa değil: "CENG111 PÇ1'e etki eder" kuralı her
 * dönem aynıdır. Bu yüzden matris dönem seçmeden açılır.
 *
 * **Katsayı yoktur.** Katkının büyüklüğü ders çıktılarından hesaplanıp eşikle
 * karşılaştırılıyor ve `1/0`'a düşüyor; üyelik yalnızca "bu ders o hesaba girer mi"
 * sorusunu cevaplıyor.
 */

export interface CourseProgramOutcomeMatrix {
  readonly programOutcomes: readonly MatrixProgramOutcome[];
  readonly courses: readonly MatrixCourse[];
}

export interface MatrixProgramOutcome {
  readonly id: number;
  readonly code: string;
  readonly description: string;
  readonly version: string;

  /**
   * Bu çıktıya katkı veren ders sayısı. **Sıfırsa o çıktı için hiçbir öğrenciye sonuç
   * yazılmaz** — ekranın göstermesi gereken en önemli boşluk budur.
   *
   * Süzgeçten bağımsızdır: ekranda bölüme göre daraltılmış bir liste görünüyor olsa
   * bile bu sayı bütün dersler üzerinden gelir.
   */
  readonly linkedCourseCount: number;

  /** Yürürlükteki geçme eşiği; yoksa null. Eşiksiz çıktı hesabı **durdurur**. */
  readonly passingThreshold: number | null;
}

export interface MatrixCourse {
  readonly courseId: number;
  readonly courseCode: string;
  readonly name: string;
  readonly programOutcomeIds: readonly number[];
}

/** Bir dersin üyeliklerini **tümüyle** yeniden yazar; kısmi güncelleme değildir. */
export interface CourseProgramOutcomeSetCommand {
  readonly programOutcomeIds: number[];
}
