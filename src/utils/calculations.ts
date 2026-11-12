import { ExpenseItem, StockItemRow } from '../types';

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
  return (s * 50) + p;
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
  const result = (ambil + kemarin) - sisa - cair;
  return Math.round(result * 100) / 100;
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
 * Jika negatif: ada kehilangan barang
 * Jika positif: ada kelebihan fisik
 */
export function calculateStokSelisih(st: number, so: number): number {
  const stVal = Number(st) || 0;
  const soVal = Number(so) || 0;
  return soVal - stVal;
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
  // Hapus semua karakter selain angka
  const cleaned = input.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Mendapatkan tanggal kemarin dalam format YYYY-MM-DD
 */
export function getYesterdayDateStr(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format tanggal Indonesia: 4 November 2026
 */
export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}
