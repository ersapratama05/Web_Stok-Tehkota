import { ExpenseItem, GulaDetail, RekapRecord, StockItemRow } from '../types';

export const JAKARTA_TIMEZONE = 'Asia/Jakarta';

/**
 * Rumus Stok Akhir (ST)
 * ST = SA + IN - OUT
 */
export function calculateStokAkhir(sa: number, inQty: number, outQty: number): number {
  const saNum = Number(sa) || 0;
  const inNum = Number(inQty) || 0;
  const outNum = Number(outQty) || 0;
  return Math.round((saNum + inNum - outNum) * 100) / 100;
}

/**
 * Rumus Perhitungan Khusus SO CUP:
 * Ketentuan 1 slop = 50 pcs
 * SO = (slop * 50) + pcs
 */
export function calculateCupSO(slop: number, pcs: number): number {
  const s = Math.max(0, parseInt(String(slop), 10) || 0);
  const p = Math.max(0, parseInt(String(pcs), 10) || 0);
  return s * 50 + p;
}

/**
 * Daftar produk yang memiliki kalkulator SO khusus (Jumlah Eceran + Jumlah PCS)
 */
export const SO_CALCULATOR_PRODUCTS = [
  'LEMON',
  'LECI',
  'PASSION',
  'MELON',
  'APEL',
  'MANGGA',
  'GRAPE',
] as const;

export function isProductSoCalculatorItem(name: string): boolean {
  return (SO_CALCULATOR_PRODUCTS as readonly string[]).includes(name);
}

/**
 * Rumus Perhitungan SO Produk (LEMON, LECI, PASSION, MELON, APEL, MANGGA, GRAPE):
 * Total SO = Jumlah Eceran + Jumlah PCS
 */
export function calculateProductEceranPcsSO(
  eceran: number | string | null | undefined,
  pcs: number | string | null | undefined
): number {
  const e = Math.max(0, Number(eceran) || 0);
  const p = Math.max(0, Number(pcs) || 0);
  return Math.round((e + p) * 100) / 100;
}

/**
 * Konversi satuan pengiriman barang ke satuan stok gudang outlet
 * Khusus CUP: 1 slop = 50 pcs
 */
export function convertTransferQtyToStockQty(itemName: string, qty: number, unit: string): number {
  const cleanQty = Math.max(0, Number(qty) || 0);
  if (itemName.toUpperCase() === 'CUP' && unit.toLowerCase() === 'slop') {
    return Math.round(cleanQty * 50 * 100) / 100;
  }
  return Math.round(cleanQty * 100) / 100;
}

/**
 * Rumus Perhitungan Gula:
 * habis gula = (ambil + gula kemarin) - sisa gula - gula cair
 */
export function calculateHabisGula(
  gulaAmbil: number | string | undefined | null,
  gulaKemarin: number | string | undefined | null,
  sisaGula: number | string | undefined | null,
  gulaCair: number | string | undefined | null
): number {
  const ambil = Number(gulaAmbil) || 0;
  const kemarin = Number(gulaKemarin) || 0;
  const sisa = Number(sisaGula) || 0;
  const cair = Number(gulaCair) || 0;
  const result = ambil + kemarin - sisa - cair;
  return Math.round(result * 100) / 100;
}

/**
 * Validasi bahwa nilai angka gula benar-benar terisi (bukan null/undefined/string kosong/NaN/negatif)
 */
export function isValidGulaNumber(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0;
}

/**
 * Rumus Gula Kemarin Berikutnya:
 * Gula Kemarin Berikutnya = Sisa Gula Fisik Sebelumnya + Gula Cair Sebelumnya
 */
export function calculateGulaKemarinCarryover(
  sisaGula: number | string | undefined | null,
  gulaCair: number | string | undefined | null
): number {
  const sisa = Math.max(0, Number(sisaGula) || 0);
  const cair = Math.max(0, Number(gulaCair) || 0);
  return Math.round((sisa + cair) * 100) / 100;
}

/**
 * Mengambil nilai Gula Kemarin secara aman dari rekapan terdekat sebelumnya pada cabang yang sama.
 * - Tidak mengambil data dari outlet berbeda maupun tanggal >= targetDate
 * - Jika tidak ada rekapan sebelumnya: hasPreviousRecord = false, hasPreviousGula = false, gulaKemarin = 0
 * - Jika rekapan sebelumnya masih draft atau sisaGula/gulaCair kosong/belum lengkap:
 *   tidak dianggap terkonfirmasi (hasPreviousGula = false, isIncomplete = true, gulaKemarin = 0)
 */
export function resolvePreviousGulaCarryover(
  records: Array<{
    branch: string;
    date: string;
    status?: string;
    gulaDetail?: Partial<GulaDetail> | null;
  }>,
  branch: string,
  targetDate: string
): {
  hasPreviousRecord: boolean;
  hasPreviousGula: boolean;
  isIncomplete: boolean;
  previousDate?: string;
  gulaKemarin: number;
} {
  if (!Array.isArray(records) || !branch || !targetDate) {
    return {
      hasPreviousRecord: false,
      hasPreviousGula: false,
      isIncomplete: false,
      gulaKemarin: 0,
    };
  }

  const priorRecords = records
    .filter((r) => r && r.branch === branch && typeof r.date === 'string' && r.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  const previousRecord = priorRecords[0];
  if (!previousRecord) {
    return {
      hasPreviousRecord: false,
      hasPreviousGula: false,
      isIncomplete: false,
      gulaKemarin: 0,
    };
  }

  const gd = previousRecord.gulaDetail;
  const isComplete =
    previousRecord.status !== 'draft' &&
    Boolean(gd) &&
    isValidGulaNumber(gd?.sisaGula) &&
    isValidGulaNumber(gd?.gulaCair);

  if (!isComplete) {
    return {
      hasPreviousRecord: true,
      hasPreviousGula: false,
      isIncomplete: true,
      previousDate: previousRecord.date,
      gulaKemarin: 0,
    };
  }

  return {
    hasPreviousRecord: true,
    hasPreviousGula: true,
    isIncomplete: false,
    previousDate: previousRecord.date,
    gulaKemarin: calculateGulaKemarinCarryover(gd!.sisaGula, gd!.gulaCair),
  };
}

/**
 * Validasi input perhitungan gula agar tidak negatif atau tidak masuk akal
 */
export function validateGulaDetail(gula: Partial<GulaDetail>): { valid: boolean; warning?: string; error?: string } {
  const ambil = Number(gula.gulaAmbil) || 0;
  const kemarin = Number(gula.gulaKemarin) || 0;
  const sisa = Number(gula.sisaGula) || 0;
  const cair = Number(gula.gulaCair) || 0;

  if (ambil < 0 || kemarin < 0 || sisa < 0 || cair < 0) {
    return {
      valid: false,
      error: 'Angka input gula (Ambil, Kemarin, Sisa, Cair) tidak boleh bernilai negatif.',
    };
  }

  const habis = calculateHabisGula(ambil, kemarin, sisa, cair);
  if (habis < 0) {
    return {
      valid: false,
      error: `Hasil Gula Habis bernilai negatif (${habis} KG). Sisa Gula + Gula Cair (${Math.round((sisa + cair) * 100) / 100} KG) melebihi total stok tersedia (${Math.round((ambil + kemarin) * 100) / 100} KG). Mohon periksa kembali angka input.`,
    };
  }

  if (habis > 100) {
    return {
      valid: true,
      warning: `Pemakaian gula tercatat cukup tinggi (${habis} KG). Pastikan satuan yang diinput benar dalam KG.`,
    };
  }

  return { valid: true };
}

/**
 * Total Pengeluaran otomatis dari seluruh baris form pengeluaran
 */
export function calculateTotalPengeluaran(expenses: ExpenseItem[]): number {
  if (!Array.isArray(expenses) || expenses.length === 0) return 0;
  return expenses.reduce((sum, item) => {
    const val = Number(item.amount) || 0;
    return sum + val;
  }, 0);
}

/**
 * Rumus Perhitungan Omzet Kotor:
 * OMZET KOTOR = PENGELUARAN + QRIS + OMZET BERSIH
 */
export function calculateOmsetKotor(
  totalPengeluaran: number,
  qris: number,
  omsetBersih: number
): number {
  const pengeluaran = Number(totalPengeluaran) || 0;
  const qrisVal = Number(qris) || 0;
  const bersih = Number(omsetBersih) || 0;
  return pengeluaran + qrisVal + bersih;
}

/**
 * Rumus Turunan Omset Akhir / Bersih (untuk kompatibilitas data lama):
 * OMSET BERSIH = OMZET KOTOR - PENGELUARAN - QRIS
 */
export function calculateOmsetAkhir(totalOmset: number, totalPengeluaran: number, qris: number): number {
  const omset = Number(totalOmset) || 0;
  const pengeluaran = Number(totalPengeluaran) || 0;
  const qrisVal = Number(qris) || 0;
  return omset - pengeluaran - qrisVal;
}

/**
 * Normalisasi nilai SO (Stok Opname):
 * - Kosong (null / undefined / '') tetap null agar tidak dianggap 0 sebelum kasir mengisi stok fisik.
 * - Angka valid >= 0 dipertahankan (termasuk 0 jika kasir memang mengisi 0).
 */
export function normalizeSoValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.round(num * 100) / 100);
}

/**
 * Selisih SO vs ST (Stok Opname - Stok Akhir Buku)
 * Hanya dihitung setelah SO diisi; mengembalikan null jika SO masih kosong.
 */
export function calculateStokSelisih(
  st: number,
  so: number | string | null | undefined
): number | null {
  const normalizedSo = normalizeSoValue(so);
  if (normalizedSo === null) return null;
  const stVal = Number(st) || 0;
  return Math.round((normalizedSo - stVal) * 100) / 100;
}

/**
 * Menyelaraskan baris stok lokal/draf dengan SA carryover terbaru dari server.
 * - SA (read-only) diperbarui mengikuti ST hari sebelumnya (atau defaultSa jika belum ada rekapan sebelumnya)
 * - ST dihitung ulang dengan rumus wajib: ST = SA + IN - OUT
 * - Input kasir (IN, OUT, SO, cupDetail, soDetail) tetap dipertahankan utuh
 */
export function reconcileStockRowsWithCarryover(
  currentRows: StockItemRow[] | undefined | null,
  prevStocksMap: Record<string, number> | undefined,
  baseRows: StockItemRow[]
): { stocks: StockItemRow[]; changed: boolean } {
  const existingMap = new Map<string, StockItemRow>();
  if (Array.isArray(currentRows)) {
    for (const row of currentRows) {
      if (row && row.name) {
        existingMap.set(row.name, row);
      }
    }
  }

  let changed = !Array.isArray(currentRows) || currentRows.length !== baseRows.length;

  const stocks: StockItemRow[] = baseRows.map((baseRow) => {
    const existing = existingMap.get(baseRow.name);
    const nextSa =
      prevStocksMap && prevStocksMap[baseRow.name] !== undefined
        ? Number(prevStocksMap[baseRow.name]) || 0
        : baseRow.sa;
    const inQty = existing ? Math.max(0, Number(existing.inQty) || 0) : 0;
    const outQty = existing ? Math.max(0, Number(existing.outQty) || 0) : 0;
    const nextSt = calculateStokAkhir(nextSa, inQty, outQty);

    if (!existing || existing.sa !== nextSa || existing.st !== nextSt) {
      changed = true;
    }

    return {
      ...baseRow,
      ...(existing || {}),
      name: baseRow.name,
      category: baseRow.category,
      unit: baseRow.unit,
      sa: nextSa,
      inQty,
      outQty,
      st: nextSt,
      so: existing ? normalizeSoValue(existing.so) : null,
    };
  });

  return { stocks, changed };
}

/**
 * Mengecek apakah draf lokal benar-benar berisi input kasir (bukan draf kosong hasil pembukaan form).
 */
export function hasMeaningfulDraftContent(draft: Partial<RekapRecord> | null | undefined): boolean {
  if (!draft || typeof draft !== 'object') return false;
  if (Array.isArray(draft.expenses) && draft.expenses.length > 0) return true;
  if (Number(draft.omsetAkhir) > 0 || Number(draft.qris) > 0) return true;
  if (typeof draft.notes === 'string' && draft.notes.trim().length > 0) return true;
  if (draft.gulaDetail) {
    if (
      Number(draft.gulaDetail.gulaAmbil) > 0 ||
      Number(draft.gulaDetail.sisaGula) > 0 ||
      Number(draft.gulaDetail.gulaCair) > 0
    ) {
      return true;
    }
  }
  if (Array.isArray(draft.stocks)) {
    for (const s of draft.stocks) {
      if (!s) continue;
      if (Number(s.inQty) > 0 || Number(s.outQty) > 0) return true;
      if (s.so !== null && s.so !== undefined) return true;
      if (s.cupDetail || s.soDetail) return true;
    }
  }
  return false;
}

/**
 * Format Angka ke Rupiah Indonesia (Rp)
 */
export function formatRupiah(value: number | string | undefined | null): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format Angka Biasa dengan pemisah ribuan titik
 */
export function formatNumberId(value: number | string | undefined | null): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Parse input string Rupiah ke integer
 */
export function parseRupiahInput(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Format tanggal dalam zona waktu Asia/Jakarta (WIB) menjadi YYYY-MM-DD
 */
export function formatDateJakarta(dateObj: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dateObj);

  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

/**
 * Mendapatkan tanggal hari ini (WIB / Asia/Jakarta) dalam format YYYY-MM-DD
 */
export function getTodayDateStr(): string {
  return formatDateJakarta(new Date());
}

/**
 * Mendapatkan tanggal mundur N hari dari hari ini (WIB / Asia/Jakarta) dalam format YYYY-MM-DD
 */
export function getJakartaDateOffsetStr(daysOffset: number): string {
  const todayStr = getTodayDateStr();
  const [y, m, d] = todayStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + daysOffset, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

/**
 * Mendapatkan tanggal kemarin (WIB / Asia/Jakarta) dalam format YYYY-MM-DD
 */
export function getYesterdayDateStr(): string {
  return getJakartaDateOffsetStr(-1);
}

/**
 * Mendapatkan bulan berjalan (WIB / Asia/Jakarta) dalam format YYYY-MM
 */
export function getCurrentMonthStr(): string {
  return getTodayDateStr().slice(0, 7);
}

/**
 * Mendapatkan jam sekarang dalam zona waktu Asia/Jakarta (HH:mm:ss)
 */
export function getJakartaTimeStr(dateObj: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(dateObj);
}

/**
 * Format tanggal Indonesia: Rabu, 4 November 2026
 */
export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}
