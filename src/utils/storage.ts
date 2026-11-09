import { RekapRecord } from '../types';

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
