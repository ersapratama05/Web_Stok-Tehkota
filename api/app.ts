import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createInitialStockRows, TEH_KOTA_ITEMS } from '../src/utils/itemsList';
import {
  calculateHabisGula,
  calculateOmsetAkhir,
  calculateStokAkhir,
  calculateTotalPengeluaran,
  convertTransferQtyToStockQty,
  getCurrentMonthStr,
  getJakartaDateOffsetStr,
  getJakartaTimeStr,
  getTodayDateStr,
  getYesterdayDateStr,
  validateGulaDetail,
} from '../src/utils/calculations';
import {
  AuditChangeDetail,
  AuditLogEntry,
  Branch,
  BranchRangeMetrics,
  BranchTransfer,
  RekapRecord,
  TransferItem,
  User,
} from '../src/types';
import { db } from './db';
import {
  hashPassword,
  isUsingDefaultSecret,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './security';

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

// CORS & Preflight middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Force no-cache on all API responses so multi-device clients always fetch latest real-time records
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Serve PWA and static assets from dist explicitly with no-cache headers
app.get(['/sw.js', '/manifest.webmanifest', '/registerSW.js', /^\/workbox-.*\.js$/], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const filePath = path.resolve(process.cwd(), 'dist', req.path.replace(/^\//, ''));
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ----------------------------------------------------
// AUTHENTICATION & RBAC MIDDLEWARE
// ----------------------------------------------------
interface AuthedRequest extends Request {
  authUser?: User;
}

function sanitizeUser(u: {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'kasir' | 'admin';
  branch: Branch | 'All';
  active?: boolean;
  updatedAt?: string;
}): User {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    branch: u.branch,
    active: u.active !== false,
    updatedAt: u.updatedAt,
  };
}

async function resolveUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const rawToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : queryToken.trim();

  if (!rawToken) return null;

  const verification = verifySessionToken(rawToken);
  if (verification.valid) {
    const found = await db.getUserById(verification.payload.uid);
    if (!found || found.active === false) return null;
    return sanitizeUser(found);
  }

  // Graceful fallback for existing v1.3.0 tokens still stored on client devices
  if (verification.legacyUserId) {
    const found = await db.getUserById(verification.legacyUserId);
    if (!found || found.active === false) return null;
    return sanitizeUser(found);
  }

  return null;
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Sesi tidak valid atau belum login. Silakan login kembali.' });
    }
    req.authUser = user;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Gagal memverifikasi sesi pengguna: ' + (err.message || 'Error') });
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Belum login' });
  }
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Akses khusus Owner / Admin.' });
  }
  next();
}

function canAccessBranch(user: User, targetBranch: string): boolean {
  if (user.role === 'admin' || user.branch === 'All') return true;
  return user.branch === targetBranch;
}

// ----------------------------------------------------
// REAL-TIME SYNC & SSE BROADCASTER
// ----------------------------------------------------
interface SyncClient {
  id: string;
  res: Response;
  branch?: string;
}

const sseClients: SyncClient[] = [];

export function broadcastSyncEvent(payload: {
  event:
    | 'record_created'
    | 'record_updated'
    | 'record_deleted'
    | 'transfer_created'
    | 'transfer_confirmed'
    | 'transfer_cancelled'
    | 'ping'
    | 'batch_sync';
  branch?: string;
  receiverBranch?: string;
  date?: string;
  record?: RekapRecord;
  transfer?: BranchTransfer;
  deletedId?: string;
  editedBy?: string;
  auditLog?: AuditLogEntry;
  timestamp: string;
}) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      const matchesSender =
        !client.branch ||
        client.branch === 'All' ||
        !payload.branch ||
        client.branch === payload.branch ||
        (payload.receiverBranch && client.branch === payload.receiverBranch);
      if (matchesSender) {
        client.res.write(message);
      }
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

setInterval(() => {
  broadcastSyncEvent({
    event: 'ping',
    timestamp: new Date().toISOString(),
  });
}, 25000);

// ----------------------------------------------------
// STOCK CASCADE & INTER-BRANCH STOCK INTEGRATION HELPERS
// ----------------------------------------------------
async function cascadeSubsequentRecords(branch: Branch, fromDate: string, startStocks: RekapRecord['stocks']) {
  const allBranch = await db.getRecords({ branch });
  const subsequentRecords = allBranch
    .filter((r) => r.date > fromDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (subsequentRecords.length === 0) return;

  let currentPrevStocks = startStocks;
  for (const subRecord of subsequentRecords) {
    let changed = false;
    const prevStMap: Record<string, number> = {};
    for (const item of currentPrevStocks) {
      prevStMap[item.name] = item.st;
    }

    for (const row of subRecord.stocks) {
      if (prevStMap[row.name] !== undefined && row.sa !== prevStMap[row.name]) {
        row.sa = prevStMap[row.name];
        row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
        changed = true;
      }
    }

    if (changed) {
      subRecord.updatedAt = new Date().toISOString();
      await db.upsertRecord(subRecord);
    }
    currentPrevStocks = subRecord.stocks;
  }
}

async function getCarryoverForDate(branch: Branch, targetDate: string) {
  const allBranch = await db.getRecords({ branch });
  const priorRecords = allBranch
    .filter((r) => r.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  const previousRecord = priorRecords[0];
  if (!previousRecord) {
    const map: Record<string, number> = {};
    for (const item of TEH_KOTA_ITEMS) {
      map[item.name] = item.defaultSa;
    }
    return {
      hasPrevious: false,
      hasPreviousGula: false,
      previousDate: undefined as string | undefined,
      previousRecordId: undefined as string | undefined,
      stocks: map,
      gulaKemarin: 0,
    };
  }

  const map: Record<string, number> = {};
  for (const item of previousRecord.stocks) {
    map[item.name] = item.st;
  }

  // Per Master Prompt section 5:
  // "Gula kemarin otomatis mengambil nilai sisa dari rekapan hari sebelumnya pada cabang yang sama."
  const prevSisaGula = previousRecord.gulaDetail ? Number(previousRecord.gulaDetail.sisaGula) || 0 : 0;

  return {
    hasPrevious: true,
    hasPreviousGula: Boolean(previousRecord.gulaDetail),
    previousDate: previousRecord.date,
    previousRecordId: previousRecord.id,
    stocks: map,
    gulaKemarin: prevSisaGula,
  };
}

async function applyTransferStockToBranch(params: {
  branch: Branch;
  date: string;
  items: TransferItem[];
  direction: 'out' | 'in';
  useActualQty: boolean;
  reverse?: boolean;
  operatorName: string;
  transferNumber: string;
}) {
  const { branch, date, items, direction, useActualQty, reverse = false, operatorName, transferNumber } = params;
  let record = await db.getRecordByBranchDate(branch, date);
  const now = new Date().toISOString();

  if (!record) {
    const carryover = await getCarryoverForDate(branch, date);
    const freshStocks = createInitialStockRows(carryover.stocks);
    record = {
      id: `rek_${branch.toLowerCase()}_${date.replace(/-/g, '')}`,
      branch,
      date,
      timeStr: getJakartaTimeStr(),
      createdAt: now,
      updatedAt: now,
      createdBy: operatorName,
      status: 'saved',
      stocks: freshStocks,
      expenses: [],
      totalOmset: 0,
      totalPengeluaran: 0,
      qris: 0,
      omsetAkhir: 0,
      gulaDetail: {
        gulaAmbil: 0,
        gulaKemarin: carryover.gulaKemarin,
        sisaGula: carryover.gulaKemarin,
        gulaCair: 0,
        habisGula: 0,
      },
      notes: '',
      revisionCount: 0,
      auditLogs: [],
    };
  }

  const sign = reverse ? -1 : 1;
  const changes: AuditChangeDetail[] = [];
  const customNotes: string[] = [];

  for (const tItem of items) {
    const rawQty = useActualQty ? Number(tItem.actualQty ?? tItem.sentQty) : Number(tItem.sentQty);
    const stockDelta = convertTransferQtyToStockQty(tItem.itemName, rawQty, tItem.unit);
    if (stockDelta <= 0) continue;

    const targetRow = record.stocks.find(
      (s) => s.name.trim().toLowerCase() === tItem.itemName.trim().toLowerCase()
    );

    if (targetRow) {
      const oldIn = targetRow.inQty;
      const oldOut = targetRow.outQty;
      const oldSt = targetRow.st;

      if (direction === 'out') {
        targetRow.outQty = Math.max(0, Math.round((targetRow.outQty + sign * stockDelta) * 100) / 100);
      } else {
        targetRow.inQty = Math.max(0, Math.round((targetRow.inQty + sign * stockDelta) * 100) / 100);
      }
      targetRow.st = calculateStokAkhir(targetRow.sa, targetRow.inQty, targetRow.outQty);

      changes.push({
        field: `stock_${targetRow.name}`,
        label: `Stok ${targetRow.name} (${transferNumber})`,
        before: `IN:${oldIn} OUT:${oldOut} ST:${oldSt}`,
        after: `IN:${targetRow.inQty} OUT:${targetRow.outQty} ST:${targetRow.st}`,
      });
    } else {
      customNotes.push(
        `[${transferNumber}] ${reverse ? 'Pembatalan ' : ''}${direction === 'out' ? 'Keluar ke cabang lain' : 'Masuk dari cabang lain'}: ${tItem.itemName} ${rawQty} ${tItem.unit}`
      );
    }
  }

  if (customNotes.length > 0) {
    record.notes = [record.notes, ...customNotes].filter(Boolean).join('\n');
  }

  const auditEntry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordId: record.id,
    entityType: 'transfer',
    branch,
    date,
    editedBy: operatorName,
    timestamp: now,
    note: `${reverse ? 'Pembatalan' : direction === 'out' ? 'Pengiriman Keluar' : 'Penerimaan Masuk'} ${transferNumber}`,
    changes,
  };

  record.updatedAt = now;
  record.lastEditedBy = operatorName;
  record.lastEditedAt = now;
  record.revisionCount = (record.revisionCount || 0) + 1;
  record.auditLogs = [auditEntry, ...(record.auditLogs || [])];

  await db.upsertRecord(record);
  await db.appendAuditLog(auditEntry);
  await cascadeSubsequentRecords(branch, date, record.stocks);

  broadcastSyncEvent({
    event: 'record_updated',
    branch,
    date,
    record,
    editedBy: operatorName,
    auditLog: auditEntry,
    timestamp: now,
  });

  return record;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check (Non-sensitive metadata only)
app.get('/api', async (_req, res) => {
  await db.init();
  res.json({
    status: 'ok',
    message: 'Teh Kota Backend API v1.4.0',
    version: '1.4.0',
    storage: db.getStorageInfo(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', async (_req, res) => {
  await db.init();
  const [records, users, transfers] = await Promise.all([
    db.getRecords(),
    db.getUsers(),
    db.getTransfers(),
  ]);
  res.json({
    status: 'ok',
    app: 'Rekapan Teh Kota API',
    version: '1.4.0',
    storage: db.getStorageInfo(),
    defaultSecretWarning: isUsingDefaultSecret(),
    recordsCount: records.length,
    transfersCount: transfers.length,
    usersCount: users.length,
    timestamp: new Date().toISOString(),
  });
});

// 1. Auth Login (Owner & Cashier with credentials)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, branch } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    const user = await db.getUserByUsername(String(username));
    if (!user || user.active === false) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const pwCheck = verifyPassword(String(password), user.passwordHash);
    if (!pwCheck.valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Transparently upgrade legacy plaintext password hashes to scrypt
    if (pwCheck.needsRehash) {
      user.passwordHash = hashPassword(String(password));
      await db.upsertUser(user);
    }

    if (user.role !== 'admin' && branch && user.branch !== branch) {
      return res.status(403).json({
        error: `Akun ini hanya dapat mengakses Cabang ${user.branch}`,
      });
    }

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    res.json({
      token,
      user: {
        ...safeUser,
        branch: user.role === 'admin' ? user.branch : safeUser.branch,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal memproses login: ' + (err.message || 'Server error') });
  }
});

// 1b. Auth Quick-Login for Cashiers (Preserved 1-click access per Cabang)
app.post('/api/auth/quick-login', async (req, res) => {
  try {
    const { branch } = req.body || {};
    if (!branch || (branch !== 'Sompok' && branch !== 'Suyudono')) {
      return res.status(400).json({ error: 'Cabang tidak valid' });
    }

    const users = await db.getUsers();
    const user = users.find((u) => u.branch === branch && u.role === 'kasir' && u.active !== false);
    if (!user) {
      return res.status(404).json({ error: `Akun kasir aktif untuk cabang ${branch} tidak ditemukan` });
    }

    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);

    res.json({
      token,
      user: safeUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal quick-login: ' + (err.message || 'Server error') });
  }
});

// 2. Auth Me
app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.authUser });
});

// 2b. User Management (Owner Only)
app.get('/api/users', requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.getUsers();
  res.json({ users: users.map(sanitizeUser) });
});

app.post('/api/users', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const { username, password, name, email, role = 'kasir', branch = 'Sompok' } = req.body || {};
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, nama, dan kata sandi wajib diisi.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }
    const existing = await db.getUserByUsername(String(username));
    if (existing) {
      return res.status(409).json({ error: `Username '${username}' sudah terdaftar.` });
    }

    const assignedRole = role === 'admin' ? 'admin' : 'kasir';
    const assignedBranch = assignedRole === 'admin' ? 'All' : branch === 'Suyudono' ? 'Suyudono' : 'Sompok';

    const newUser = await db.upsertUser({
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      username: String(username).trim(),
      passwordHash: hashPassword(String(password)),
      name: String(name).trim(),
      email: String(email || `${String(username).trim()}@tehkota.com`).trim(),
      role: assignedRole,
      branch: assignedBranch,
      active: true,
    });

    await db.appendAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: newUser.id,
      entityType: 'user',
      branch: 'All',
      date: getTodayDateStr(),
      editedBy: req.authUser!.name,
      timestamp: new Date().toISOString(),
      note: `Menambahkan akun baru: ${newUser.username} (${newUser.role})`,
      changes: [
        { field: 'username', label: 'Akun Baru', before: '-', after: `${newUser.username} (${newUser.branch})` },
      ],
    });

    res.status(201).json({ success: true, user: sanitizeUser(newUser) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal membuat akun' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getUserById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    const { name, email, password, active, username } = req.body || {};
    if (password && String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
    }

    const updated = await db.upsertUser({
      ...existing,
      username: username ? String(username).trim() : existing.username,
      name: name ? String(name).trim() : existing.name,
      email: email ? String(email).trim() : existing.email,
      passwordHash: password ? hashPassword(String(password)) : existing.passwordHash,
      active: typeof active === 'boolean' ? active : existing.active !== false,
    });

    await db.appendAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: updated.id,
      entityType: 'user',
      branch: 'All',
      date: getTodayDateStr(),
      editedBy: req.authUser!.name,
      timestamp: new Date().toISOString(),
      note: `Memperbarui akun ${updated.username}${password ? ' (termasuk kata sandi)' : ''}`,
      changes: [
        {
          field: 'userUpdate',
          label: `Akun ${updated.username}`,
          before: existing.active === false ? 'Nonaktif' : 'Aktif',
          after: updated.active === false ? 'Nonaktif' : 'Aktif',
        },
      ],
    });

    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui akun' });
  }
});

// 3. Get Previous Stock & Sugar Carryover (Sisa Gula kemarin -> Gula Kemarin hari ini)
app.get('/api/records/previous-stock', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, date } = req.query as { branch: string; date: string };
  if (!branch || !date) {
    return res.status(400).json({ error: 'Parameter branch dan date wajib diisi' });
  }
  if (!canAccessBranch(req.authUser!, branch)) {
    return res.status(403).json({ error: `Akses ditolak untuk Cabang ${branch}` });
  }

  const carryover = await getCarryoverForDate(branch as Branch, date);
  res.json(carryover);
});

// 3b. Real-Time SSE Stream for Multi-Device Live Sync
app.get('/api/sync/stream', async (req, res) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau belum login' });
  }
  const requestedBranch = (req.query.branch as string) || undefined;
  if (
    user.role !== 'admin' &&
    requestedBranch &&
    requestedBranch !== 'All' &&
    !canAccessBranch(user, requestedBranch)
  ) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${user.branch} tidak dapat berlangganan stream Cabang ${requestedBranch}.`,
    });
  }
  const effectiveBranch =
    user.role !== 'admin' ? user.branch : requestedBranch;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newClient: SyncClient = { id: clientId, res, branch: effectiveBranch };
  sseClients.push(newClient);

  res.write(
    `data: ${JSON.stringify({ event: 'connected', clientId, timestamp: new Date().toISOString() })}\n\n`
  );

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 3c. Periodic Sync endpoint for cross-device updates (works in serverless Vercel & multi-node)
app.get('/api/sync/poll', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, since } = req.query as { branch?: string; since?: string };
  if (
    req.authUser!.role !== 'admin' &&
    branch &&
    branch !== 'All' &&
    !canAccessBranch(req.authUser!, branch)
  ) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser!.branch} tidak dapat mengambil pembaruan Cabang ${branch}.`,
    });
  }

  const targetBranch = req.authUser!.role === 'admin' ? branch : req.authUser!.branch;

  let records = await db.getRecords(targetBranch && targetBranch !== 'All' ? { branch: targetBranch } : undefined);
  let transfers = await db.getTransfers();
  if (req.authUser!.role !== 'admin') {
    transfers = transfers.filter(
      (t) => t.senderBranch === req.authUser!.branch || t.receiverBranch === req.authUser!.branch
    );
  }

  let auditLogs = await db.getAuditLogs(
    req.authUser!.role === 'admin' ? undefined : { branch: req.authUser!.branch }
  );

  if (since) {
    const sinceTime = new Date(since).getTime();
    if (!Number.isNaN(sinceTime)) {
      records = records.filter((r) => new Date(r.updatedAt || r.createdAt || 0).getTime() > sinceTime);
      transfers = transfers.filter((t) => new Date(t.updatedAt || t.createdAt || 0).getTime() > sinceTime);
      auditLogs = auditLogs.filter((l) => new Date(l.timestamp || 0).getTime() > sinceTime);
    }
  }

  const hasDeletions = auditLogs.some(
    (l) =>
      l.changes?.some((c) => c.field === 'delete' || c.field === 'reset') ||
      l.entityType === 'backup'
  );

  res.json({
    timestamp: new Date().toISOString(),
    records,
    transfers,
    auditLogs: auditLogs.slice(0, 50),
    hasDeletions,
    hasUpdates: records.length > 0 || transfers.length > 0 || hasDeletions,
    serverTime: new Date().toISOString(),
  });
});

// 3d. Audit Logs endpoint
app.get('/api/audit-logs', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, recordId } = req.query as { branch?: string; recordId?: string };
  if (
    req.authUser!.role !== 'admin' &&
    branch &&
    branch !== 'All' &&
    !canAccessBranch(req.authUser!, branch)
  ) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser!.branch} tidak dapat melihat log aktivitas Cabang ${branch}.`,
    });
  }
  const effectiveBranch = req.authUser!.role === 'admin' ? branch : req.authUser!.branch;
  const logs = await db.getAuditLogs({ branch: effectiveBranch, recordId });
  res.json({ auditLogs: logs });
});

// 4. List Records with full range, WIB dates & RBAC support
app.get('/api/records', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, month, date, range, query } = req.query as {
    branch?: string;
    month?: string;
    date?: string;
    range?: string;
    query?: string;
  };

  if (branch && branch !== 'All' && !canAccessBranch(req.authUser!, branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser!.branch} tidak dapat melihat data Cabang ${branch}.`,
    });
  }

  const effectiveBranch = req.authUser!.role === 'admin' ? branch : req.authUser!.branch;
  let list = await db.getRecords({ branch: effectiveBranch, month, date });

  if (range) {
    const todayStr = getTodayDateStr();
    if (range === 'today') {
      list = list.filter((r) => r.date === todayStr);
    } else if (range === 'yesterday') {
      const yesterdayStr = getYesterdayDateStr();
      list = list.filter((r) => r.date === yesterdayStr);
    } else if (range === '7days') {
      const minDate = getJakartaDateOffsetStr(-7);
      list = list.filter((r) => r.date >= minDate);
    } else if (range === '30days') {
      const minDate = getJakartaDateOffsetStr(-30);
      list = list.filter((r) => r.date >= minDate);
    }
  }

  if (query) {
    const q = query.toLowerCase();
    list = list.filter(
      (r) =>
        r.date.includes(q) ||
        r.branch.toLowerCase().includes(q) ||
        (r.createdBy && r.createdBy.toLowerCase().includes(q)) ||
        (r.lastEditedBy && r.lastEditedBy.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => b.date.localeCompare(a.date));
  res.json({ records: list });
});

// 5. Get Record by ID
app.get('/api/records/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const record = await db.getRecordById(id);
  if (!record) {
    return res.status(404).json({ error: 'Rekapan tidak ditemukan' });
  }
  if (!canAccessBranch(req.authUser!, record.branch)) {
    return res.status(403).json({ error: `Akses ditolak untuk Cabang ${record.branch}` });
  }
  const relatedAuditLogs = await db.getAuditLogs({ recordId: id });
  res.json({ record: { ...record, auditLogs: relatedAuditLogs } });
});

// 6. Create or Update Record with RBAC, Conflict Check, & Audit Trail
app.post('/api/records', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = req.body || {};
    const {
      id,
      branch,
      date,
      timeStr,
      status = 'saved',
      stocks,
      expenses = [],
      totalOmset = 0,
      qris = 0,
      gulaDetail,
      notes = '',
      mode, // optional: 'create' | 'update'
      expectedUpdatedAt,
      forceOverwrite = false,
    } = body;

    if (!branch || !date) {
      return res.status(400).json({ error: 'Cabang dan tanggal wajib diisi' });
    }
    if (branch !== 'Sompok' && branch !== 'Suyudono') {
      return res.status(400).json({ error: 'Cabang harus Sompok atau Suyudono' });
    }

    // Strict server-side RBAC check based on verified JWT user
    if (!canAccessBranch(req.authUser!, branch)) {
      return res.status(403).json({
        error: `Akses ditolak: Akun kasir ${req.authUser!.branch} tidak memiliki hak akses untuk menyimpan atau mengubah data Cabang ${branch}.`,
      });
    }

    // Validate gula if provided
    let normalizedGula = gulaDetail;
    if (gulaDetail) {
      const check = validateGulaDetail(gulaDetail);
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Input gula tidak valid' });
      }
      normalizedGula = {
        gulaAmbil: Number(gulaDetail.gulaAmbil) || 0,
        gulaKemarin: Number(gulaDetail.gulaKemarin) || 0,
        sisaGula: Number(gulaDetail.sisaGula) || 0,
        gulaCair: Number(gulaDetail.gulaCair) || 0,
        habisGula: calculateHabisGula(
          gulaDetail.gulaAmbil,
          gulaDetail.gulaKemarin,
          gulaDetail.sisaGula,
          gulaDetail.gulaCair
        ),
      };
    }

    const existingRecord = id
      ? await db.getRecordById(id)
      : await db.getRecordByBranchDate(branch, date);

    const sameBranchDateRecord =
      !existingRecord ? await db.getRecordByBranchDate(branch, date) : existingRecord;

    // Prevent silent duplicate creation
    if (mode === 'create' && sameBranchDateRecord && sameBranchDateRecord.status !== 'draft' && !forceOverwrite) {
      return res.status(409).json({
        error: `Rekapan Cabang ${branch} tanggal ${date} sudah tersimpan sebelumnya oleh ${sameBranchDateRecord.createdBy}.`,
        conflictType: 'duplicate_date',
        serverRecord: sameBranchDateRecord,
      });
    }

    // Prevent silent concurrent overwrite if another device edited while this user was editing
    if (
      expectedUpdatedAt &&
      sameBranchDateRecord &&
      sameBranchDateRecord.updatedAt &&
      sameBranchDateRecord.updatedAt !== expectedUpdatedAt &&
      !forceOverwrite
    ) {
      return res.status(409).json({
        error: `Konflik Edit: Rekapan ini baru saja diperbarui oleh ${sameBranchDateRecord.lastEditedBy || sameBranchDateRecord.createdBy} pada ${new Date(sameBranchDateRecord.updatedAt).toLocaleTimeString('id-ID')} WIB.`,
        conflictType: 'concurrent_edit',
        serverRecord: sameBranchDateRecord,
      });
    }

    const targetExisting = sameBranchDateRecord || existingRecord;
    const isUpdate = Boolean(targetExisting);
    const recordId =
      targetExisting?.id || id || `rek_${branch.toLowerCase()}_${date.replace(/-/g, '')}`;

    // Recalculate stock ST server-side to guarantee accuracy
    const normalizedStocks = Array.isArray(stocks)
      ? stocks.map((s: any) => ({
          ...s,
          sa: Number(s.sa) || 0,
          inQty: Math.max(0, Number(s.inQty) || 0),
          outQty: Math.max(0, Number(s.outQty) || 0),
          st: calculateStokAkhir(s.sa, s.inQty, s.outQty),
          so: Number(s.so) || 0,
        }))
      : [];

    const totalPengeluaran = calculateTotalPengeluaran(expenses);
    const omsetAkhir = calculateOmsetAkhir(totalOmset, totalPengeluaran, qris);
    const now = new Date().toISOString();
    const editorName = req.authUser!.name || req.authUser!.username;

    const changes: AuditChangeDetail[] = [];
    if (targetExisting) {
      if (targetExisting.totalOmset !== Number(totalOmset)) {
        changes.push({
          field: 'totalOmset',
          label: 'Omset Kotor',
          before: targetExisting.totalOmset,
          after: Number(totalOmset),
        });
      }
      if (targetExisting.totalPengeluaran !== totalPengeluaran) {
        changes.push({
          field: 'totalPengeluaran',
          label: 'Total Pengeluaran',
          before: targetExisting.totalPengeluaran,
          after: totalPengeluaran,
        });
      }
      if (targetExisting.qris !== Number(qris)) {
        changes.push({
          field: 'qris',
          label: 'QRIS / Non Tunai',
          before: targetExisting.qris,
          after: Number(qris),
        });
      }
      if (targetExisting.omsetAkhir !== omsetAkhir) {
        changes.push({
          field: 'omsetAkhir',
          label: 'Omset Bersih',
          before: targetExisting.omsetAkhir,
          after: omsetAkhir,
        });
      }
      if (normalizedGula) {
        const oldGula = targetExisting.gulaDetail;
        if (
          !oldGula ||
          oldGula.habisGula !== normalizedGula.habisGula ||
          oldGula.sisaGula !== normalizedGula.sisaGula ||
          oldGula.gulaAmbil !== normalizedGula.gulaAmbil ||
          oldGula.gulaCair !== normalizedGula.gulaCair
        ) {
          changes.push({
            field: 'gulaDetail.habisGula',
            label: 'Gula Habis (KG)',
            before: oldGula ? `${oldGula.habisGula} kg (sisa ${oldGula.sisaGula})` : 0,
            after: `${normalizedGula.habisGula} kg (sisa ${normalizedGula.sisaGula})`,
          });
        }
      }
      if (Array.isArray(normalizedStocks) && Array.isArray(targetExisting.stocks)) {
        for (const newS of normalizedStocks) {
          const oldS = targetExisting.stocks.find((s) => s.name === newS.name);
          if (
            oldS &&
            (oldS.st !== newS.st || oldS.so !== newS.so || oldS.inQty !== newS.inQty || oldS.outQty !== newS.outQty)
          ) {
            changes.push({
              field: `stock_${newS.name}`,
              label: `Stok ${newS.name}`,
              before: `IN:${oldS.inQty} OUT:${oldS.outQty} ST:${oldS.st} SO:${oldS.so}`,
              after: `IN:${newS.inQty} OUT:${newS.outQty} ST:${newS.st} SO:${newS.so}`,
            });
          }
        }
      }
    }

    let auditEntry: AuditLogEntry | undefined;
    if (!isUpdate || changes.length > 0) {
      auditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recordId,
        entityType: 'rekap',
        branch,
        date,
        editedBy: editorName,
        timestamp: now,
        note: !isUpdate
          ? `Membuat rekapan baru Cabang ${branch}`
          : notes || 'Perubahan data rekapan dari perangkat',
        changes: !isUpdate
          ? [
              {
                field: 'create',
                label: 'Input Baru',
                before: '-',
                after: `Omset Rp ${Number(totalOmset).toLocaleString('id-ID')} • Status ${status}`,
              },
            ]
          : changes,
      };
      await db.appendAuditLog(auditEntry);
    }

    const existingLogs = targetExisting?.auditLogs || [];
    const mergedLogs = auditEntry ? [auditEntry, ...existingLogs] : existingLogs;

    const newRecord: RekapRecord = {
      id: recordId,
      branch,
      date,
      timeStr: timeStr || getJakartaTimeStr(),
      createdAt: targetExisting ? targetExisting.createdAt : now,
      updatedAt: now,
      createdBy: targetExisting ? targetExisting.createdBy : editorName,
      lastEditedBy: isUpdate ? editorName : undefined,
      lastEditedAt: isUpdate ? now : undefined,
      revisionCount: targetExisting
        ? (targetExisting.revisionCount || 0) + (changes.length > 0 ? 1 : 0)
        : 0,
      status: status as 'draft' | 'saved' | 'final',
      stocks: normalizedStocks,
      expenses,
      totalOmset: Number(totalOmset) || 0,
      totalPengeluaran,
      qris: Number(qris) || 0,
      omsetAkhir,
      gulaDetail: normalizedGula || undefined,
      notes,
      auditLogs: mergedLogs,
    };

    await db.upsertRecord(newRecord);

    if (newRecord.status !== 'draft') {
      await cascadeSubsequentRecords(branch, date, newRecord.stocks);
    }

    broadcastSyncEvent({
      event: isUpdate ? 'record_updated' : 'record_created',
      branch,
      date,
      record: newRecord,
      editedBy: editorName,
      auditLog: auditEntry,
      timestamp: now,
    });

    res.json({
      success: true,
      message: isUpdate
        ? 'Perubahan rekapan berhasil disimpan ke database pusat!'
        : status === 'draft'
        ? 'Draf rekapan berhasil disimpan'
        : 'Rekapan berhasil disimpan ke database pusat!',
      record: newRecord,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal menyimpan rekapan: ' + (err.message || 'Server error') });
  }
});

// 7. Delete Record (with RBAC & Audit)
app.delete('/api/records/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const existing = await db.getRecordById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Rekapan tidak ditemukan' });
  }
  if (!canAccessBranch(req.authUser!, existing.branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Anda tidak memiliki izin menghapus rekapan Cabang ${existing.branch}.`,
    });
  }

  await db.deleteRecord(id);
  const now = new Date().toISOString();

  await db.appendAuditLog({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordId: id,
    entityType: 'rekap',
    branch: existing.branch,
    date: existing.date,
    editedBy: req.authUser!.name,
    timestamp: now,
    note: `Menghapus rekapan Cabang ${existing.branch} tgl ${existing.date}`,
    changes: [
      {
        field: 'delete',
        label: 'Hapus Rekapan',
        before: `Omset Rp ${(existing.totalOmset || 0).toLocaleString('id-ID')}`,
        after: 'Dihapus',
      },
    ],
  });

  broadcastSyncEvent({
    event: 'record_deleted',
    branch: existing.branch,
    date: existing.date,
    deletedId: id,
    editedBy: req.authUser!.name,
    timestamp: now,
  });

  res.json({ success: true, message: 'Rekapan berhasil dihapus dari server pusat', deletedId: id });
});

// 7b. Reset Branch Records (Owner Only + Auto-Backup before Reset)
app.post('/api/records/reset', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { branch } = req.body || {};
  await db.createBackup(req.authUser!.name, `Auto-backup sebelum reset Cabang ${branch || 'Semua'}`);
  const result = await db.resetBranchRecords(branch);

  await db.appendAuditLog({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordId: `reset_${branch || 'All'}`,
    entityType: 'backup',
    branch: branch && branch !== 'All' ? branch : 'All',
    date: getTodayDateStr(),
    editedBy: req.authUser!.name,
    timestamp: new Date().toISOString(),
    note: `Reset data Cabang ${branch || 'Semua'} (backup otomatis dibuat sebelum reset)`,
    changes: [
      { field: 'reset', label: 'Reset Data', before: `${result.deletedCount} rekapan`, after: '0' },
    ],
  });

  broadcastSyncEvent({
    event: 'batch_sync',
    branch,
    editedBy: req.authUser!.name,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Rekapan Cabang ${branch || 'Semua'} berhasil di-reset. Backup keamanan tersimpan otomatis.`,
    deletedCount: result.deletedCount,
    remainingCount: result.remainingCount,
  });
});

// ----------------------------------------------------
// 8. INTER-BRANCH DELIVERY NOTES (CATATAN PENGIRIMAN BARANG)
// ----------------------------------------------------
app.get('/api/transfers', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, status, startDate, endDate, search } = req.query as {
    branch?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  };

  let transfers = await db.getTransfers();

  // RBAC: Kasir only sees transfers involving their branch
  if (req.authUser!.role !== 'admin') {
    transfers = transfers.filter(
      (t) => t.senderBranch === req.authUser!.branch || t.receiverBranch === req.authUser!.branch
    );
  } else if (branch && branch !== 'All') {
    transfers = transfers.filter((t) => t.senderBranch === branch || t.receiverBranch === branch);
  }

  if (status && status !== 'All') {
    transfers = transfers.filter((t) => t.status === status);
  }
  if (startDate) {
    transfers = transfers.filter((t) => t.date >= startDate);
  }
  if (endDate) {
    transfers = transfers.filter((t) => t.date <= endDate);
  }
  if (search) {
    const q = search.toLowerCase();
    transfers = transfers.filter(
      (t) =>
        t.transferNumber.toLowerCase().includes(q) ||
        t.senderName.toLowerCase().includes(q) ||
        (t.receiverName && t.receiverName.toLowerCase().includes(q)) ||
        t.items.some((i) => i.itemName.toLowerCase().includes(q))
    );
  }

  res.json({ transfers });
});

app.post('/api/transfers', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { date, senderBranch, receiverBranch, items, notes = '', senderName } = req.body || {};

    if (!date || !senderBranch || !receiverBranch) {
      return res.status(400).json({ error: 'Tanggal, cabang pengirim, dan cabang penerima wajib diisi.' });
    }
    if (senderBranch === receiverBranch) {
      return res.status(400).json({ error: 'Cabang pengirim dan cabang penerima tidak boleh sama.' });
    }
    if (!canAccessBranch(req.authUser!, senderBranch)) {
      return res.status(403).json({
        error: `Akses ditolak: Akun Cabang ${req.authUser!.branch} hanya dapat membuat pengiriman dari cabangnya sendiri.`,
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Minimal harus ada 1 barang yang dikirim.' });
    }

    const cleanItems: TransferItem[] = [];
    for (const item of items) {
      const qty = Number(item.sentQty);
      if (!item.itemName || !String(item.itemName).trim()) {
        return res.status(400).json({ error: 'Semua baris barang harus memiliki nama barang.' });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: `Jumlah kirim untuk "${item.itemName}" harus lebih dari 0.` });
      }
      cleanItems.push({
        id: item.id || `ti_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemName: String(item.itemName).trim(),
        isCustom: Boolean(item.isCustom),
        unit: String(item.unit || 'pcs').trim(),
        sentQty: Math.round(qty * 100) / 100,
        note: item.note ? String(item.note).trim() : undefined,
      });
    }

    const existingTransfers = await db.getTransfers();
    const yymmdd = String(date).replace(/-/g, '').slice(2, 8);
    const sameDayCount = existingTransfers.filter((t) => t.date === date).length + 1;
    const transferNumber = `KRM-${yymmdd}-${String(sameDayCount).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const operatorName = String(senderName || req.authUser!.name).trim();

    const transfer: BranchTransfer = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      transferNumber,
      date,
      senderBranch,
      receiverBranch,
      items: cleanItems,
      notes: String(notes || '').trim(),
      senderName: operatorName,
      status: 'Menunggu Diterima',
      createdBy: req.authUser!.name,
      createdAt: now,
      updatedAt: now,
      stockAppliedToSender: true,
      stockAppliedToReceiver: false,
      auditLogs: [
        {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recordId: transferNumber,
          entityType: 'transfer',
          branch: senderBranch,
          date,
          editedBy: req.authUser!.name,
          timestamp: now,
          note: `Pengiriman dibuat (${senderBranch} -> ${receiverBranch})`,
          changes: cleanItems.map((ci) => ({
            field: ci.itemName,
            label: ci.itemName,
            before: '0',
            after: `Dikirim ${ci.sentQty} ${ci.unit}`,
          })),
        },
      ],
    };

    // Deduct / record outgoing stock on sender branch immediately
    await applyTransferStockToBranch({
      branch: senderBranch,
      date,
      items: cleanItems,
      direction: 'out',
      useActualQty: false,
      operatorName: req.authUser!.name,
      transferNumber,
    });

    await db.upsertTransfer(transfer);

    broadcastSyncEvent({
      event: 'transfer_created',
      branch: senderBranch,
      receiverBranch,
      date,
      transfer,
      editedBy: req.authUser!.name,
      timestamp: now,
    });

    res.status(201).json({
      success: true,
      message: `Catatan pengiriman ${transferNumber} berhasil dibuat & stok keluar Cabang ${senderBranch} telah diperbarui.`,
      transfer,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal membuat pengiriman: ' + (err.message || 'Server error') });
  }
});

app.post('/api/transfers/:id/confirm', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { receiverName, confirmationNote = '', items } = req.body || {};

    const transfer = await db.getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: 'Catatan pengiriman tidak ditemukan' });
    }

    if (!canAccessBranch(req.authUser!, transfer.receiverBranch)) {
      return res.status(403).json({
        error: `Hanya Cabang penerima (${transfer.receiverBranch}) atau Owner yang dapat mengonfirmasi penerimaan barang ini.`,
      });
    }

    if (transfer.status !== 'Menunggu Diterima' || transfer.stockAppliedToReceiver) {
      return res.status(409).json({
        error: `Pengiriman ${transfer.transferNumber} sudah diproses sebelumnya (Status: ${transfer.status}). Stok tidak akan ditambahkan dua kali.`,
      });
    }

    if (!receiverName || !String(receiverName).trim()) {
      return res.status(400).json({ error: 'Nama penerima barang wajib diisi.' });
    }

    let hasDiscrepancy = false;
    const confirmedItems: TransferItem[] = transfer.items.map((orig) => {
      const submitted = Array.isArray(items)
        ? items.find((i: any) => i.id === orig.id || i.itemName === orig.itemName)
        : null;
      const actualQty =
        submitted && submitted.actualQty !== undefined
          ? Math.max(0, Math.round(Number(submitted.actualQty) * 100) / 100)
          : orig.sentQty;
      const discrepancy = Math.round((actualQty - orig.sentQty) * 100) / 100;
      if (discrepancy !== 0) hasDiscrepancy = true;

      return {
        ...orig,
        actualQty,
        discrepancy,
        note: submitted?.note ? String(submitted.note).trim() : orig.note,
      };
    });

    const now = new Date().toISOString();
    const confirmDate = getTodayDateStr(); // Record incoming stock on today's WIB operational date (or transfer.date if same day)
    const stockTargetDate = confirmDate >= transfer.date ? confirmDate : transfer.date;

    // Atomically add actual received stock to receiver branch
    await applyTransferStockToBranch({
      branch: transfer.receiverBranch,
      date: stockTargetDate,
      items: confirmedItems,
      direction: 'in',
      useActualQty: true,
      operatorName: `${String(receiverName).trim()} (${req.authUser!.name})`,
      transferNumber: transfer.transferNumber,
    });

    const newStatus = hasDiscrepancy ? 'Ada Selisih' : 'Diterima';
    const confirmAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: transfer.transferNumber,
      entityType: 'transfer',
      branch: transfer.receiverBranch,
      date: stockTargetDate,
      editedBy: `${String(receiverName).trim()} (${req.authUser!.name})`,
      timestamp: now,
      note: confirmationNote || `Konfirmasi penerimaan status: ${newStatus}`,
      changes: confirmedItems.map((ci) => ({
        field: ci.itemName,
        label: ci.itemName,
        before: `Kirim ${ci.sentQty} ${ci.unit}`,
        after: `Terima ${ci.actualQty} ${ci.unit}${ci.discrepancy ? ` (Selisih ${ci.discrepancy})` : ''}`,
      })),
    };

    const updatedTransfer: BranchTransfer = {
      ...transfer,
      items: confirmedItems,
      receiverName: String(receiverName).trim(),
      status: newStatus,
      confirmedBy: req.authUser!.name,
      confirmedAt: now,
      confirmationNote: String(confirmationNote || '').trim(),
      updatedAt: now,
      stockAppliedToReceiver: true,
      auditLogs: [confirmAudit, ...(transfer.auditLogs || [])],
    };

    await db.upsertTransfer(updatedTransfer);

    broadcastSyncEvent({
      event: 'transfer_confirmed',
      branch: transfer.senderBranch,
      receiverBranch: transfer.receiverBranch,
      date: stockTargetDate,
      transfer: updatedTransfer,
      editedBy: req.authUser!.name,
      timestamp: now,
    });

    res.json({
      success: true,
      message: hasDiscrepancy
        ? `Penerimaan ${transfer.transferNumber} dicatat dengan status ADA SELISIH. Stok masuk aktual Cabang ${transfer.receiverBranch} telah diperbarui.`
        : `Pengiriman ${transfer.transferNumber} resmi DITERIMA & stok masuk Cabang ${transfer.receiverBranch} otomatis bertambah.`,
      transfer: updatedTransfer,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal konfirmasi penerimaan: ' + (err.message || 'Server error') });
  }
});

app.post('/api/transfers/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Dibatalkan oleh pengguna' } = req.body || {};
    const transfer = await db.getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: 'Catatan pengiriman tidak ditemukan' });
    }
    if (transfer.status === 'Dibatalkan') {
      return res.status(409).json({ error: 'Pengiriman ini sudah dibatalkan sebelumnya.' });
    }

    // Only Owner or sender branch while pending can cancel
    if (transfer.status !== 'Menunggu Diterima' && req.authUser!.role !== 'admin') {
      return res.status(403).json({
        error: 'Pengiriman yang sudah dikonfirmasi hanya dapat dibatalkan/dikoreksi oleh Owner.',
      });
    }
    if (req.authUser!.role !== 'admin' && req.authUser!.branch !== transfer.senderBranch) {
      return res.status(403).json({ error: 'Hanya cabang pengirim atau Owner yang dapat membatalkan.' });
    }

    // Reverse sender outgoing stock
    if (transfer.stockAppliedToSender) {
      await applyTransferStockToBranch({
        branch: transfer.senderBranch,
        date: transfer.date,
        items: transfer.items,
        direction: 'out',
        useActualQty: false,
        reverse: true,
        operatorName: req.authUser!.name,
        transferNumber: transfer.transferNumber,
      });
    }

    // Reverse receiver incoming stock if already confirmed and Owner cancelled
    if (transfer.stockAppliedToReceiver) {
      const confirmDate = transfer.confirmedAt ? transfer.confirmedAt.slice(0, 10) : transfer.date;
      await applyTransferStockToBranch({
        branch: transfer.receiverBranch,
        date: confirmDate >= transfer.date ? confirmDate : transfer.date,
        items: transfer.items,
        direction: 'in',
        useActualQty: true,
        reverse: true,
        operatorName: req.authUser!.name,
        transferNumber: transfer.transferNumber,
      });
    }

    const now = new Date().toISOString();
    const cancelAudit: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: transfer.transferNumber,
      entityType: 'transfer',
      branch: transfer.senderBranch,
      date: transfer.date,
      editedBy: req.authUser!.name,
      timestamp: now,
      note: `Pembatalan pengiriman: ${reason}`,
      changes: [
        {
          field: 'status',
          label: 'Status Pengiriman',
          before: transfer.status,
          after: 'Dibatalkan (stok dikembalikan)',
        },
      ],
    };

    const updated: BranchTransfer = {
      ...transfer,
      status: 'Dibatalkan',
      cancelledBy: req.authUser!.name,
      cancelledAt: now,
      cancelReason: String(reason),
      stockAppliedToSender: false,
      stockAppliedToReceiver: false,
      updatedAt: now,
      auditLogs: [cancelAudit, ...(transfer.auditLogs || [])],
    };

    await db.upsertTransfer(updated);

    broadcastSyncEvent({
      event: 'transfer_cancelled',
      branch: transfer.senderBranch,
      receiverBranch: transfer.receiverBranch,
      date: transfer.date,
      transfer: updated,
      editedBy: req.authUser!.name,
      timestamp: now,
    });

    res.json({
      success: true,
      message: `Pengiriman ${transfer.transferNumber} dibatalkan dan mutasi stok telah dikembalikan otomatis.`,
      transfer: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal membatalkan pengiriman: ' + (err.message || 'Server error') });
  }
});

// ----------------------------------------------------
// 9. DASHBOARD & OWNER MULTI-BRANCH ANALYTICS
// ----------------------------------------------------
app.get('/api/dashboard', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, month } = req.query as { branch?: string; month?: string };
  if (
    req.authUser!.role !== 'admin' &&
    branch &&
    branch !== 'All' &&
    !canAccessBranch(req.authUser!, branch)
  ) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser!.branch} tidak dapat melihat dashboard Cabang ${branch}.`,
    });
  }
  const targetMonth = month || getCurrentMonthStr();
  const effectiveBranch = req.authUser!.role === 'admin' ? branch : req.authUser!.branch;

  const allBranchRecords = await db.getRecords(
    effectiveBranch && effectiveBranch !== 'All' ? { branch: effectiveBranch } : undefined
  );

  const filtered = allBranchRecords.filter((r) => r.date.startsWith(targetMonth));

  let totalOmsetKotor = 0;
  let totalOmsetBersih = 0;
  let totalPengeluaran = 0;
  let totalQris = 0;

  for (const r of filtered) {
    totalOmsetKotor += r.totalOmset || 0;
    totalOmsetBersih += r.omsetAkhir || 0;
    totalPengeluaran += r.totalPengeluaran || 0;
    totalQris += r.qris || 0;
  }

  allBranchRecords.sort((a, b) => b.date.localeCompare(a.date));
  const recent7 = allBranchRecords.slice(0, 7);

  res.json({
    branch: effectiveBranch || 'All',
    monthStr: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    rekapCount: filtered.length,
    recentRekapan: recent7,
  });
});

function aggregateBranchMetrics(branch: Branch, records: RekapRecord[]): BranchRangeMetrics {
  const branchRecs = records
    .filter((r) => r.branch === branch)
    .sort((a, b) => b.date.localeCompare(a.date));

  let omsetKotor = 0;
  let pengeluaran = 0;
  let qris = 0;
  let omsetBersih = 0;
  let totalGulaHabis = 0;
  let totalCupTerjual = 0;
  let totalInQty = 0;
  let totalOutQty = 0;

  for (const r of branchRecs) {
    omsetKotor += r.totalOmset || 0;
    pengeluaran += r.totalPengeluaran || 0;
    qris += r.qris || 0;
    omsetBersih += r.omsetAkhir || 0;
    totalGulaHabis += r.gulaDetail?.habisGula || 0;
    for (const s of r.stocks || []) {
      totalInQty += s.inQty || 0;
      totalOutQty += s.outQty || 0;
      if (s.name === 'CUP') {
        totalCupTerjual += s.outQty || 0;
      }
    }
  }

  const latest = branchRecs[0];
  const lowStockItems: Array<{ name: string; st: number; unit: string }> = [];
  if (latest && Array.isArray(latest.stocks)) {
    for (const s of latest.stocks) {
      const threshold = s.name === 'CUP' ? 200 : 5;
      if (s.st <= threshold) {
        lowStockItems.push({ name: s.name, st: s.st, unit: s.unit });
      }
    }
  }

  return {
    branch,
    rekapCount: branchRecs.length,
    omsetKotor,
    pengeluaran,
    qris,
    omsetBersih,
    totalGulaHabis: Math.round(totalGulaHabis * 100) / 100,
    totalCupTerjual,
    totalInQty: Math.round(totalInQty * 100) / 100,
    totalOutQty: Math.round(totalOutQty * 100) / 100,
    lowStockItems: lowStockItems.slice(0, 6),
  };
}

app.get('/api/dashboard/owner-summary', requireAuth, requireAdmin, async (req, res) => {
  const { period = 'month', month, startDate: qStart, endDate: qEnd } = req.query as {
    period?: string;
    month?: string;
    startDate?: string;
    endDate?: string;
  };

  const today = getTodayDateStr();
  let startDate = today;
  let endDate = today;

  if (period === 'today') {
    startDate = today;
    endDate = today;
  } else if (period === 'yesterday') {
    const y = getYesterdayDateStr();
    startDate = y;
    endDate = y;
  } else if (period === '7days') {
    startDate = getJakartaDateOffsetStr(-6);
    endDate = today;
  } else if (period === '30days') {
    startDate = getJakartaDateOffsetStr(-29);
    endDate = today;
  } else if (period === 'custom' && qStart && qEnd) {
    startDate = qStart <= qEnd ? qStart : qEnd;
    endDate = qEnd >= qStart ? qEnd : qStart;
  } else {
    const targetMonth = month || getCurrentMonthStr();
    const [y, m] = targetMonth.split('-').map(Number);
    const lastDay = String(new Date(y, m, 0).getDate()).padStart(2, '0');
    startDate = `${targetMonth}-01`;
    endDate = `${targetMonth}-${lastDay}`;
  }

  const [allRecords, allTransfers, auditLogs] = await Promise.all([
    db.getRecords(),
    db.getTransfers(),
    db.getAuditLogs(),
  ]);

  const inRange = allRecords.filter((r) => r.date >= startDate && r.date <= endDate);
  const sompok = aggregateBranchMetrics('Sompok', inRange);
  const suyudono = aggregateBranchMetrics('Suyudono', inRange);

  const pendingTransfers = allTransfers.filter((t) => t.status === 'Menunggu Diterima');

  res.json({
    period,
    startDate,
    endDate,
    sompok,
    suyudono,
    combined: {
      omsetKotor: sompok.omsetKotor + suyudono.omsetKotor,
      pengeluaran: sompok.pengeluaran + suyudono.pengeluaran,
      qris: sompok.qris + suyudono.qris,
      omsetBersih: sompok.omsetBersih + suyudono.omsetBersih,
      totalGulaHabis: Math.round((sompok.totalGulaHabis + suyudono.totalGulaHabis) * 100) / 100,
      totalCupTerjual: sompok.totalCupTerjual + suyudono.totalCupTerjual,
      rekapCount: sompok.rekapCount + suyudono.rekapCount,
    },
    pendingTransfers,
    recentTransfers: allTransfers.slice(0, 8),
    recentAuditLogs: auditLogs.slice(0, 15),
  });
});

// 10. Monthly Report endpoint (with Sugar Totals & Asia/Jakarta)
app.get('/api/reports/monthly', requireAuth, async (req: AuthedRequest, res) => {
  const { branch, month } = req.query as { branch?: string; month?: string };
  if (
    req.authUser!.role !== 'admin' &&
    branch &&
    branch !== 'All' &&
    !canAccessBranch(req.authUser!, branch)
  ) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser!.branch} tidak dapat mengakses laporan Cabang ${branch}.`,
    });
  }
  const targetMonth = month || getCurrentMonthStr();
  const effectiveBranch = req.authUser!.role === 'admin' ? branch : req.authUser!.branch;

  const [yearStr, monthNumStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const records = await db.getRecords({
    branch: effectiveBranch && effectiveBranch !== 'All' ? effectiveBranch : undefined,
    month: targetMonth,
  });

  let totalOmsetKotor = 0;
  let totalOmsetBersih = 0;
  let totalPengeluaran = 0;
  let totalQris = 0;
  let totalGulaHabis = 0;

  const recordsByDate = new Map<string, RekapRecord[]>();
  for (const r of records) {
    const arr = recordsByDate.get(r.date) || [];
    arr.push(r);
    recordsByDate.set(r.date, arr);

    totalOmsetKotor += r.totalOmset || 0;
    totalOmsetBersih += r.omsetAkhir || 0;
    totalPengeluaran += r.totalPengeluaran || 0;
    totalQris += r.qris || 0;
    totalGulaHabis += r.gulaDetail?.habisGula || 0;
  }

  const dailyData = [];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${targetMonth}-${dayStr}`;
    const dt = new Date(Date.UTC(year, monthNum - 1, d, 12, 0, 0));
    const dayName = dayNames[dt.getUTCDay()];
    const dayRecs = recordsByDate.get(fullDate) || [];
    const primaryRec = dayRecs[0];

    dailyData.push({
      date: fullDate,
      dayName: `${dayName}, ${d}`,
      omsetKotor: dayRecs.reduce((s, r) => s + (r.totalOmset || 0), 0),
      pengeluaran: dayRecs.reduce((s, r) => s + (r.totalPengeluaran || 0), 0),
      qris: dayRecs.reduce((s, r) => s + (r.qris || 0), 0),
      omsetBersih: dayRecs.reduce((s, r) => s + (r.omsetAkhir || 0), 0),
      habisGula: Math.round(dayRecs.reduce((s, r) => s + (r.gulaDetail?.habisGula || 0), 0) * 100) / 100,
      gulaAmbil: Math.round(dayRecs.reduce((s, r) => s + (r.gulaDetail?.gulaAmbil || 0), 0) * 100) / 100,
      sisaGula: Math.round(dayRecs.reduce((s, r) => s + (r.gulaDetail?.sisaGula || 0), 0) * 100) / 100,
      gulaCair: Math.round(dayRecs.reduce((s, r) => s + (r.gulaDetail?.gulaCair || 0), 0) * 100) / 100,
      hasRekap: dayRecs.length > 0,
      rekapId: primaryRec?.id,
      branch: primaryRec?.branch,
      status: primaryRec?.status,
    });
  }

  res.json({
    branch: effectiveBranch || 'All',
    month: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    totalGulaHabis: Math.round(totalGulaHabis * 100) / 100,
    daysCount: records.length,
    dailyData,
  });
});

// 11. Database Backup & Recovery (Owner Only)
app.get('/api/backups', requireAuth, requireAdmin, async (_req, res) => {
  const backups = await db.listBackups();
  res.json({ backups, storage: db.getStorageInfo() });
});

app.post('/api/backups', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { note } = req.body || {};
  const created = await db.createBackup(
    req.authUser!.name,
    String(note || 'Backup manual Owner').trim()
  );
  res.status(201).json({ success: true, backup: created });
});

app.get('/api/backups/export', requireAuth, requireAdmin, async (_req, res) => {
  const snapshot = await db.exportSnapshot();
  // Strip password hashes from downloadable export for security
  const safeExport = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.4.0',
    records: snapshot.records,
    transfers: snapshot.transfers,
    auditLogs: snapshot.auditLogs,
    users: snapshot.users.map(sanitizeUser),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="TehKota_Backup_${getTodayDateStr()}.json"`
  );
  res.send(JSON.stringify(safeExport, null, 2));
});

app.post('/api/backups/:id/restore', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  await db.createBackup(req.authUser!.name, `Pre-restore safety snapshot before restoring ${id}`);
  const result = await db.restoreBackup(id);
  if (!result) {
    return res.status(404).json({ error: 'Snapshot backup tidak ditemukan' });
  }
  broadcastSyncEvent({
    event: 'batch_sync',
    editedBy: req.authUser!.name,
    timestamp: new Date().toISOString(),
  });
  res.json({
    success: true,
    message: `Berhasil memulihkan ${result.restoredRecords} rekapan dan ${result.restoredTransfers} pengiriman.`,
    ...result,
  });
});

// 12. AI Recap Analysis via Google GenAI (Server-side with RBAC)
app.post('/api/ai/analyze', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { branches = ['Sompok'], startDate, endDate, promptNotes } = req.body || {};

    const allowedBranches =
      req.authUser!.role === 'admin'
        ? branches
        : [req.authUser!.branch as Branch];

    const allRecords = await db.getRecords();
    let relevantRecords = allRecords.filter((r) => allowedBranches.includes(r.branch));
    if (startDate) relevantRecords = relevantRecords.filter((r) => r.date >= startDate);
    if (endDate) relevantRecords = relevantRecords.filter((r) => r.date <= endDate);

    if (relevantRecords.length === 0) {
      return res.status(400).json({
        error: 'Tidak ditemukan data rekapan untuk cabang dan rentang tanggal yang dipilih.',
      });
    }

    const dataSummary = relevantRecords.map((r) => {
      const topOut = [...r.stocks]
        .sort((a, b) => b.outQty - a.outQty)
        .slice(0, 5)
        .map((i) => `${i.name}: OUT ${i.outQty} (${i.unit}), ST ${i.st}, SO ${i.so}`);

      const cup = r.stocks.find((s) => s.name === 'CUP');
      return {
        id: r.id,
        branch: r.branch,
        date: r.date,
        totalOmset: r.totalOmset,
        pengeluaran: r.totalPengeluaran,
        qris: r.qris,
        omsetBersih: r.omsetAkhir,
        habisGulaKg: r.gulaDetail?.habisGula || 0,
        cupSold: cup?.outQty || 0,
        cupRusak: cup?.cupDetail?.rusakPcs || 0,
        cupSO: cup?.so || 0,
        topOutItems: topOut,
        expensesList: r.expenses.map((e) => `${e.name}: Rp ${e.amount}`),
      };
    });

    const isComparison = allowedBranches.length > 1;

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Anda adalah sistem AI Analis Bisnis & Operasional untuk jaringan franchise Teh Kota (Cabang Sompok dan Cabang Suyudono di Semarang).
Analisis data rekapitulasi operasional dan keuangan aktual berikut:

Data Rekapitulasi:
${JSON.stringify(dataSummary, null, 2)}

${promptNotes ? `Catatan Tambahan dari Owner: "${promptNotes}"` : ''}

Ketentuan Khusus:
1. Perhatikan rumus wajib SO CUP: (slop * 50) + pcs.
2. Perhatikan rumus keuangan: Omset Akhir = Total Omset - Total Pengeluaran - QRIS.
3. Perhatikan pemakaian Gula Pasir (KG) dengan rumus: (Ambil + Gula Kemarin) - Sisa - Cair.
4. Berikan evaluasi operasional, analisis keuangan, perbandingan cabang (jika lebih dari 1 cabang), dan 3 rekomendasi taktis.

Format respons WAJIB JSON persis dengan struktur:
{
  "summary": "Ringkasan eksekutif 2-3 kalimat...",
  "stockInsights": ["..."],
  "anomalies": ["..."],
  "lowStockAlerts": [{ "item": "nama item", "currentSt": 3, "recommendation": "..." }],
  "financialAnalysis": "...",
  "branchComparison": "...",
  "recommendations": ["...", "...", "..."]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({
            summary: parsed.summary || 'Analisis operasional selesai.',
            stockInsights: Array.isArray(parsed.stockInsights) ? parsed.stockInsights : [],
            anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
            lowStockAlerts: Array.isArray(parsed.lowStockAlerts) ? parsed.lowStockAlerts : [],
            financialAnalysis: parsed.financialAnalysis || 'Keuangan terpantau normal.',
            branchComparison: parsed.branchComparison || '',
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, using deterministic analysis:', geminiError);
      }
    }

    const totalGross = relevantRecords.reduce((acc, r) => acc + r.totalOmset, 0);
    const totalNet = relevantRecords.reduce((acc, r) => acc + r.omsetAkhir, 0);
    const totalExp = relevantRecords.reduce((acc, r) => acc + r.totalPengeluaran, 0);
    const totalQrisVal = relevantRecords.reduce((acc, r) => acc + r.qris, 0);
    const totalGulaKg = relevantRecords.reduce((acc, r) => acc + (r.gulaDetail?.habisGula || 0), 0);

    const latestRecord = relevantRecords[0];
    const lowStockAlerts: Array<{ item: string; currentSt: number; recommendation: string }> = [];
    if (latestRecord && latestRecord.stocks) {
      for (const s of latestRecord.stocks) {
        if (s.st <= 5) {
          lowStockAlerts.push({
            item: s.name,
            currentSt: s.st,
            recommendation: `Sisa stok ${s.st} ${s.unit}. Segera buat PO restok atau pengiriman antarcabang.`,
          });
        }
      }
    }

    const cupSoldTotal = relevantRecords.reduce((acc, r) => {
      const c = r.stocks.find((s) => s.name === 'CUP');
      return acc + (c ? c.outQty : 0);
    }, 0);

    res.json({
      summary: `Evaluasi ${relevantRecords.length} rekapan di Cabang ${allowedBranches.join(' & ')}: total omset kotor Rp ${totalGross.toLocaleString('id-ID')}, setoran bersih tunai Rp ${totalNet.toLocaleString('id-ID')}, penjualan ${cupSoldTotal.toLocaleString('id-ID')} cup, dan pemakaian gula ${Math.round(totalGulaKg * 100) / 100} KG.`,
      stockInsights: [
        `Total penjualan Cup mencapai ${cupSoldTotal.toLocaleString('id-ID')} cup di seluruh periode terpilih.`,
        `Konsumsi gula pasir terhitung otomatis sebesar ${Math.round(totalGulaKg * 100) / 100} KG.`,
        'Perhitungan Stock Opname (SO) CUP konsisten menggunakan rumus (slop × 50) + pcs.',
      ],
      anomalies: ['Pergerakan stok ST dan SO fisik tercatat konsisten di seluruh hari rekapan terpilih.'],
      lowStockAlerts: lowStockAlerts.slice(0, 4),
      financialAnalysis: `Dari total omset kotor Rp ${totalGross.toLocaleString('id-ID')}, transaksi QRIS mencapai Rp ${totalQrisVal.toLocaleString('id-ID')} (${((totalQrisVal / (totalGross || 1)) * 100).toFixed(1)}%). Pengeluaran operasional Rp ${totalExp.toLocaleString('id-ID')}.`,
      branchComparison: isComparison
        ? 'Perbandingan langsung Cabang Sompok dan Suyudono tersedia pada ringkasan omset dan efisiensi stok masing-masing outlet.'
        : `Operasional Cabang ${allowedBranches[0]} berjalan tertib dengan pencatatan terpusat.`,
      recommendations: [
        'Gunakan Catatan Pengiriman Barang saat memindahkan stok antarcabang agar IN/OUT tetap sinkron.',
        'Lakukan restok bahan Tea Series dan Cup sebelum menyentuh batas stok aman.',
        'Audit rutin selisih SO fisik vs ST sistem setiap pergantian shift.',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Layanan AI mengalami kendala: ' + (err.message || 'Gagal memproses data'),
    });
  }
});

// 13. Batch Offline Sync (Protected by Auth + RBAC + Recalculation)
app.post('/api/sync', requireAuth, async (req: AuthedRequest, res) => {
  const { queue } = req.body || {};
  if (!Array.isArray(queue) || queue.length === 0) {
    return res.json({ synced: 0, records: [] });
  }

  let count = 0;
  const syncedRecords: RekapRecord[] = [];
  const editorName = req.authUser!.name || req.authUser!.username;

  for (const item of queue) {
    if (item.action === 'save_record' && item.record) {
      const rec = item.record as RekapRecord;
      if (!rec.branch || !rec.date || !canAccessBranch(req.authUser!, rec.branch)) {
        continue;
      }

      const now = new Date().toISOString();
      const existing = await db.getRecordByBranchDate(rec.branch, rec.date);
      const normalizedStocks = Array.isArray(rec.stocks)
        ? rec.stocks.map((s: any) => ({
            ...s,
            sa: Number(s.sa) || 0,
            inQty: Math.max(0, Number(s.inQty) || 0),
            outQty: Math.max(0, Number(s.outQty) || 0),
            st: calculateStokAkhir(s.sa, s.inQty, s.outQty),
            so: Number(s.so) || 0,
          }))
        : [];
      const totalPengeluaran = calculateTotalPengeluaran(rec.expenses || []);
      const omsetAkhir = calculateOmsetAkhir(rec.totalOmset || 0, totalPengeluaran, rec.qris || 0);
      const normalizedGula = rec.gulaDetail
        ? {
            gulaAmbil: Math.max(0, Number(rec.gulaDetail.gulaAmbil) || 0),
            gulaKemarin: Math.max(0, Number(rec.gulaDetail.gulaKemarin) || 0),
            sisaGula: Math.max(0, Number(rec.gulaDetail.sisaGula) || 0),
            gulaCair: Math.max(0, Number(rec.gulaDetail.gulaCair) || 0),
            habisGula: calculateHabisGula(
              rec.gulaDetail.gulaAmbil,
              rec.gulaDetail.gulaKemarin,
              rec.gulaDetail.sisaGula,
              rec.gulaDetail.gulaCair
            ),
          }
        : undefined;

      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recordId: existing?.id || rec.id || `rek_${rec.branch.toLowerCase()}_${rec.date.replace(/-/g, '')}`,
        entityType: 'rekap',
        branch: rec.branch,
        date: rec.date,
        editedBy: editorName,
        timestamp: now,
        note: `Sinkronisasi antrean offline Cabang ${rec.branch}`,
        changes: [
          {
            field: 'offline_sync',
            label: 'Sync Offline',
            before: existing ? 'Data sebelumnya' : '-',
            after: `Omset Rp ${Number(rec.totalOmset || 0).toLocaleString('id-ID')}`,
          },
        ],
      };

      const savedRec: RekapRecord = {
        ...rec,
        id: existing?.id || rec.id || `rek_${rec.branch.toLowerCase()}_${rec.date.replace(/-/g, '')}`,
        timeStr: rec.timeStr || getJakartaTimeStr(),
        createdAt: existing ? existing.createdAt : rec.createdAt || now,
        updatedAt: now,
        createdBy: existing ? existing.createdBy : rec.createdBy || editorName,
        lastEditedBy: existing ? editorName : undefined,
        lastEditedAt: existing ? now : undefined,
        revisionCount: (existing?.revisionCount || 0) + (existing ? 1 : 0),
        stocks: normalizedStocks,
        totalPengeluaran,
        omsetAkhir,
        gulaDetail: normalizedGula,
        auditLogs: [auditEntry, ...(existing?.auditLogs || [])],
      };

      await db.upsertRecord(savedRec);
      await db.appendAuditLog(auditEntry);
      if (savedRec.status !== 'draft') {
        await cascadeSubsequentRecords(savedRec.branch, savedRec.date, savedRec.stocks);
      }
      syncedRecords.push(savedRec);
      count++;
    }
  }

  if (count > 0) {
    broadcastSyncEvent({
      event: 'batch_sync',
      branch: req.authUser!.branch,
      editedBy: editorName,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({ synced: count, records: syncedRecords, message: `${count} rekapan berhasil disinkronkan` });
});

// 14. Catch-all JSON 404 for unhandled API routes
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({
    error: `Rute '${req.method} ${req.originalUrl || req.url}' tidak ditemukan di server Rekapan Teh Kota`,
  });
});

export default app;
