import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  AuditLogEntry,
  BackupSnapshotMeta,
  Branch,
  BranchTransfer,
  RekapRecord,
  UserRole,
} from '../src/types';
import { createInitialStockRows } from '../src/utils/itemsList';
import {
  calculateOmsetAkhir,
  calculateStokAkhir,
  calculateTotalPengeluaran,
} from '../src/utils/calculations';
import { hashPassword } from './security';

export interface DbUser {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  email: string;
  role: UserRole;
  branch: Branch | 'All';
  active?: boolean;
  updatedAt?: string;
}

export interface StoredBackup {
  id: string;
  createdAt: string;
  createdBy: string;
  note: string;
  recordsCount: number;
  transfersCount: number;
  usersCount: number;
  snapshot: {
    users: DbUser[];
    records: RekapRecord[];
    transfers: BranchTransfer[];
    auditLogs: AuditLogEntry[];
  };
}

export interface DatabaseSchema {
  users: DbUser[];
  records: RekapRecord[];
  transfers: BranchTransfer[];
  auditLogs: AuditLogEntry[];
  backups: StoredBackup[];
}

const isVercel = Boolean(process.env.VERCEL);
const localDataDir = path.resolve(process.cwd(), 'data');
const localDbPath = path.resolve(localDataDir, 'tehkota_db.json');
const tmpDataDir = path.resolve('/tmp', 'tehkota_data');
const tmpDbPath = path.resolve(tmpDataDir, 'tehkota_db.json');

function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SUPABASE_DB_URL ||
    process.env.NEON_DATABASE_URL ||
    undefined
  );
}

function createDefaultUsers(): DbUser[] {
  const ownerUsername = process.env.OWNER_USERNAME || 'Tehkota321';
  const ownerPassword = process.env.OWNER_PASSWORD || 'Tehkota321';
  const sompokPassword = process.env.KASIR_SOMPOK_PASSWORD || 'sompok123';
  const suyudonoPassword = process.env.KASIR_SUYUDONO_PASSWORD || 'suyudono123';

  return [
    {
      id: 'usr_sompok',
      username: 'kasir.sompok',
      passwordHash: hashPassword(sompokPassword),
      name: 'Kasir Sompok',
      email: 'kasir.sompok@tehkota.com',
      role: 'kasir',
      branch: 'Sompok',
      active: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr_suyudono',
      username: 'kasir.suyudono',
      passwordHash: hashPassword(suyudonoPassword),
      name: 'Kasir Suyudono',
      email: 'kasir.suyudono@tehkota.com',
      role: 'kasir',
      branch: 'Suyudono',
      active: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr_owner',
      username: ownerUsername,
      passwordHash: hashPassword(ownerPassword),
      name: 'Owner Teh Kota',
      email: 'owner@tehkota.com',
      role: 'admin',
      branch: 'All',
      active: true,
      updatedAt: new Date().toISOString(),
    },
  ];
}

function createSeedDay(
  id: string,
  branch: Branch,
  date: string,
  cupSold: number,
  omsetGross: number,
  qrisGross: number,
  expensesList: Array<{ name: string; amount: number }>,
  prevDayStocks?: any[]
): RekapRecord {
  const prevMap: Record<string, number> = {};
  if (prevDayStocks) {
    for (const item of prevDayStocks) {
      prevMap[item.name] = item.st;
    }
  }

  const stocks = createInitialStockRows(prevDayStocks ? prevMap : undefined);

  for (const row of stocks) {
    if (row.name === 'CUP') {
      if (row.sa < 500) row.inQty = 1000;
      row.outQty = cupSold;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
      const slops = Math.floor(Math.max(0, row.so) / 50);
      const rem = Math.max(0, row.so) % 50;
      row.cupDetail = {
        slop: slops,
        pcs: rem,
        rusakPcs: 1,
        calculatedSo: row.so,
      };
    } else if (row.category === 'Tea Series') {
      if (row.sa < 10) row.inQty = 25;
      const out = Math.min(row.sa + row.inQty, Math.floor(cupSold * 0.08) + 2);
      row.outQty = out;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
    } else if (row.category === 'Perlengkapan / Bahan Pokok') {
      if (row.sa < 5) row.inQty = 10;
      const out = row.name.includes('PLASTIK') ? Math.min(row.sa + row.inQty, 2) : 1;
      row.outQty = out;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
    } else {
      const out = 2;
      row.outQty = out;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
    }
  }

  const expenses = expensesList.map((e, i) => ({
    id: `exp_seed_${i + 1}`,
    name: e.name,
    amount: e.amount,
  }));

  const totalPengeluaran = calculateTotalPengeluaran(expenses);
  const omsetAkhir = calculateOmsetAkhir(omsetGross, totalPengeluaran, qrisGross);

  return {
    id,
    branch,
    date,
    timeStr: '21:30:00',
    createdAt: `${date}T14:30:00.000Z`,
    updatedAt: `${date}T14:30:00.000Z`,
    createdBy: `Kasir ${branch}`,
    status: 'saved',
    stocks,
    expenses,
    totalOmset: omsetGross,
    totalPengeluaran,
    qris: qrisGross,
    omsetAkhir,
    gulaDetail: {
      gulaAmbil: 10,
      gulaKemarin: 3,
      sisaGula: 3,
      gulaCair: 1,
      habisGula: 9,
    },
    notes: `Rekapan operasional harian Cabang ${branch} berjalan lancar.`,
  };
}

function generateDefaultRecords(): RekapRecord[] {
  const sompok1 = createSeedDay(
    'rek_sompok_20261101',
    'Sompok',
    '2026-11-01',
    185,
    1480000,
    520000,
    [
      { name: 'Es Batu Kristal (3 sak)', amount: 45000 },
      { name: 'Air Galon isi ulang', amount: 8000 },
    ]
  );

  const sompok2 = createSeedDay(
    'rek_sompok_20261102',
    'Sompok',
    '2026-11-02',
    210,
    1680000,
    640000,
    [
      { name: 'Es Batu Kristal (4 sak)', amount: 60000 },
      { name: 'Kresek Sampah Jumbo', amount: 18000 },
    ],
    sompok1.stocks
  );

  const sompok3 = createSeedDay(
    'rek_sompok_20261103',
    'Sompok',
    '2026-11-03',
    240,
    1920000,
    780000,
    [
      { name: 'Es Batu Kristal (3 sak)', amount: 45000 },
      { name: 'Sabun cuci & spons', amount: 15000 },
    ],
    sompok2.stocks
  );

  const suyudono1 = createSeedDay(
    'rek_suyudono_20261101',
    'Suyudono',
    '2026-11-01',
    170,
    1360000,
    490000,
    [
      { name: 'Es Batu Kristal (3 sak)', amount: 45000 },
      { name: 'Air Galon isi ulang', amount: 8000 },
    ]
  );

  const suyudono2 = createSeedDay(
    'rek_suyudono_20261102',
    'Suyudono',
    '2026-11-02',
    230,
    1840000,
    720000,
    [
      { name: 'Es Batu Kristal (4 sak)', amount: 60000 },
      { name: 'Sedotan tambahan', amount: 20000 },
    ],
    suyudono1.stocks
  );

  const suyudono3 = createSeedDay(
    'rek_suyudono_20261103',
    'Suyudono',
    '2026-11-03',
    205,
    1640000,
    610000,
    [
      { name: 'Es Batu Kristal (3 sak)', amount: 45000 },
      { name: 'Plastik Sampah Besar', amount: 15000 },
    ],
    suyudono2.stocks
  );

  return [sompok1, sompok2, sompok3, suyudono1, suyudono2, suyudono3];
}

function loadMergedFileDatabase(): DatabaseSchema {
  let localParsed: Partial<DatabaseSchema> | null = null;
  let tmpParsed: Partial<DatabaseSchema> | null = null;

  if (fs.existsSync(localDbPath)) {
    try {
      localParsed = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
    } catch {}
  }

  if (fs.existsSync(tmpDbPath)) {
    try {
      tmpParsed = JSON.parse(fs.readFileSync(tmpDbPath, 'utf-8'));
    } catch {}
  }

  // Merge records safely
  const mergedRecordsMap = new Map<string, RekapRecord>();
  const hasExistingFile = Boolean(
    (localParsed && Array.isArray(localParsed.records) && localParsed.records.length > 0) ||
      (tmpParsed && Array.isArray(tmpParsed.records) && tmpParsed.records.length > 0)
  );

  if (!hasExistingFile) {
    for (const r of generateDefaultRecords()) {
      mergedRecordsMap.set(`${r.branch}_${r.date}`, r);
    }
  }

  if (localParsed && Array.isArray(localParsed.records)) {
    for (const r of localParsed.records) {
      mergedRecordsMap.set(`${r.branch}_${r.date}`, r);
    }
  }

  if (tmpParsed && Array.isArray(tmpParsed.records)) {
    for (const r of tmpParsed.records) {
      const key = `${r.branch}_${r.date}`;
      const existing = mergedRecordsMap.get(key);
      if (
        !existing ||
        new Date(r.updatedAt || r.createdAt || 0).getTime() >=
          new Date(existing.updatedAt || existing.createdAt || 0).getTime()
      ) {
        mergedRecordsMap.set(key, r);
      }
    }
  }

  // Merge users and ensure passwords are scrypt hashed
  const userMap = new Map<string, DbUser>();
  for (const u of createDefaultUsers()) {
    userMap.set(u.id, u);
  }
  const sourceUsers = [...(localParsed?.users || []), ...(tmpParsed?.users || [])];
  for (const su of sourceUsers) {
    if (!su || !su.id) continue;
    const migratedHash = su.passwordHash?.startsWith('scrypt$')
      ? su.passwordHash
      : hashPassword(su.passwordHash || 'tehkota123');
    userMap.set(su.id, {
      ...su,
      passwordHash: migratedHash,
      active: su.active !== false,
    });
  }

  // Re-apply explicit env var Owner override if set
  if (process.env.OWNER_USERNAME || process.env.OWNER_PASSWORD) {
    const owner = userMap.get('usr_owner');
    if (owner) {
      if (process.env.OWNER_USERNAME) owner.username = process.env.OWNER_USERNAME;
      if (process.env.OWNER_PASSWORD) owner.passwordHash = hashPassword(process.env.OWNER_PASSWORD);
    }
  }

  // Merge transfers
  const transferMap = new Map<string, BranchTransfer>();
  for (const t of [...(localParsed?.transfers || []), ...(tmpParsed?.transfers || [])]) {
    if (!t || !t.id) continue;
    const prev = transferMap.get(t.id);
    if (
      !prev ||
      new Date(t.updatedAt || t.createdAt || 0).getTime() >=
        new Date(prev.updatedAt || prev.createdAt || 0).getTime()
    ) {
      transferMap.set(t.id, t);
    }
  }

  // Merge auditLogs
  const auditMap = new Map<string, AuditLogEntry>();
  for (const log of [...(localParsed?.auditLogs || []), ...(tmpParsed?.auditLogs || [])]) {
    if (log && log.id && !auditMap.has(log.id)) {
      auditMap.set(log.id, log);
    }
  }

  const finalRecords = Array.from(mergedRecordsMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const finalTransfers = Array.from(transferMap.values()).sort((a, b) =>
    (b.createdAt || b.date).localeCompare(a.createdAt || a.date)
  );
  const finalAudits = Array.from(auditMap.values()).sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  );
  const finalBackups = [...(localParsed?.backups || tmpParsed?.backups || [])];

  return {
    users: Array.from(userMap.values()),
    records: finalRecords,
    transfers: finalTransfers,
    auditLogs: finalAudits,
    backups: finalBackups,
  };
}

function saveFileDatabase(schema: DatabaseSchema) {
  const jsonStr = JSON.stringify(schema, null, 2);
  try {
    if (!fs.existsSync(localDataDir)) fs.mkdirSync(localDataDir, { recursive: true });
    fs.writeFileSync(localDbPath, jsonStr, 'utf-8');
  } catch {
    // Vercel serverless filesystem is read-only outside /tmp
  }
  try {
    if (!fs.existsSync(tmpDataDir)) fs.mkdirSync(tmpDataDir, { recursive: true });
    fs.writeFileSync(tmpDbPath, jsonStr, 'utf-8');
  } catch {}
}

class UnifiedDatabase {
  private pool: Pool | null = null;
  private fileDb: DatabaseSchema | null = null;
  private initPromise: Promise<void> | null = null;
  private mode: 'postgresql' | 'file' = 'file';
  private initError: string | null = null;

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._initialize();
    }
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    const dbUrl = getDatabaseUrl();
    const seedFileData = loadMergedFileDatabase();
    this.initError = null;

    if (dbUrl) {
      try {
        const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: isLocalhost ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 12000,
        });

        await this.ensurePostgresSchema();
        await this.migrateFileToPostgresIfEmpty(seedFileData);
        this.mode = 'postgresql';
        return;
      } catch (err: any) {
        this.initError = err?.message || 'Koneksi PostgreSQL gagal';
        console.error('[Teh Kota DB] PostgreSQL connection failed, falling back to JSON store:', err);
        this.pool = null;
      }
    }

    this.fileDb = seedFileData;
    saveFileDatabase(this.fileDb);
    this.mode = 'file';
  }

  private async ensurePostgresSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tk_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        branch TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tk_records (
        id TEXT PRIMARY KEY,
        branch TEXT NOT NULL,
        date TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data JSONB NOT NULL,
        UNIQUE (branch, date)
      );

      CREATE INDEX IF NOT EXISTS idx_tk_records_branch_date ON tk_records (branch, date DESC);

      CREATE TABLE IF NOT EXISTS tk_transfers (
        id TEXT PRIMARY KEY,
        transfer_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        sender_branch TEXT NOT NULL,
        receiver_branch TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tk_transfers_status_date ON tk_transfers (status, date DESC);

      CREATE TABLE IF NOT EXISTS tk_audit_logs (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        branch TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        data JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tk_audit_ts ON tk_audit_logs (timestamp DESC);

      CREATE TABLE IF NOT EXISTS tk_backups (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        note TEXT NOT NULL,
        records_count INTEGER NOT NULL,
        transfers_count INTEGER NOT NULL,
        users_count INTEGER NOT NULL,
        snapshot JSONB NOT NULL
      );
    `);
  }

  private async migrateFileToPostgresIfEmpty(seed: DatabaseSchema): Promise<void> {
    if (!this.pool) return;
    const userRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM tk_users');
    if ((userRes.rows[0]?.cnt || 0) === 0) {
      for (const u of seed.users) {
        await this.pool.query(
          `INSERT INTO tk_users (id, username, password_hash, name, email, role, branch, active, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [
            u.id,
            u.username,
            u.passwordHash,
            u.name,
            u.email,
            u.role,
            u.branch,
            u.active !== false,
            u.updatedAt || new Date().toISOString(),
          ]
        );
      }
    }

    const recRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM tk_records');
    if ((recRes.rows[0]?.cnt || 0) === 0 && seed.records.length > 0) {
      for (const r of seed.records) {
        await this.pool.query(
          `INSERT INTO tk_records (id, branch, date, updated_at, data)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (branch, date) DO NOTHING`,
          [r.id, r.branch, r.date, r.updatedAt || r.createdAt || new Date().toISOString(), JSON.stringify(r)]
        );
      }
    }

    const trRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM tk_transfers');
    if ((trRes.rows[0]?.cnt || 0) === 0 && seed.transfers.length > 0) {
      for (const t of seed.transfers) {
        await this.pool.query(
          `INSERT INTO tk_transfers (id, transfer_number, date, sender_branch, receiver_branch, status, updated_at, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [
            t.id,
            t.transferNumber,
            t.date,
            t.senderBranch,
            t.receiverBranch,
            t.status,
            t.updatedAt || t.createdAt,
            JSON.stringify(t),
          ]
        );
      }
    }

    const audRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM tk_audit_logs');
    if ((audRes.rows[0]?.cnt || 0) === 0 && seed.auditLogs.length > 0) {
      for (const a of seed.auditLogs) {
        await this.pool.query(
          `INSERT INTO tk_audit_logs (id, record_id, branch, timestamp, data)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [a.id, a.recordId, a.branch, a.timestamp, JSON.stringify(a)]
        );
      }
    }
  }

  getStorageInfo() {
    const hasDatabaseUrl = Boolean(getDatabaseUrl());
    const persistentCloud = this.mode === 'postgresql';
    return {
      mode: this.mode,
      isVercel,
      hasDatabaseUrl,
      persistentCloud,
      ephemeralWarning: isVercel && !persistentCloud,
      initError: this.initError,
    };
  }

  // ---- USERS ----
  async getUsers(): Promise<DbUser[]> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('SELECT * FROM tk_users ORDER BY role ASC, username ASC');
      return res.rows.map((row) => ({
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        name: row.name,
        email: row.email,
        role: row.role,
        branch: row.branch,
        active: row.active,
        updatedAt: row.updated_at,
      }));
    }
    return this.fileDb!.users;
  }

  async getUserByUsername(username: string): Promise<DbUser | undefined> {
    const users = await this.getUsers();
    const target = username.trim().toLowerCase();
    return users.find((u) => u.username.toLowerCase() === target);
  }

  async getUserById(id: string): Promise<DbUser | undefined> {
    const users = await this.getUsers();
    return users.find((u) => u.id === id);
  }

  async upsertUser(user: DbUser): Promise<DbUser> {
    await this.init();
    const updatedUser: DbUser = {
      ...user,
      active: user.active !== false,
      updatedAt: new Date().toISOString(),
    };
    if (this.pool && this.mode === 'postgresql') {
      await this.pool.query(
        `INSERT INTO tk_users (id, username, password_hash, name, email, role, branch, active, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           branch = EXCLUDED.branch,
           active = EXCLUDED.active,
           updated_at = EXCLUDED.updated_at`,
        [
          updatedUser.id,
          updatedUser.username,
          updatedUser.passwordHash,
          updatedUser.name,
          updatedUser.email,
          updatedUser.role,
          updatedUser.branch,
          updatedUser.active,
          updatedUser.updatedAt,
        ]
      );
      return updatedUser;
    }

    const idx = this.fileDb!.users.findIndex((u) => u.id === updatedUser.id);
    if (idx >= 0) this.fileDb!.users[idx] = updatedUser;
    else this.fileDb!.users.push(updatedUser);
    saveFileDatabase(this.fileDb!);
    return updatedUser;
  }

  // ---- RECORDS ----
  async getRecords(filter?: { branch?: string; month?: string; date?: string }): Promise<RekapRecord[]> {
    await this.init();
    let list: RekapRecord[] = [];
    if (this.pool && this.mode === 'postgresql') {
      const clauses: string[] = [];
      const params: any[] = [];
      if (filter?.branch && filter.branch !== 'All') {
        params.push(filter.branch);
        clauses.push(`branch = $${params.length}`);
      }
      if (filter?.date) {
        params.push(filter.date);
        clauses.push(`date = $${params.length}`);
      } else if (filter?.month) {
        params.push(`${filter.month}%`);
        clauses.push(`date LIKE $${params.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const res = await this.pool.query(`SELECT data FROM tk_records ${where} ORDER BY date DESC`, params);
      list = res.rows.map((r) => r.data as RekapRecord);
    } else {
      list = [...this.fileDb!.records];
      if (filter?.branch && filter.branch !== 'All') {
        list = list.filter((r) => r.branch === filter.branch);
      }
      if (filter?.date) {
        list = list.filter((r) => r.date === filter.date);
      } else if (filter?.month) {
        list = list.filter((r) => r.date.startsWith(filter.month!));
      }
      list.sort((a, b) => b.date.localeCompare(a.date));
    }
    return list;
  }

  async getRecordById(id: string): Promise<RekapRecord | undefined> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('SELECT data FROM tk_records WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0]?.data as RekapRecord | undefined;
    }
    return this.fileDb!.records.find((r) => r.id === id);
  }

  async getRecordByBranchDate(branch: Branch, date: string): Promise<RekapRecord | undefined> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query(
        'SELECT data FROM tk_records WHERE branch = $1 AND date = $2 LIMIT 1',
        [branch, date]
      );
      return res.rows[0]?.data as RekapRecord | undefined;
    }
    return this.fileDb!.records.find((r) => r.branch === branch && r.date === date);
  }

  async upsertRecord(record: RekapRecord): Promise<RekapRecord> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      await this.pool.query(
        `INSERT INTO tk_records (id, branch, date, updated_at, data)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (branch, date) DO UPDATE SET
           id = EXCLUDED.id,
           updated_at = EXCLUDED.updated_at,
           data = EXCLUDED.data`,
        [
          record.id,
          record.branch,
          record.date,
          record.updatedAt || new Date().toISOString(),
          JSON.stringify(record),
        ]
      );
      return record;
    }

    const idx = this.fileDb!.records.findIndex(
      (r) => r.id === record.id || (r.branch === record.branch && r.date === record.date)
    );
    if (idx >= 0) this.fileDb!.records[idx] = record;
    else this.fileDb!.records.push(record);
    this.fileDb!.records.sort((a, b) => b.date.localeCompare(a.date));
    saveFileDatabase(this.fileDb!);
    return record;
  }

  async deleteRecord(id: string): Promise<RekapRecord | null> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('DELETE FROM tk_records WHERE id = $1 RETURNING data', [id]);
      return (res.rows[0]?.data as RekapRecord) || null;
    }
    const idx = this.fileDb!.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const [deleted] = this.fileDb!.records.splice(idx, 1);
    saveFileDatabase(this.fileDb!);
    return deleted;
  }

  async resetBranchRecords(branch?: string): Promise<{ deletedCount: number; remainingCount: number }> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      let deletedCount = 0;
      if (branch && branch !== 'All') {
        const res = await this.pool.query('DELETE FROM tk_records WHERE branch = $1', [branch]);
        deletedCount = res.rowCount || 0;
      } else {
        const res = await this.pool.query('DELETE FROM tk_records');
        deletedCount = res.rowCount || 0;
      }
      const rem = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM tk_records');
      return { deletedCount, remainingCount: rem.rows[0]?.cnt || 0 };
    }

    const initialCount = this.fileDb!.records.length;
    if (branch && branch !== 'All') {
      this.fileDb!.records = this.fileDb!.records.filter((r) => r.branch !== branch);
    } else {
      this.fileDb!.records = [];
    }
    saveFileDatabase(this.fileDb!);
    return {
      deletedCount: initialCount - this.fileDb!.records.length,
      remainingCount: this.fileDb!.records.length,
    };
  }

  // ---- TRANSFERS ----
  async getTransfers(): Promise<BranchTransfer[]> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('SELECT data FROM tk_transfers ORDER BY updated_at DESC');
      return res.rows.map((r) => r.data as BranchTransfer);
    }
    return [...this.fileDb!.transfers].sort((a, b) =>
      (b.createdAt || b.date).localeCompare(a.createdAt || a.date)
    );
  }

  async getTransferById(id: string): Promise<BranchTransfer | undefined> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('SELECT data FROM tk_transfers WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0]?.data as BranchTransfer | undefined;
    }
    return this.fileDb!.transfers.find((t) => t.id === id);
  }

  async upsertTransfer(transfer: BranchTransfer): Promise<BranchTransfer> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      await this.pool.query(
        `INSERT INTO tk_transfers (id, transfer_number, date, sender_branch, receiver_branch, status, updated_at, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at,
           data = EXCLUDED.data`,
        [
          transfer.id,
          transfer.transferNumber,
          transfer.date,
          transfer.senderBranch,
          transfer.receiverBranch,
          transfer.status,
          transfer.updatedAt,
          JSON.stringify(transfer),
        ]
      );
      return transfer;
    }

    const idx = this.fileDb!.transfers.findIndex((t) => t.id === transfer.id);
    if (idx >= 0) this.fileDb!.transfers[idx] = transfer;
    else this.fileDb!.transfers.unshift(transfer);
    saveFileDatabase(this.fileDb!);
    return transfer;
  }

  // ---- AUDIT LOGS ----
  async getAuditLogs(filter?: { branch?: string; recordId?: string }): Promise<AuditLogEntry[]> {
    await this.init();
    let logs: AuditLogEntry[] = [];
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('SELECT data FROM tk_audit_logs ORDER BY timestamp DESC LIMIT 200');
      logs = res.rows.map((r) => r.data as AuditLogEntry);
    } else {
      logs = [...this.fileDb!.auditLogs];
    }

    if (filter?.branch && filter.branch !== 'All') {
      logs = logs.filter((l) => l.branch === filter.branch);
    }
    if (filter?.recordId) {
      logs = logs.filter((l) => l.recordId === filter.recordId);
    }
    return logs;
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      await this.pool.query(
        `INSERT INTO tk_audit_logs (id, record_id, branch, timestamp, data)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [entry.id, entry.recordId, entry.branch, entry.timestamp, JSON.stringify(entry)]
      );
      return;
    }

    this.fileDb!.auditLogs.unshift(entry);
    if (this.fileDb!.auditLogs.length > 500) {
      this.fileDb!.auditLogs = this.fileDb!.auditLogs.slice(0, 500);
    }
    saveFileDatabase(this.fileDb!);
  }

  // ---- BACKUP & RESTORE ----
  async exportSnapshot(): Promise<StoredBackup['snapshot']> {
    const [users, records, transfers, auditLogs] = await Promise.all([
      this.getUsers(),
      this.getRecords(),
      this.getTransfers(),
      this.getAuditLogs(),
    ]);
    return { users, records, transfers, auditLogs };
  }

  async createBackup(createdBy: string, note: string): Promise<BackupSnapshotMeta> {
    await this.init();
    const snapshot = await this.exportSnapshot();
    const id = `bak_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const backup: StoredBackup = {
      id,
      createdAt,
      createdBy,
      note,
      recordsCount: snapshot.records.length,
      transfersCount: snapshot.transfers.length,
      usersCount: snapshot.users.length,
      snapshot,
    };

    if (this.pool && this.mode === 'postgresql') {
      await this.pool.query(
        `INSERT INTO tk_backups (id, created_at, created_by, note, records_count, transfers_count, users_count, snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          backup.id,
          backup.createdAt,
          backup.createdBy,
          backup.note,
          backup.recordsCount,
          backup.transfersCount,
          backup.usersCount,
          JSON.stringify(backup.snapshot),
        ]
      );
    } else {
      this.fileDb!.backups.unshift(backup);
      if (this.fileDb!.backups.length > 25) {
        this.fileDb!.backups = this.fileDb!.backups.slice(0, 25);
      }
      saveFileDatabase(this.fileDb!);
    }

    return {
      id: backup.id,
      createdAt: backup.createdAt,
      createdBy: backup.createdBy,
      note: backup.note,
      recordsCount: backup.recordsCount,
      transfersCount: backup.transfersCount,
      usersCount: backup.usersCount,
    };
  }

  async listBackups(): Promise<BackupSnapshotMeta[]> {
    await this.init();
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query(
        'SELECT id, created_at, created_by, note, records_count, transfers_count, users_count FROM tk_backups ORDER BY created_at DESC LIMIT 25'
      );
      return res.rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        createdBy: r.created_by,
        note: r.note,
        recordsCount: r.records_count,
        transfersCount: r.transfers_count,
        usersCount: r.users_count,
      }));
    }
    return (this.fileDb!.backups || []).map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      note: b.note,
      recordsCount: b.recordsCount,
      transfersCount: b.transfersCount,
      usersCount: b.usersCount,
    }));
  }

  async restoreBackup(id: string): Promise<{ restoredRecords: number; restoredTransfers: number } | null> {
    await this.init();
    let snap: StoredBackup['snapshot'] | null = null;
    if (this.pool && this.mode === 'postgresql') {
      const res = await this.pool.query('SELECT snapshot FROM tk_backups WHERE id = $1 LIMIT 1', [id]);
      snap = res.rows[0]?.snapshot || null;
      if (!snap) return null;

      await this.pool.query('DELETE FROM tk_records');
      for (const r of snap.records || []) {
        await this.pool.query(
          `INSERT INTO tk_records (id, branch, date, updated_at, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (branch, date) DO UPDATE SET data = EXCLUDED.data`,
          [r.id, r.branch, r.date, r.updatedAt || r.createdAt, JSON.stringify(r)]
        );
      }

      await this.pool.query('DELETE FROM tk_transfers');
      for (const t of snap.transfers || []) {
        await this.pool.query(
          `INSERT INTO tk_transfers (id, transfer_number, date, sender_branch, receiver_branch, status, updated_at, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [t.id, t.transferNumber, t.date, t.senderBranch, t.receiverBranch, t.status, t.updatedAt, JSON.stringify(t)]
        );
      }

      return {
        restoredRecords: (snap.records || []).length,
        restoredTransfers: (snap.transfers || []).length,
      };
    }

    const found = (this.fileDb!.backups || []).find((b) => b.id === id);
    if (!found) return null;
    this.fileDb!.records = JSON.parse(JSON.stringify(found.snapshot.records || []));
    this.fileDb!.transfers = JSON.parse(JSON.stringify(found.snapshot.transfers || []));
    saveFileDatabase(this.fileDb!);
    return {
      restoredRecords: this.fileDb!.records.length,
      restoredTransfers: this.fileDb!.transfers.length,
    };
  }
}

export const db = new UnifiedDatabase();
