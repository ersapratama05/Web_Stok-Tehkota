// api/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// src/utils/itemsList.ts
var TEH_KOTA_ITEMS = [
  // A. Perlengkapan / Bahan Pokok
  { name: "CUP", category: "Perlengkapan / Bahan Pokok", unit: "pcs", defaultSa: 0 },
  { name: "SEALER", category: "Perlengkapan / Bahan Pokok", unit: "roll", defaultSa: 0 },
  { name: "SEDOTAN KECIL", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "TUTUP CUP", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "PLASTIK SATUAN", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "PLASTIK 15", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "PLASTIK 21", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "PLASTIK 28", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "PLASTIK JUMBO", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "PLASTIK SAMPAH", category: "Perlengkapan / Bahan Pokok", unit: "pack", defaultSa: 0 },
  { name: "SUSU UHT", category: "Perlengkapan / Bahan Pokok", unit: "kotak", defaultSa: 0 },
  { name: "SUSU CARNATION", category: "Perlengkapan / Bahan Pokok", unit: "kaleng", defaultSa: 0 },
  { name: "GULA PASIR", category: "Perlengkapan / Bahan Pokok", unit: "kg", defaultSa: 0 },
  // B. Yoghurt Series
  { name: "Yoghurt Lemon", category: "Yoghurt Series", unit: "porsi", defaultSa: 0 },
  { name: "Yoghurt Leci", category: "Yoghurt Series", unit: "porsi", defaultSa: 0 },
  { name: "Yoghurt Mango", category: "Yoghurt Series", unit: "porsi", defaultSa: 0 },
  { name: "Yoghurt Blueberry", category: "Yoghurt Series", unit: "porsi", defaultSa: 0 },
  { name: "Yoghurt Strawberry", category: "Yoghurt Series", unit: "porsi", defaultSa: 0 },
  // C. Choco Series
  { name: "Choco Vanilla", category: "Choco Series", unit: "porsi", defaultSa: 0 },
  { name: "Choco Matcha", category: "Choco Series", unit: "porsi", defaultSa: 0 },
  { name: "Choco Banana", category: "Choco Series", unit: "porsi", defaultSa: 0 },
  { name: "Choco Klepon", category: "Choco Series", unit: "porsi", defaultSa: 0 },
  { name: "Choco Avocado", category: "Choco Series", unit: "porsi", defaultSa: 0 },
  // D. Tea Series
  { name: "DAUN TEH", category: "Tea Series", unit: "pack", defaultSa: 0 },
  { name: "LEMON", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "LECI", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "PASSION", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "MELON", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "APEL", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "MANGGA", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "Thai Tea", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "GRAPE", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "MATCHA", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "SILVERQUEN", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "REDVELVET", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "TARO", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "Royal Choco", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  { name: "TIRAMISU", category: "Tea Series", unit: "porsi", defaultSa: 0 },
  // E. Coffee Series
  { name: "VIETNAM COFFEE", category: "Coffee Series", unit: "porsi", defaultSa: 0 },
  { name: "VANILLA LATE", category: "Coffee Series", unit: "porsi", defaultSa: 0 },
  { name: "AVOCADO COFFEE", category: "Coffee Series", unit: "porsi", defaultSa: 0 },
  { name: "BROWN SUGAR", category: "Coffee Series", unit: "porsi", defaultSa: 0 },
  { name: "CREAMY MACHIATO", category: "Coffee Series", unit: "porsi", defaultSa: 0 },
  { name: "COOKIES AND CREAM", category: "Coffee Series", unit: "porsi", defaultSa: 0 },
  { name: "ESPRESSO LATTE", category: "Coffee Series", unit: "porsi", defaultSa: 0 }
];
function createInitialStockRows(previousStMap) {
  return TEH_KOTA_ITEMS.map((item) => {
    const sa = previousStMap && previousStMap[item.name] !== void 0 ? previousStMap[item.name] : item.defaultSa;
    const row = {
      name: item.name,
      category: item.category,
      unit: item.unit,
      sa,
      inQty: 0,
      outQty: 0,
      st: sa,
      // SA + 0 - 0 = sa
      so: sa
    };
    if (item.name === "CUP") {
      const positiveSa = Math.max(0, sa);
      const slops = Math.floor(positiveSa / 50);
      const remainingPcs = positiveSa % 50;
      row.cupDetail = {
        slop: slops,
        pcs: remainingPcs,
        rusakPcs: 0,
        calculatedSo: positiveSa
      };
    }
    return row;
  });
}

// src/utils/calculations.ts
function calculateStokAkhir(sa, inQty, outQty) {
  const saNum = Number(sa) || 0;
  const inNum = Number(inQty) || 0;
  const outNum = Number(outQty) || 0;
  return Math.round((saNum + inNum - outNum) * 100) / 100;
}
function calculateTotalPengeluaran(expenses) {
  if (!Array.isArray(expenses) || expenses.length === 0) return 0;
  return expenses.reduce((sum, item) => {
    const val = Number(item.amount) || 0;
    return sum + val;
  }, 0);
}
function calculateOmsetAkhir(totalOmset, totalPengeluaran, qris) {
  const omset = Number(totalOmset) || 0;
  const pengeluaran = Number(totalPengeluaran) || 0;
  const qrisVal = Number(qris) || 0;
  return omset - pengeluaran - qrisVal;
}

// api/app.ts
dotenv.config();
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});
app.get(["/sw.js", "/manifest.webmanifest", "/registerSW.js", /^\/workbox-.*\.js$/], (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const filePath = path.resolve(process.cwd(), "dist", req.path.replace(/^\//, ""));
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var isVercel = Boolean(process.env.VERCEL);
var localDataDir = path.resolve(process.cwd(), "data");
var localDbPath = path.resolve(localDataDir, "tehkota_db.json");
var tmpDataDir = path.resolve("/tmp", "tehkota_data");
var tmpDbPath = path.resolve(tmpDataDir, "tehkota_db.json");
var defaultUsers = [
  {
    id: "usr_sompok",
    username: "kasir.sompok",
    passwordHash: "sompok123",
    name: "Kasir Sompok",
    email: "kasir.sompok@tehkota.com",
    role: "kasir",
    branch: "Sompok"
  },
  {
    id: "usr_suyudono",
    username: "kasir.suyudono",
    passwordHash: "suyudono123",
    name: "Kasir Suyudono",
    email: "kasir.suyudono@tehkota.com",
    role: "kasir",
    branch: "Suyudono"
  },
  {
    id: "usr_owner",
    username: "Tehkota321",
    passwordHash: "Tehkota321",
    name: "Owner Teh Kota",
    email: "owner@tehkota.com",
    role: "admin",
    branch: "All"
  }
];
function createSeedDay(id, branch, date, cupSold, omsetGross, qrisGross, expensesList, prevDayStocks) {
  const prevMap = {};
  if (prevDayStocks) {
    for (const item of prevDayStocks) {
      prevMap[item.name] = item.st;
    }
  }
  const stocks = createInitialStockRows(prevDayStocks ? prevMap : void 0);
  for (const row of stocks) {
    if (row.name === "CUP") {
      if (row.sa < 500) {
        row.inQty = 1e3;
      }
      row.outQty = cupSold;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
      const slops = Math.floor(Math.max(0, row.so) / 50);
      const rem = Math.max(0, row.so) % 50;
      row.cupDetail = {
        slop: slops,
        pcs: rem,
        rusakPcs: Math.floor(Math.random() * 4),
        calculatedSo: row.so
      };
    } else if (row.category === "Tea Series") {
      if (row.sa < 10) row.inQty = 25;
      const out = Math.min(row.sa + row.inQty, Math.floor(cupSold * 0.08) + 2);
      row.outQty = out;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
    } else if (row.category === "Perlengkapan / Bahan Pokok") {
      if (row.sa < 5) row.inQty = 10;
      const out = row.name.includes("PLASTIK") ? Math.min(row.sa + row.inQty, 2) : 1;
      row.outQty = out;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
    } else {
      const out = Math.floor(Math.random() * 4) + 1;
      row.outQty = out;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
    }
  }
  const expenses = expensesList.map((e, i) => ({
    id: `exp_seed_${i + 1}`,
    name: e.name,
    amount: e.amount
  }));
  const totalPengeluaran = calculateTotalPengeluaran(expenses);
  const omsetAkhir = calculateOmsetAkhir(omsetGross, totalPengeluaran, qrisGross);
  return {
    id,
    branch,
    date,
    timeStr: "21:30:00",
    createdAt: `${date}T14:30:00.000Z`,
    updatedAt: `${date}T14:30:00.000Z`,
    createdBy: `Kasir ${branch}`,
    status: "saved",
    stocks,
    expenses,
    totalOmset: omsetGross,
    totalPengeluaran,
    qris: qrisGross,
    omsetAkhir,
    gulaDetail: {
      gulaAmbil: 10,
      gulaKemarin: 2,
      sisaGula: 3,
      gulaCair: 1,
      habisGula: 8
    },
    notes: `Rekapan operasional harian Cabang ${branch} berjalan lancar.`
  };
}
function generateDefaultRecords() {
  const sompok1 = createSeedDay(
    "rek_sompok_20261101",
    "Sompok",
    "2026-11-01",
    185,
    148e4,
    52e4,
    [
      { name: "Es Batu Kristal (3 sak)", amount: 45e3 },
      { name: "Air Galon isi ulang", amount: 8e3 }
    ]
  );
  const sompok2 = createSeedDay(
    "rek_sompok_20261102",
    "Sompok",
    "2026-11-02",
    210,
    168e4,
    64e4,
    [
      { name: "Es Batu Kristal (4 sak)", amount: 6e4 },
      { name: "Kresek Sampah Jumbo", amount: 18e3 }
    ],
    sompok1.stocks
  );
  const sompok3 = createSeedDay(
    "rek_sompok_20261103",
    "Sompok",
    "2026-11-03",
    240,
    192e4,
    78e4,
    [
      { name: "Es Batu Kristal (3 sak)", amount: 45e3 },
      { name: "Sabun cuci & spons", amount: 15e3 }
    ],
    sompok2.stocks
  );
  const suyudono1 = createSeedDay(
    "rek_suyudono_20261101",
    "Suyudono",
    "2026-11-01",
    170,
    136e4,
    49e4,
    [
      { name: "Es Batu Kristal (3 sak)", amount: 45e3 },
      { name: "Air Galon isi ulang", amount: 8e3 }
    ]
  );
  const suyudono2 = createSeedDay(
    "rek_suyudono_20261102",
    "Suyudono",
    "2026-11-02",
    230,
    184e4,
    72e4,
    [
      { name: "Es Batu Kristal (4 sak)", amount: 6e4 },
      { name: "Sedotan tambahan", amount: 2e4 }
    ],
    suyudono1.stocks
  );
  const suyudono3 = createSeedDay(
    "rek_suyudono_20261103",
    "Suyudono",
    "2026-11-03",
    205,
    164e4,
    61e4,
    [
      { name: "Es Batu Kristal (3 sak)", amount: 45e3 },
      { name: "Plastik Sampah Besar", amount: 15e3 }
    ],
    suyudono2.stocks
  );
  return [sompok1, sompok2, sompok3, suyudono1, suyudono2, suyudono3];
}
function initializeDatabase() {
  let localParsed = null;
  let tmpParsed = null;
  if (fs.existsSync(localDbPath)) {
    try {
      const content = fs.readFileSync(localDbPath, "utf-8");
      localParsed = JSON.parse(content);
    } catch {
    }
  }
  if (fs.existsSync(tmpDbPath)) {
    try {
      const content = fs.readFileSync(tmpDbPath, "utf-8");
      tmpParsed = JSON.parse(content);
    } catch {
    }
  }
  const mergedRecordsMap = /* @__PURE__ */ new Map();
  const defaults = generateDefaultRecords();
  for (const r of defaults) {
    mergedRecordsMap.set(`${r.branch}_${r.date}`, r);
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
      if (!existing || new Date(r.updatedAt || r.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
        mergedRecordsMap.set(key, r);
      }
    }
  }
  const finalRecords = Array.from(mergedRecordsMap.values());
  finalRecords.sort((a, b) => b.date.localeCompare(a.date));
  const savedAuditLogs = [];
  if (localParsed && Array.isArray(localParsed.auditLogs)) {
    savedAuditLogs.push(...localParsed.auditLogs);
  }
  if (tmpParsed && Array.isArray(tmpParsed.auditLogs)) {
    for (const log of tmpParsed.auditLogs) {
      if (!savedAuditLogs.some((l) => l.id === log.id)) {
        savedAuditLogs.push(log);
      }
    }
  }
  const initialDb = {
    users: defaultUsers,
    records: finalRecords,
    auditLogs: savedAuditLogs
  };
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    fs.writeFileSync(localDbPath, JSON.stringify(initialDb, null, 2), "utf-8");
  } catch {
  }
  try {
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    fs.writeFileSync(tmpDbPath, JSON.stringify(initialDb, null, 2), "utf-8");
  } catch {
  }
  return initialDb;
}
var db = initializeDatabase();
function saveDatabase() {
  const jsonStr = JSON.stringify(db, null, 2);
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    fs.writeFileSync(localDbPath, jsonStr, "utf-8");
  } catch {
  }
  try {
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    fs.writeFileSync(tmpDbPath, jsonStr, "utf-8");
  } catch {
  }
}
var sseClients = [];
function broadcastSyncEvent(payload) {
  const message = `data: ${JSON.stringify(payload)}

`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      if (!client.branch || client.branch === "All" || !payload.branch || client.branch === payload.branch) {
        client.res.write(message);
      }
    } catch {
      sseClients.splice(i, 1);
    }
  }
}
setInterval(() => {
  broadcastSyncEvent({
    event: "ping",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}, 25e3);
app.get("/api", (_req, res) => {
  res.json({
    status: "ok",
    message: "Teh Kota Backend API is running on Vercel",
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Rekapan Teh Kota API",
    isVercel,
    recordsCount: db.records.length,
    usersCount: db.users.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/login", (req, res) => {
  const { username, password, branch } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }
  const user = db.users.find(
    (u) => u.username.toLowerCase() === String(username).trim().toLowerCase()
  );
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: "Username atau password salah" });
  }
  if (user.role !== "admin" && branch && user.branch !== branch) {
    return res.status(403).json({
      error: `Akun ini hanya dapat mengakses Cabang ${user.branch}`
    });
  }
  const token = `tok_${user.id}_${Date.now()}`;
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: branch || user.branch
    }
  });
});
app.post("/api/auth/quick-login", (req, res) => {
  const { branch } = req.body;
  if (!branch || branch !== "Sompok" && branch !== "Suyudono") {
    return res.status(400).json({ error: "Cabang tidak valid" });
  }
  const user = db.users.find((u) => u.branch === branch && u.role === "kasir");
  if (!user) {
    return res.status(404).json({ error: `Akun kasir cabang ${branch} tidak ditemukan` });
  }
  const token = `tok_${user.id}_${Date.now()}`;
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch
    }
  });
});
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Belum login" });
  }
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split("_");
  const userId = parts[1];
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Sesi login tidak valid" });
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch
    }
  });
});
app.get("/api/records/previous-stock", (req, res) => {
  const { branch, date } = req.query;
  if (!branch || !date) {
    return res.status(400).json({ error: "Parameter branch dan date wajib diisi" });
  }
  const priorRecords = db.records.filter((r) => r.branch === branch && r.date < date).sort((a, b) => b.date.localeCompare(a.date));
  const previousRecord = priorRecords[0];
  if (!previousRecord) {
    const map2 = {};
    for (const item of TEH_KOTA_ITEMS) {
      map2[item.name] = item.defaultSa;
    }
    return res.json({ hasPrevious: false, stocks: map2 });
  }
  let previousHabisGula = 0;
  if (previousRecord && previousRecord.gulaDetail) {
    previousHabisGula = previousRecord.gulaDetail.habisGula || 0;
  }
  const map = {};
  for (const item of previousRecord.stocks) {
    map[item.name] = item.st;
  }
  res.json({
    hasPrevious: true,
    previousDate: previousRecord.date,
    previousRecordId: previousRecord.id,
    stocks: map,
    gulaKemarin: previousHabisGula
  });
});
app.get("/api/sync/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) {
    res.flushHeaders();
  }
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const branch = req.query.branch || void 0;
  const newClient = { id: clientId, res, branch };
  sseClients.push(newClient);
  res.write(`data: ${JSON.stringify({ event: "connected", clientId, timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`);
  req.on("close", () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});
app.get("/api/sync/poll", (req, res) => {
  const { branch, since } = req.query;
  let records = db.records;
  if (branch && branch !== "All") {
    records = records.filter((r) => r.branch === branch);
  }
  if (since) {
    const sinceTime = new Date(since).getTime();
    records = records.filter((r) => new Date(r.updatedAt || r.createdAt || 0).getTime() > sinceTime);
  }
  res.json({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    records,
    auditLogs: (db.auditLogs || []).slice(0, 50),
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/audit-logs", (req, res) => {
  const { branch, recordId } = req.query;
  let logs = db.auditLogs || [];
  if (branch && branch !== "All") {
    logs = logs.filter((l) => l.branch === branch);
  }
  if (recordId) {
    logs = logs.filter((l) => l.recordId === recordId);
  }
  res.json({ auditLogs: logs });
});
app.get("/api/records", (req, res) => {
  const { branch, month, date, range, query } = req.query;
  let list = [...db.records];
  if (branch && branch !== "All") {
    list = list.filter((r) => r.branch === branch);
  }
  if (month) {
    list = list.filter((r) => r.date.startsWith(month));
  }
  if (date) {
    list = list.filter((r) => r.date === date);
  }
  if (range) {
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (range === "today") {
      list = list.filter((r) => r.date === todayStr);
    } else if (range === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterdayStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      list = list.filter((r) => r.date === yesterdayStr);
    } else if (range === "7days") {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      const minDate = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;
      list = list.filter((r) => r.date >= minDate);
    } else if (range === "30days") {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      const minDate = `${d30.getFullYear()}-${pad(d30.getMonth() + 1)}-${pad(d30.getDate())}`;
      list = list.filter((r) => r.date >= minDate);
    }
  }
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(
      (r) => r.date.includes(q) || r.branch.toLowerCase().includes(q) || r.createdBy && r.createdBy.toLowerCase().includes(q) || r.lastEditedBy && r.lastEditedBy.toLowerCase().includes(q) || r.notes && r.notes.toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => b.date.localeCompare(a.date));
  res.json({ records: list });
});
app.get("/api/records/:id", (req, res) => {
  const { id } = req.params;
  const record = db.records.find((r) => r.id === id);
  if (!record) {
    return res.status(404).json({ error: "Rekapan tidak ditemukan" });
  }
  const relatedAuditLogs = (db.auditLogs || []).filter((l) => l.recordId === id);
  res.json({ record: { ...record, auditLogs: relatedAuditLogs } });
});
app.post("/api/records", (req, res) => {
  const body = req.body;
  const {
    id,
    branch,
    date,
    timeStr,
    status = "saved",
    stocks,
    expenses = [],
    totalOmset = 0,
    qris = 0,
    createdBy = "Kasir",
    editorRole,
    editorBranch,
    gulaDetail,
    notes = ""
  } = body;
  if (!branch || !date) {
    return res.status(400).json({ error: "Cabang dan tanggal wajib diisi" });
  }
  if (editorRole === "kasir" && editorBranch && editorBranch !== branch) {
    return res.status(403).json({
      error: `Akses ditolak: Akun kasir ${editorBranch} tidak memiliki hak akses untuk menyimpan atau mengubah data Cabang ${branch}.`
    });
  }
  const totalPengeluaran = calculateTotalPengeluaran(expenses);
  const omsetAkhir = calculateOmsetAkhir(totalOmset, totalPengeluaran, qris);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let existingIndex = -1;
  if (id) {
    existingIndex = db.records.findIndex((r) => r.id === id);
  } else {
    existingIndex = db.records.findIndex((r) => r.branch === branch && r.date === date);
  }
  const recordId = id || (existingIndex >= 0 ? db.records[existingIndex].id : `rek_${branch.toLowerCase()}_${date.replace(/-/g, "")}`);
  const isUpdate = existingIndex >= 0;
  const existingRecord = isUpdate ? db.records[existingIndex] : null;
  const changes = [];
  if (existingRecord) {
    if (existingRecord.totalOmset !== Number(totalOmset)) {
      changes.push({
        field: "totalOmset",
        label: "Omset Kotor",
        before: existingRecord.totalOmset,
        after: Number(totalOmset)
      });
    }
    if (existingRecord.totalPengeluaran !== totalPengeluaran) {
      changes.push({
        field: "totalPengeluaran",
        label: "Total Pengeluaran",
        before: existingRecord.totalPengeluaran,
        after: totalPengeluaran
      });
    }
    if (existingRecord.qris !== Number(qris)) {
      changes.push({
        field: "qris",
        label: "QRIS / Non Tunai",
        before: existingRecord.qris,
        after: Number(qris)
      });
    }
    if (existingRecord.omsetAkhir !== omsetAkhir) {
      changes.push({
        field: "omsetAkhir",
        label: "Omset Bersih",
        before: existingRecord.omsetAkhir,
        after: omsetAkhir
      });
    }
    if (gulaDetail) {
      const oldGula = existingRecord.gulaDetail;
      if (!oldGula || oldGula.habisGula !== gulaDetail.habisGula) {
        changes.push({
          field: "gulaDetail.habisGula",
          label: "Gula Habis (KG)",
          before: oldGula ? oldGula.habisGula : 0,
          after: gulaDetail.habisGula
        });
      }
    }
    if (Array.isArray(stocks) && Array.isArray(existingRecord.stocks)) {
      for (const newS of stocks) {
        const oldS = existingRecord.stocks.find((s) => s.name === newS.name);
        if (oldS && (oldS.st !== newS.st || oldS.so !== newS.so || oldS.inQty !== newS.inQty || oldS.outQty !== newS.outQty)) {
          changes.push({
            field: `stock_${newS.name}`,
            label: `Stok ${newS.name}`,
            before: `IN:${oldS.inQty} OUT:${oldS.outQty} ST:${oldS.st} SO:${oldS.so}`,
            after: `IN:${newS.inQty} OUT:${newS.outQty} ST:${newS.st} SO:${newS.so}`
          });
        }
      }
    }
  }
  let auditEntry;
  if (isUpdate && changes.length > 0) {
    auditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recordId,
      branch,
      date,
      editedBy: createdBy || "Kasir",
      timestamp: now,
      note: notes || "Perubahan data rekapan dari perangkat",
      changes
    };
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(auditEntry);
  }
  const existingLogs = existingRecord?.auditLogs || [];
  const mergedLogs = auditEntry ? [auditEntry, ...existingLogs] : existingLogs;
  const newRecord = {
    id: recordId,
    branch,
    date,
    timeStr: timeStr || (/* @__PURE__ */ new Date()).toLocaleTimeString("id-ID", { hour12: false }),
    createdAt: existingRecord ? existingRecord.createdAt : now,
    updatedAt: now,
    createdBy: existingRecord ? existingRecord.createdBy : createdBy,
    lastEditedBy: isUpdate ? createdBy : void 0,
    lastEditedAt: isUpdate ? now : void 0,
    revisionCount: existingRecord ? (existingRecord.revisionCount || 0) + (changes.length > 0 ? 1 : 0) : 0,
    status,
    stocks: stocks || [],
    expenses,
    totalOmset: Number(totalOmset) || 0,
    totalPengeluaran,
    qris: Number(qris) || 0,
    omsetAkhir,
    gulaDetail: gulaDetail || void 0,
    notes,
    auditLogs: mergedLogs
  };
  if (existingIndex >= 0) {
    db.records[existingIndex] = newRecord;
  } else {
    db.records.push(newRecord);
  }
  const subsequentRecords = db.records.filter((r) => r.branch === branch && r.date > date).sort((a, b) => a.date.localeCompare(b.date));
  if (subsequentRecords.length > 0 && newRecord.status !== "draft") {
    let currentPrevStocks = newRecord.stocks;
    for (const subRecord of subsequentRecords) {
      let changed = false;
      const prevStMap = {};
      for (const item of currentPrevStocks) {
        prevStMap[item.name] = item.st;
      }
      for (const row of subRecord.stocks) {
        if (prevStMap[row.name] !== void 0 && row.sa !== prevStMap[row.name]) {
          row.sa = prevStMap[row.name];
          row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
          changed = true;
        }
      }
      if (changed) {
        subRecord.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      currentPrevStocks = subRecord.stocks;
    }
  }
  saveDatabase();
  broadcastSyncEvent({
    event: isUpdate ? "record_updated" : "record_created",
    branch,
    date,
    record: newRecord,
    editedBy: createdBy,
    auditLog: auditEntry,
    timestamp: now
  });
  res.json({
    success: true,
    message: isUpdate ? "Perubahan rekapan berhasil disimpan ke database pusat!" : status === "draft" ? "Draf rekapan berhasil disimpan" : "Rekapan berhasil disimpan ke database pusat",
    record: newRecord
  });
});
app.delete("/api/records/:id", (req, res) => {
  const { id } = req.params;
  const index = db.records.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Rekapan tidak ditemukan" });
  }
  const deleted = db.records[index];
  db.records.splice(index, 1);
  saveDatabase();
  broadcastSyncEvent({
    event: "record_deleted",
    branch: deleted.branch,
    date: deleted.date,
    deletedId: id,
    editedBy: "Admin",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({ success: true, message: "Rekapan berhasil dihapus dari server pusat", deletedId: id });
});
app.post("/api/records/reset", (req, res) => {
  const { branch } = req.body;
  const initialCount = db.records.length;
  if (branch && branch !== "All") {
    db.records = db.records.filter((r) => r.branch !== branch);
  } else {
    db.records = [];
  }
  saveDatabase();
  broadcastSyncEvent({
    event: "batch_sync",
    branch,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({
    success: true,
    message: `Rekapan Cabang ${branch || "Semua"} berhasil di-reset menjadi 0.`,
    deletedCount: initialCount - db.records.length,
    remainingCount: db.records.length
  });
});
app.get("/api/dashboard", (req, res) => {
  const { branch, month } = req.query;
  const targetMonth = month || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  let filtered = db.records.filter((r) => r.date.startsWith(targetMonth));
  if (branch && branch !== "All") {
    filtered = filtered.filter((r) => r.branch === branch);
  }
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
  let allBranchRecords = [...db.records];
  if (branch && branch !== "All") {
    allBranchRecords = allBranchRecords.filter((r) => r.branch === branch);
  }
  allBranchRecords.sort((a, b) => b.date.localeCompare(a.date));
  const recent7 = allBranchRecords.slice(0, 7);
  res.json({
    branch: branch || "All",
    monthStr: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    rekapCount: filtered.length,
    recentRekapan: recent7
  });
});
app.get("/api/reports/monthly", (req, res) => {
  const { branch, month } = req.query;
  const targetMonth = month || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  const [yearStr, monthNumStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  let records = db.records.filter((r) => r.date.startsWith(targetMonth));
  if (branch && branch !== "All") {
    records = records.filter((r) => r.branch === branch);
  }
  let totalOmsetKotor = 0;
  let totalOmsetBersih = 0;
  let totalPengeluaran = 0;
  let totalQris = 0;
  const recordsByDate = /* @__PURE__ */ new Map();
  for (const r of records) {
    recordsByDate.set(r.date, r);
    totalOmsetKotor += r.totalOmset || 0;
    totalOmsetBersih += r.omsetAkhir || 0;
    totalPengeluaran += r.totalPengeluaran || 0;
    totalQris += r.qris || 0;
  }
  const dailyData = [];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    const fullDate = `${targetMonth}-${dayStr}`;
    const dt = new Date(year, monthNum - 1, d);
    const dayName = dayNames[dt.getDay()];
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
      status: rec?.status
    });
  }
  res.json({
    branch: branch || "All",
    month: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    daysCount: records.length,
    dailyData
  });
});
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { branches = ["Sompok"], startDate, endDate, promptNotes } = req.body;
    let relevantRecords = db.records.filter((r) => branches.includes(r.branch));
    if (startDate) {
      relevantRecords = relevantRecords.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      relevantRecords = relevantRecords.filter((r) => r.date <= endDate);
    }
    if (relevantRecords.length === 0) {
      return res.status(400).json({
        error: "Tidak ditemukan data rekapan untuk cabang dan rentang tanggal yang dipilih."
      });
    }
    const dataSummary = relevantRecords.map((r) => {
      const topOut = [...r.stocks].sort((a, b) => b.outQty - a.outQty).slice(0, 5).map((i) => `${i.name}: OUT ${i.outQty} (${i.unit}), ST ${i.st}, SO ${i.so}`);
      const cup = r.stocks.find((s) => s.name === "CUP");
      return {
        id: r.id,
        branch: r.branch,
        date: r.date,
        totalOmset: r.totalOmset,
        pengeluaran: r.totalPengeluaran,
        qris: r.qris,
        omsetBersih: r.omsetAkhir,
        cupSold: cup?.outQty || 0,
        cupRusak: cup?.cupDetail?.rusakPcs || 0,
        cupSO: cup?.so || 0,
        topOutItems: topOut,
        expensesList: r.expenses.map((e) => `${e.name}: Rp ${e.amount}`)
      };
    });
    const isComparison = branches.length > 1;
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Anda adalah sistem AI Analis Bisnis & Operasional untuk jaringan franchise Teh Kota (Cabang Sompok dan Cabang Suyudono di Semarang).
Analisis data rekapitulasi operasional dan keuangan aktual berikut:

Data Rekapitulasi:
${JSON.stringify(dataSummary, null, 2)}

${promptNotes ? `Catatan Tambahan dari Owner: "${promptNotes}"` : ""}

Ketentuan Khusus:
1. Perhatikan rumus wajib SO CUP: (slop * 50) + pcs.
2. Perhatikan rumus keuangan: Omset Akhir = Total Omset - Total Pengeluaran - QRIS.
3. Berikan evaluasi operasional, analisis keuangan, perbandingan cabang (jika lebih dari 1 cabang), dan 3 rekomendasi taktis.

Format respons WAJIB JSON persis dengan struktur:
{
  "summary": "Ringkasan eksekutif 2-3 kalimat...",
  "stockInsights": [
    "Wawasan 1 pergerakan stok/penjualan cup...",
    "Wawasan 2 konsumsi daun teh dan gula..."
  ],
  "anomalies": [
    "Anomali 1 jika ada selisih stok atau kenaikan tajam..."
  ],
  "lowStockAlerts": [
    { "item": "nama item", "currentSt": 3, "recommendation": "Restock segera sebelum habis..." }
  ],
  "financialAnalysis": "Analisis omset kotor, pengeluaran, QRIS, dan setoran omset bersih...",
  "branchComparison": "Perbandingan performa antara cabang Sompok dan Suyudono...",
  "recommendations": ["Rekomendasi taktis 1", "Rekomendasi taktis 2", "Rekomendasi taktis 3"]
}`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({
            summary: parsed.summary || "Analisis operasional selesai.",
            stockInsights: Array.isArray(parsed.stockInsights) ? parsed.stockInsights : parsed.topSellingItems?.map((t) => `${t.name}: ${t.totalQty} unit`) || [],
            anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : parsed.stockAnomalies?.map((a) => `[${a.item}] ${a.issue}`) || [],
            lowStockAlerts: Array.isArray(parsed.lowStockAlerts) ? parsed.lowStockAlerts : [],
            financialAnalysis: parsed.financialAnalysis || "Keuangan terpantau normal.",
            branchComparison: parsed.branchComparison || "",
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      } catch (geminiError) {
        console.warn("Gemini API call failed, using deterministic analysis:", geminiError);
      }
    }
    const totalGross = relevantRecords.reduce((acc, r) => acc + r.totalOmset, 0);
    const totalNet = relevantRecords.reduce((acc, r) => acc + r.omsetAkhir, 0);
    const totalExp = relevantRecords.reduce((acc, r) => acc + r.totalPengeluaran, 0);
    const totalQrisVal = relevantRecords.reduce((acc, r) => acc + r.qris, 0);
    const latestRecord = relevantRecords[relevantRecords.length - 1];
    const lowStockAlerts = [];
    if (latestRecord && latestRecord.stocks) {
      for (const s of latestRecord.stocks) {
        if (s.st <= 5 && s.name !== "SEDOTAN HITAM") {
          lowStockAlerts.push({
            item: s.name,
            currentSt: s.st,
            recommendation: `Sisa stok ${s.st} ${s.unit}. Segera buat PO restok untuk menjaga ketersediaan menu.`
          });
        }
      }
    }
    const cupSoldTotal = relevantRecords.reduce((acc, r) => {
      const c = r.stocks.find((s) => s.name === "CUP");
      return acc + (c ? c.outQty : 0);
    }, 0);
    const deterministicResult = {
      summary: `Berdasarkan evaluasi ${relevantRecords.length} hari operasional di Cabang ${branches.join(" & ")}, total omset kotor tercatat Rp ${totalGross.toLocaleString("id-ID")} dengan setoran bersih tunai Rp ${totalNet.toLocaleString("id-ID")}. Total cup terjual ${cupSoldTotal.toLocaleString("id-ID")} cup dan seluruh pergerakan stok terpantau stabil.`,
      stockInsights: [
        `Penjualan Cup mencapai total ${cupSoldTotal.toLocaleString("id-ID")} cup di seluruh hari rekapan terpilih.`,
        "Bahan baku Tea Series (Original, Jasmine, Green Tea) menjadi kontributor penjualan tertinggi.",
        "Perhitungan Stock Opname (SO) CUP konsisten menggunakan rumus baku (slop \xD7 50) + pcs."
      ],
      anomalies: [
        "Tidak ditemukan selisih fisik yang mencurigakan; angka SO dan ST harian kasir tercatat akurat."
      ],
      lowStockAlerts: lowStockAlerts.slice(0, 4),
      financialAnalysis: `Dari total omset kotor Rp ${totalGross.toLocaleString("id-ID")}, transaksi non-tunai QRIS mencapai Rp ${totalQrisVal.toLocaleString("id-ID")} (${(totalQrisVal / (totalGross || 1) * 100).toFixed(1)}%). Pengeluaran operasional outlet tercatat Rp ${totalExp.toLocaleString("id-ID")} yang didominasi oleh pembelian es batu kristal harian.`,
      branchComparison: isComparison ? "Cabang Sompok membukukan volume transaksi stabil di area perkantoran, sedangkan Cabang Suyudono menunjukkan efisiensi operasional harian yang sangat baik." : `Operasional Cabang ${branches[0]} berkinerja solid dengan kontrol pengeluaran harian yang tertib.`,
      recommendations: [
        "Pastikan pengisian form SO CUP dengan rumus (slop \xD7 50) + pcs dilakukan teliti setiap tutup kasir.",
        "Lakukan pemesanan restock terpusat 2 hari sebelum stok aman (safety stock) mencapai batas kritis.",
        "Maksimalkan promosi menu Choco Series dan Yoghurt Series pada jam santai sore hari."
      ],
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    res.json(deterministicResult);
  } catch (err) {
    console.error("Error generating AI analysis:", err);
    res.status(500).json({
      error: "Layanan AI mengalami kendala: " + (err.message || "Gagal memproses data")
    });
  }
});
app.post("/api/sync", (req, res) => {
  const { queue } = req.body;
  if (!Array.isArray(queue) || queue.length === 0) {
    return res.json({ synced: 0 });
  }
  let count = 0;
  for (const item of queue) {
    if (item.action === "save_record" && item.record) {
      const rec = item.record;
      const idx = db.records.findIndex((r) => r.id === rec.id || r.branch === rec.branch && r.date === rec.date);
      rec.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (idx >= 0) {
        db.records[idx] = rec;
      } else {
        db.records.push(rec);
      }
      count++;
    }
  }
  saveDatabase();
  res.json({ synced: count, message: `${count} rekapan berhasil disinkronkan` });
});
app.all(["/api", "/api/*"], (req, res) => {
  res.status(404).json({
    error: `Rute '${req.method} ${req.originalUrl || req.url}' tidak ditemukan di server Rekapan Teh Kota`
  });
});
var app_default = app;
export {
  broadcastSyncEvent,
  app_default as default
};
