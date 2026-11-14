import { ExpenseItem, GulaDetail } from '../types';

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
 * Rumus Keuangan Wajib:
 * OMSET AKHIR = TOTAL OMSET - TOTAL PENGELUARAN - QRIS
 */
export function calculateOmsetAkhir(totalOmset: number, totalPengeluaran: number, qris: number): number {
  const omset = Number(totalOmset) || 0;
  const pengeluaran = Number(totalPengeluaran) || 0;
  const qrisVal = Number(qris) || 0;
  return omset - pengeluaran - qrisVal;
}

/**
 * Selisih SO vs ST (Stok Opname - Stok Akhir Buku)
 */
export function calculateStokSelisih(st: number, so: number): number {
  const stVal = Number(st) || 0;
  const soVal = Number(so) || 0;
  return Math.round((soVal - stVal) * 100) / 100;
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
