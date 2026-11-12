export type Branch = 'Sompok' | 'Suyudono';

export type UserRole = 'kasir' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  branch: Branch | 'All';
}

export type ItemCategory = 
  | 'Perlengkapan / Bahan Pokok'
  | 'Yoghurt Series'
  | 'Choco Series'
  | 'Tea Series'
  | 'Coffee Series';

export interface CupDetail {
  slop: number;
  pcs: number;
  rusakPcs: number;
  calculatedSo: number; // (slop * 50) + pcs
}

export interface GulaDetail {
  gulaAmbil: number;   // Gula ambil baru hari ini
  gulaKemarin: number; // Gula kemarin
  sisaGula: number;    // Sisa gula fisik (belum cair)
  gulaCair: number;    // Gula cair
  habisGula: number;   // Rumus: (ambil + gulaKemarin) - sisaGula - gulaCair
}

export interface StockItemRow {
  name: string;
  category: ItemCategory;
  unit: string;
  sa: number; // Stok Awal (from previous day ST)
  inQty: number; // Barang Masuk (IN)
  outQty: number; // Barang Keluar (OUT)
  st: number; // Stok Akhir: SA + IN - OUT
  so: number; // Stok Opname (manual or calculated for CUP)
  notes?: string;
  cupDetail?: CupDetail; // only for CUP item
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface AuditChangeDetail {
  field: string;
  label: string;
  before: any;
  after: any;
}

export interface AuditLogEntry {
  id: string;
  recordId: string;
  branch: Branch;
  date: string;
  editedBy: string;
  timestamp: string;
  note?: string;
  changes: AuditChangeDetail[];
}

export type RekapStatus = 'draft' | 'saved' | 'final';

export interface RekapRecord {
  id: string;
  branch: Branch;
  date: string; // YYYY-MM-DD
  timeStr?: string; // HH:mm:ss
  createdAt: string;
  updatedAt: string;
  createdBy: string; // user id or name
  lastEditedBy?: string; // User who last modified the record
  lastEditedAt?: string; // Timestamp of last modification
  revisionCount?: number; // Number of revisions/edits
  status: RekapStatus;
  stocks: StockItemRow[];
  expenses: ExpenseItem[];
  totalOmset: number; // Omset Kotor
  totalPengeluaran: number; // Auto sum of expenses
  qris: number; // Non-tunai
  omsetAkhir: number; // Omset Bersih = totalOmset - totalPengeluaran - qris
  gulaDetail?: GulaDetail; // Rekap kebutuhan gula & perhitungan otomatis
  notes?: string;
  auditLogs?: AuditLogEntry[]; // History of changes made from any device
}

export interface DashboardStats {
  branch: Branch | 'All';
  monthStr: string; // YYYY-MM
  totalOmsetKotor: number;
  totalOmsetBersih: number;
  totalPengeluaran: number;
  totalQris: number;
  rekapCount: number;
  recentRekapan: RekapRecord[];
}

export interface MonthlyReportData {
  branch: Branch | 'All';
  month: string; // YYYY-MM
  totalOmsetKotor: number;
  totalOmsetBersih: number;
  totalPengeluaran: number;
  totalQris: number;
  daysCount: number;
  dailyData: {
    date: string;
    dayName: string;
    omsetKotor: number;
    pengeluaran: number;
    qris: number;
    omsetBersih: number;
    hasRekap: boolean;
    rekapId?: string;
    status?: 'draft' | 'saved';
  }[];
}

export interface AiAnalysisRequest {
  branches: Branch[]; // ['Sompok'], ['Suyudono'], or both
  startDate?: string;
  endDate?: string;
  promptNotes?: string;
}

export interface AiAnalysisResult {
  summary: string;
  stockInsights: string[];
  anomalies: string[];
  lowStockAlerts: { item: string; currentSt: number; recommendation: string }[];
  financialAnalysis: string;
  branchComparison?: string;
  recommendations: string[];
  timestamp: string;
  rawText?: string;
}
