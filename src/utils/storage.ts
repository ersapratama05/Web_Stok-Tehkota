import { Branch, DashboardStats, MonthlyReportData, RekapRecord } from '../types';

const DRAFT_PREFIX = 'tehkota_draft_';
const SYNC_QUEUE_KEY = 'tehkota_sync_queue';
const CACHE_RECORDS_KEY = 'tehkota_cached_records';

export interface SyncQueueItem {
  id: string;
  action: 'save_record';
  record: RekapRecord;
  queuedAt: string;
}

export function saveLocalDraft(branch: string, date: string, record: Partial<RekapRecord>): void {
  try {
    const key = `${DRAFT_PREFIX}${branch}_${date}`;
    localStorage.setItem(key, JSON.stringify({
      ...record,
      savedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Failed to save local draft:', err);
  }
}

export function getLocalDraft(branch: string, date: string): RekapRecord | null {
  try {
    const key = `${DRAFT_PREFIX}${branch}_${date}`;
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item);
  } catch {
    return null;
  }
}

export function removeLocalDraft(branch: string, date: string): void {
  try {
    const key = `${DRAFT_PREFIX}${branch}_${date}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('Failed to remove local draft:', err);
  }
}

export function clearBranchDrafts(branch: string): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${DRAFT_PREFIX}${branch}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Failed to clear branch drafts:', err);
  }
}

export function addToSyncQueue(record: RekapRecord): void {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
    // Replace if already in queue for same id or branch+date
    const filtered = queue.filter(
      (q) => q.record.id !== record.id && !(q.record.branch === record.branch && q.record.date === record.date)
    );
    filtered.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: 'save_record',
      record,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to add to sync queue:', err);
  }
}

export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSyncQueue(): void {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  } catch (err) {
    console.error('Failed to clear sync queue:', err);
  }
}

export function setCachedRecords(records: RekapRecord[]): void {
  try {
    localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to cache records:', err);
  }
}

export function getCachedRecords(): RekapRecord[] {
  try {
    const raw = localStorage.getItem(CACHE_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecordToLocal(record: RekapRecord): void {
  try {
    const existing = getCachedRecords();
    const idx = existing.findIndex((r) => r.id === record.id || (r.branch === record.branch && r.date === record.date));
    if (idx >= 0) {
      existing[idx] = record;
    } else {
      existing.unshift(record);
    }
    setCachedRecords(existing);
  } catch (err) {
    console.warn('Failed to save record locally:', err);
  }
}

export function getLocalRecords(branch?: Branch | 'All'): RekapRecord[] {
  const records = getCachedRecords();
  if (!branch || branch === 'All') return records;
  return records.filter((r) => r.branch === branch);
}

export function computeLocalDashboardStats(branch?: Branch | 'All', monthStr?: string): DashboardStats {
  const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
  const allRecords = getLocalRecords(branch);
  const monthly = allRecords.filter((r) => r.date.startsWith(targetMonth));

  let totalOmsetKotor = 0;
  let totalOmsetBersih = 0;
  let totalPengeluaran = 0;
  let totalQris = 0;

  for (const r of monthly) {
    totalOmsetKotor += r.totalOmset || 0;
    totalOmsetBersih += r.omsetAkhir || 0;
    totalPengeluaran += r.totalPengeluaran || 0;
    totalQris += r.qris || 0;
  }

  const sortedRecent = [...allRecords]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return {
    branch: branch || 'All',
    monthStr: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    rekapCount: monthly.length,
    recentRekapan: sortedRecent,
  };
}

export function computeLocalMonthlyReport(branch?: Branch | 'All', monthStr?: string): MonthlyReportData {
  const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
  const [yearStr, monthNumStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthNumStr, 10) || new Date().getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const records = getLocalRecords(branch).filter((r) => r.date.startsWith(targetMonth));
  const recordsByDate = new Map<string, RekapRecord>();
  records.forEach((r) => recordsByDate.set(r.date, r));

  let totalOmsetKotor = 0;
  let totalOmsetBersih = 0;
  let totalPengeluaran = 0;
  let totalQris = 0;

  for (const r of records) {
    totalOmsetKotor += r.totalOmset || 0;
    totalOmsetBersih += r.omsetAkhir || 0;
    totalPengeluaran += r.totalPengeluaran || 0;
    totalQris += r.qris || 0;
  }

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const dailyData = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${targetMonth}-${dayStr}`;
    const dateObj = new Date(year, month - 1, d);
    const dayName = dayNames[dateObj.getDay()];
    const rec = recordsByDate.get(fullDate);

    dailyData.push({
      date: fullDate,
      dayName: `${dayName}, ${d}`,
      omsetKotor: rec ? rec.totalOmset : 0,
      pengeluaran: rec ? rec.totalPengeluaran : 0,
      qris: rec ? rec.qris : 0,
      omsetBersih: rec ? rec.omsetAkhir : 0,
      hasRekap: !!rec,
      rekapId: rec?.id,
      status: (rec?.status === 'draft' ? 'draft' : 'saved') as 'draft' | 'saved' | undefined,
    });
  }

  return {
    branch: branch || 'All',
    month: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    daysCount: records.length,
    dailyData,
  };
}
