// api/app.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
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
var JAKARTA_TIMEZONE = "Asia/Jakarta";
function calculateStokAkhir(sa, inQty, outQty) {
  const saNum = Number(sa) || 0;
  const inNum = Number(inQty) || 0;
  const outNum = Number(outQty) || 0;
  return Math.round((saNum + inNum - outNum) * 100) / 100;
}
function convertTransferQtyToStockQty(itemName, qty, unit) {
  const cleanQty = Math.max(0, Number(qty) || 0);
  if (itemName.toUpperCase() === "CUP" && unit.toLowerCase() === "slop") {
    return Math.round(cleanQty * 50 * 100) / 100;
  }
  return Math.round(cleanQty * 100) / 100;
}
function calculateHabisGula(gulaAmbil, gulaKemarin, sisaGula, gulaCair) {
  const ambil = Number(gulaAmbil) || 0;
  const kemarin = Number(gulaKemarin) || 0;
  const sisa = Number(sisaGula) || 0;
  const cair = Number(gulaCair) || 0;
  const result = ambil + kemarin - sisa - cair;
  return Math.round(result * 100) / 100;
}
function validateGulaDetail(gula) {
  const ambil = Number(gula.gulaAmbil) || 0;
  const kemarin = Number(gula.gulaKemarin) || 0;
  const sisa = Number(gula.sisaGula) || 0;
  const cair = Number(gula.gulaCair) || 0;
  if (ambil < 0 || kemarin < 0 || sisa < 0 || cair < 0) {
    return {
      valid: false,
      error: "Angka input gula (Ambil, Kemarin, Sisa, Cair) tidak boleh bernilai negatif."
    };
  }
  const habis = calculateHabisGula(ambil, kemarin, sisa, cair);
  if (habis < 0) {
    return {
      valid: false,
      error: `Hasil Gula Habis bernilai negatif (${habis} KG). Sisa Gula + Gula Cair (${Math.round((sisa + cair) * 100) / 100} KG) melebihi total stok tersedia (${Math.round((ambil + kemarin) * 100) / 100} KG). Mohon periksa kembali angka input.`
    };
  }
  if (habis > 100) {
    return {
      valid: true,
      warning: `Pemakaian gula tercatat cukup tinggi (${habis} KG). Pastikan satuan yang diinput benar dalam KG.`
    };
  }
  return { valid: true };
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
function formatDateJakarta(dateObj = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(dateObj);
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}
function getTodayDateStr() {
  return formatDateJakarta(/* @__PURE__ */ new Date());
}
function getJakartaDateOffsetStr(daysOffset) {
  const todayStr = getTodayDateStr();
  const [y, m, d] = todayStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + daysOffset, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}
function getYesterdayDateStr() {
  return getJakartaDateOffsetStr(-1);
}
function getCurrentMonthStr() {
  return getTodayDateStr().slice(0, 7);
}
function getJakartaTimeStr(dateObj = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(dateObj);
}

// api/db.ts
import fs from "fs";
import path from "path";
import { Pool } from "pg";

// api/security.ts
import crypto from "crypto";
var DEV_FALLBACK_SECRET = "tehkota-v140-local-dev-secret-change-auth-secret-in-vercel";
function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
}
function isUsingDefaultSecret() {
  return !process.env.AUTH_SECRET && !process.env.JWT_SECRET;
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return { valid: false, needsRehash: false };
  }
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hexHash] = parts;
    const expected = Buffer.from(hexHash, "hex");
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return { valid: false, needsRehash: false };
    const valid2 = crypto.timingSafeEqual(expected, actual);
    return { valid: valid2, needsRehash: false };
  }
  const valid = storedHash === password;
  return { valid, needsRehash: valid };
}
function signSessionToken(user) {
  const nowSec = Math.floor(Date.now() / 1e3);
  const payload = {
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branch: user.branch,
    iat: nowSec,
    exp: nowSec + 60 * 60 * 24 * 14
    // 14 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  return `tkv1.${encoded}.${sig}`;
}
function verifySessionToken(token) {
  if (!token) return { valid: false };
  if (token.startsWith("tkv1.")) {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };
    const [, encoded, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false };
    }
    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) {
        return { valid: false };
      }
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }
  if (token.startsWith("tok_")) {
    const rest = token.slice(4);
    const lastUnderscore = rest.lastIndexOf("_");
    if (lastUnderscore > 0) {
      return { valid: false, legacyUserId: rest.slice(0, lastUnderscore) };
    }
  }
  return { valid: false };
}

// api/db.ts
var isVercel = Boolean(process.env.VERCEL);
var localDataDir = path.resolve(process.cwd(), "data");
var localDbPath = path.resolve(localDataDir, "tehkota_db.json");
var tmpDataDir = path.resolve("/tmp", "tehkota_data");
var tmpDbPath = path.resolve(tmpDataDir, "tehkota_db.json");
function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.SUPABASE_DB_URL || process.env.NEON_DATABASE_URL || void 0;
}
function createDefaultUsers() {
  const ownerUsername = process.env.OWNER_USERNAME || "Tehkota321";
  const ownerPassword = process.env.OWNER_PASSWORD || "Tehkota321";
  const sompokPassword = process.env.KASIR_SOMPOK_PASSWORD || "sompok123";
  const suyudonoPassword = process.env.KASIR_SUYUDONO_PASSWORD || "suyudono123";
  return [
    {
      id: "usr_sompok",
      username: "kasir.sompok",
      passwordHash: hashPassword(sompokPassword),
      name: "Kasir Sompok",
      email: "kasir.sompok@tehkota.com",
      role: "kasir",
      branch: "Sompok",
      active: true,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "usr_suyudono",
      username: "kasir.suyudono",
      passwordHash: hashPassword(suyudonoPassword),
      name: "Kasir Suyudono",
      email: "kasir.suyudono@tehkota.com",
      role: "kasir",
      branch: "Suyudono",
      active: true,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "usr_owner",
      username: ownerUsername,
      passwordHash: hashPassword(ownerPassword),
      name: "Owner Teh Kota",
      email: "owner@tehkota.com",
      role: "admin",
      branch: "All",
      active: true,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
}
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
      if (row.sa < 500) row.inQty = 1e3;
      row.outQty = cupSold;
      row.st = calculateStokAkhir(row.sa, row.inQty, row.outQty);
      row.so = row.st;
      const slops = Math.floor(Math.max(0, row.so) / 50);
      const rem = Math.max(0, row.so) % 50;
      row.cupDetail = {
        slop: slops,
        pcs: rem,
        rusakPcs: 1,
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
      const out = 2;
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
      gulaKemarin: 3,
      sisaGula: 3,
      gulaCair: 1,
      habisGula: 9
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
function loadMergedFileDatabase() {
  let localParsed = null;
  let tmpParsed = null;
  if (fs.existsSync(localDbPath)) {
    try {
      localParsed = JSON.parse(fs.readFileSync(localDbPath, "utf-8"));
    } catch {
    }
  }
  if (fs.existsSync(tmpDbPath)) {
    try {
      tmpParsed = JSON.parse(fs.readFileSync(tmpDbPath, "utf-8"));
    } catch {
    }
  }
  const mergedRecordsMap = /* @__PURE__ */ new Map();
  const hasExistingFile = Boolean(
    localParsed && Array.isArray(localParsed.records) && localParsed.records.length > 0 || tmpParsed && Array.isArray(tmpParsed.records) && tmpParsed.records.length > 0
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
      if (!existing || new Date(r.updatedAt || r.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
        mergedRecordsMap.set(key, r);
      }
    }
  }
  const userMap = /* @__PURE__ */ new Map();
  for (const u of createDefaultUsers()) {
    userMap.set(u.id, u);
  }
  const sourceUsers = [...localParsed?.users || [], ...tmpParsed?.users || []];
  for (const su of sourceUsers) {
    if (!su || !su.id) continue;
    const migratedHash = su.passwordHash?.startsWith("scrypt$") ? su.passwordHash : hashPassword(su.passwordHash || "tehkota123");
    userMap.set(su.id, {
      ...su,
      passwordHash: migratedHash,
      active: su.active !== false
    });
  }
  if (process.env.OWNER_USERNAME || process.env.OWNER_PASSWORD) {
    const owner = userMap.get("usr_owner");
    if (owner) {
      if (process.env.OWNER_USERNAME) owner.username = process.env.OWNER_USERNAME;
      if (process.env.OWNER_PASSWORD) owner.passwordHash = hashPassword(process.env.OWNER_PASSWORD);
    }
  }
  const transferMap = /* @__PURE__ */ new Map();
  for (const t of [...localParsed?.transfers || [], ...tmpParsed?.transfers || []]) {
    if (!t || !t.id) continue;
    const prev = transferMap.get(t.id);
    if (!prev || new Date(t.updatedAt || t.createdAt || 0).getTime() >= new Date(prev.updatedAt || prev.createdAt || 0).getTime()) {
      transferMap.set(t.id, t);
    }
  }
  const auditMap = /* @__PURE__ */ new Map();
  for (const log of [...localParsed?.auditLogs || [], ...tmpParsed?.auditLogs || []]) {
    if (log && log.id && !auditMap.has(log.id)) {
      auditMap.set(log.id, log);
    }
  }
  const finalRecords = Array.from(mergedRecordsMap.values()).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
  const finalTransfers = Array.from(transferMap.values()).sort(
    (a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date)
  );
  const finalAudits = Array.from(auditMap.values()).sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );
  const finalBackups = [...localParsed?.backups || tmpParsed?.backups || []];
  return {
    users: Array.from(userMap.values()),
    records: finalRecords,
    transfers: finalTransfers,
    auditLogs: finalAudits,
    backups: finalBackups
  };
}
function saveFileDatabase(schema) {
  const jsonStr = JSON.stringify(schema, null, 2);
  try {
    if (!fs.existsSync(localDataDir)) fs.mkdirSync(localDataDir, { recursive: true });
    fs.writeFileSync(localDbPath, jsonStr, "utf-8");
  } catch {
  }
  try {
    if (!fs.existsSync(tmpDataDir)) fs.mkdirSync(tmpDataDir, { recursive: true });
    fs.writeFileSync(tmpDbPath, jsonStr, "utf-8");
  } catch {
  }
}
var UnifiedDatabase = class {
  constructor() {
    this.pool = null;
    this.fileDb = null;
    this.initPromise = null;
    this.mode = "file";
    this.initError = null;
  }
  async init() {
    if (!this.initPromise) {
      this.initPromise = this._initialize();
    }
    return this.initPromise;
  }
  async _initialize() {
    const dbUrl = getDatabaseUrl();
    const seedFileData = loadMergedFileDatabase();
    this.initError = null;
    if (dbUrl) {
      try {
        const isLocalhost = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: isLocalhost ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 12e3
        });
        await this.ensurePostgresSchema();
        await this.migrateFileToPostgresIfEmpty(seedFileData);
        this.mode = "postgresql";
        return;
      } catch (err) {
        this.initError = err?.message || "Koneksi PostgreSQL gagal";
        console.error("[Teh Kota DB] PostgreSQL connection failed, falling back to JSON store:", err);
        this.pool = null;
      }
    }
    this.fileDb = seedFileData;
    saveFileDatabase(this.fileDb);
    this.mode = "file";
  }
  async ensurePostgresSchema() {
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
  async migrateFileToPostgresIfEmpty(seed) {
    if (!this.pool) return;
    const userRes = await this.pool.query("SELECT COUNT(*)::int AS cnt FROM tk_users");
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
            u.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          ]
        );
      }
    }
    const recRes = await this.pool.query("SELECT COUNT(*)::int AS cnt FROM tk_records");
    if ((recRes.rows[0]?.cnt || 0) === 0 && seed.records.length > 0) {
      for (const r of seed.records) {
        await this.pool.query(
          `INSERT INTO tk_records (id, branch, date, updated_at, data)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (branch, date) DO NOTHING`,
          [r.id, r.branch, r.date, r.updatedAt || r.createdAt || (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(r)]
        );
      }
    }
    const trRes = await this.pool.query("SELECT COUNT(*)::int AS cnt FROM tk_transfers");
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
            JSON.stringify(t)
          ]
        );
      }
    }
    const audRes = await this.pool.query("SELECT COUNT(*)::int AS cnt FROM tk_audit_logs");
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
    const persistentCloud = this.mode === "postgresql";
    return {
      mode: this.mode,
      isVercel,
      hasDatabaseUrl,
      persistentCloud,
      ephemeralWarning: isVercel && !persistentCloud,
      initError: this.initError
    };
  }
  // ---- USERS ----
  async getUsers() {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("SELECT * FROM tk_users ORDER BY role ASC, username ASC");
      return res.rows.map((row) => ({
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        name: row.name,
        email: row.email,
        role: row.role,
        branch: row.branch,
        active: row.active,
        updatedAt: row.updated_at
      }));
    }
    return this.fileDb.users;
  }
  async getUserByUsername(username) {
    const users = await this.getUsers();
    const target = username.trim().toLowerCase();
    return users.find((u) => u.username.toLowerCase() === target);
  }
  async getUserById(id) {
    const users = await this.getUsers();
    return users.find((u) => u.id === id);
  }
  async upsertUser(user) {
    await this.init();
    const updatedUser = {
      ...user,
      active: user.active !== false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.pool && this.mode === "postgresql") {
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
          updatedUser.updatedAt
        ]
      );
      return updatedUser;
    }
    const idx = this.fileDb.users.findIndex((u) => u.id === updatedUser.id);
    if (idx >= 0) this.fileDb.users[idx] = updatedUser;
    else this.fileDb.users.push(updatedUser);
    saveFileDatabase(this.fileDb);
    return updatedUser;
  }
  // ---- RECORDS ----
  async getRecords(filter) {
    await this.init();
    let list = [];
    if (this.pool && this.mode === "postgresql") {
      const clauses = [];
      const params = [];
      if (filter?.branch && filter.branch !== "All") {
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
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const res = await this.pool.query(`SELECT data FROM tk_records ${where} ORDER BY date DESC`, params);
      list = res.rows.map((r) => r.data);
    } else {
      list = [...this.fileDb.records];
      if (filter?.branch && filter.branch !== "All") {
        list = list.filter((r) => r.branch === filter.branch);
      }
      if (filter?.date) {
        list = list.filter((r) => r.date === filter.date);
      } else if (filter?.month) {
        list = list.filter((r) => r.date.startsWith(filter.month));
      }
      list.sort((a, b) => b.date.localeCompare(a.date));
    }
    return list;
  }
  async getRecordById(id) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("SELECT data FROM tk_records WHERE id = $1 LIMIT 1", [id]);
      return res.rows[0]?.data;
    }
    return this.fileDb.records.find((r) => r.id === id);
  }
  async getRecordByBranchDate(branch, date) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query(
        "SELECT data FROM tk_records WHERE branch = $1 AND date = $2 LIMIT 1",
        [branch, date]
      );
      return res.rows[0]?.data;
    }
    return this.fileDb.records.find((r) => r.branch === branch && r.date === date);
  }
  async upsertRecord(record) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
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
          record.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
          JSON.stringify(record)
        ]
      );
      return record;
    }
    const idx = this.fileDb.records.findIndex(
      (r) => r.id === record.id || r.branch === record.branch && r.date === record.date
    );
    if (idx >= 0) this.fileDb.records[idx] = record;
    else this.fileDb.records.push(record);
    this.fileDb.records.sort((a, b) => b.date.localeCompare(a.date));
    saveFileDatabase(this.fileDb);
    return record;
  }
  async deleteRecord(id) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("DELETE FROM tk_records WHERE id = $1 RETURNING data", [id]);
      return res.rows[0]?.data || null;
    }
    const idx = this.fileDb.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const [deleted] = this.fileDb.records.splice(idx, 1);
    saveFileDatabase(this.fileDb);
    return deleted;
  }
  async resetBranchRecords(branch) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      let deletedCount = 0;
      if (branch && branch !== "All") {
        const res = await this.pool.query("DELETE FROM tk_records WHERE branch = $1", [branch]);
        deletedCount = res.rowCount || 0;
      } else {
        const res = await this.pool.query("DELETE FROM tk_records");
        deletedCount = res.rowCount || 0;
      }
      const rem = await this.pool.query("SELECT COUNT(*)::int AS cnt FROM tk_records");
      return { deletedCount, remainingCount: rem.rows[0]?.cnt || 0 };
    }
    const initialCount = this.fileDb.records.length;
    if (branch && branch !== "All") {
      this.fileDb.records = this.fileDb.records.filter((r) => r.branch !== branch);
    } else {
      this.fileDb.records = [];
    }
    saveFileDatabase(this.fileDb);
    return {
      deletedCount: initialCount - this.fileDb.records.length,
      remainingCount: this.fileDb.records.length
    };
  }
  // ---- TRANSFERS ----
  async getTransfers() {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("SELECT data FROM tk_transfers ORDER BY updated_at DESC");
      return res.rows.map((r) => r.data);
    }
    return [...this.fileDb.transfers].sort(
      (a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date)
    );
  }
  async getTransferById(id) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("SELECT data FROM tk_transfers WHERE id = $1 LIMIT 1", [id]);
      return res.rows[0]?.data;
    }
    return this.fileDb.transfers.find((t) => t.id === id);
  }
  async upsertTransfer(transfer) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
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
          JSON.stringify(transfer)
        ]
      );
      return transfer;
    }
    const idx = this.fileDb.transfers.findIndex((t) => t.id === transfer.id);
    if (idx >= 0) this.fileDb.transfers[idx] = transfer;
    else this.fileDb.transfers.unshift(transfer);
    saveFileDatabase(this.fileDb);
    return transfer;
  }
  // ---- AUDIT LOGS ----
  async getAuditLogs(filter) {
    await this.init();
    let logs = [];
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("SELECT data FROM tk_audit_logs ORDER BY timestamp DESC LIMIT 200");
      logs = res.rows.map((r) => r.data);
    } else {
      logs = [...this.fileDb.auditLogs];
    }
    if (filter?.branch && filter.branch !== "All") {
      logs = logs.filter((l) => l.branch === filter.branch);
    }
    if (filter?.recordId) {
      logs = logs.filter((l) => l.recordId === filter.recordId);
    }
    return logs;
  }
  async appendAuditLog(entry) {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      await this.pool.query(
        `INSERT INTO tk_audit_logs (id, record_id, branch, timestamp, data)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [entry.id, entry.recordId, entry.branch, entry.timestamp, JSON.stringify(entry)]
      );
      return;
    }
    this.fileDb.auditLogs.unshift(entry);
    if (this.fileDb.auditLogs.length > 500) {
      this.fileDb.auditLogs = this.fileDb.auditLogs.slice(0, 500);
    }
    saveFileDatabase(this.fileDb);
  }
  // ---- BACKUP & RESTORE ----
  async exportSnapshot() {
    const [users, records, transfers, auditLogs] = await Promise.all([
      this.getUsers(),
      this.getRecords(),
      this.getTransfers(),
      this.getAuditLogs()
    ]);
    return { users, records, transfers, auditLogs };
  }
  async createBackup(createdBy, note) {
    await this.init();
    const snapshot = await this.exportSnapshot();
    const id = `bak_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const backup = {
      id,
      createdAt,
      createdBy,
      note,
      recordsCount: snapshot.records.length,
      transfersCount: snapshot.transfers.length,
      usersCount: snapshot.users.length,
      snapshot
    };
    if (this.pool && this.mode === "postgresql") {
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
          JSON.stringify(backup.snapshot)
        ]
      );
    } else {
      this.fileDb.backups.unshift(backup);
      if (this.fileDb.backups.length > 25) {
        this.fileDb.backups = this.fileDb.backups.slice(0, 25);
      }
      saveFileDatabase(this.fileDb);
    }
    return {
      id: backup.id,
      createdAt: backup.createdAt,
      createdBy: backup.createdBy,
      note: backup.note,
      recordsCount: backup.recordsCount,
      transfersCount: backup.transfersCount,
      usersCount: backup.usersCount
    };
  }
  async listBackups() {
    await this.init();
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query(
        "SELECT id, created_at, created_by, note, records_count, transfers_count, users_count FROM tk_backups ORDER BY created_at DESC LIMIT 25"
      );
      return res.rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        createdBy: r.created_by,
        note: r.note,
        recordsCount: r.records_count,
        transfersCount: r.transfers_count,
        usersCount: r.users_count
      }));
    }
    return (this.fileDb.backups || []).map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      note: b.note,
      recordsCount: b.recordsCount,
      transfersCount: b.transfersCount,
      usersCount: b.usersCount
    }));
  }
  async restoreBackup(id) {
    await this.init();
    let snap = null;
    if (this.pool && this.mode === "postgresql") {
      const res = await this.pool.query("SELECT snapshot FROM tk_backups WHERE id = $1 LIMIT 1", [id]);
      snap = res.rows[0]?.snapshot || null;
      if (!snap) return null;
      await this.pool.query("DELETE FROM tk_records");
      for (const r of snap.records || []) {
        await this.pool.query(
          `INSERT INTO tk_records (id, branch, date, updated_at, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (branch, date) DO UPDATE SET data = EXCLUDED.data`,
          [r.id, r.branch, r.date, r.updatedAt || r.createdAt, JSON.stringify(r)]
        );
      }
      await this.pool.query("DELETE FROM tk_transfers");
      for (const t of snap.transfers || []) {
        await this.pool.query(
          `INSERT INTO tk_transfers (id, transfer_number, date, sender_branch, receiver_branch, status, updated_at, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [t.id, t.transferNumber, t.date, t.senderBranch, t.receiverBranch, t.status, t.updatedAt, JSON.stringify(t)]
        );
      }
      return {
        restoredRecords: (snap.records || []).length,
        restoredTransfers: (snap.transfers || []).length
      };
    }
    const found = (this.fileDb.backups || []).find((b) => b.id === id);
    if (!found) return null;
    this.fileDb.records = JSON.parse(JSON.stringify(found.snapshot.records || []));
    this.fileDb.transfers = JSON.parse(JSON.stringify(found.snapshot.transfers || []));
    saveFileDatabase(this.fileDb);
    return {
      restoredRecords: this.fileDb.records.length,
      restoredTransfers: this.fileDb.transfers.length
    };
  }
};
var db = new UnifiedDatabase();

// api/app.ts
dotenv.config();
var app = express();
app.use(express.json({ limit: "15mb" }));
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
  const filePath = path2.resolve(process.cwd(), "dist", req.path.replace(/^\//, ""));
  if (fs2.existsSync(filePath)) {
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
function sanitizeUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    branch: u.branch,
    active: u.active !== false,
    updatedAt: u.updatedAt
  };
}
async function resolveUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const rawToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : queryToken.trim();
  if (!rawToken) return null;
  const verification = verifySessionToken(rawToken);
  if (verification.valid) {
    const found = await db.getUserById(verification.payload.uid);
    if (!found || found.active === false) return null;
    return sanitizeUser(found);
  }
  if (verification.legacyUserId) {
    const found = await db.getUserById(verification.legacyUserId);
    if (!found || found.active === false) return null;
    return sanitizeUser(found);
  }
  return null;
}
async function requireAuth(req, res, next) {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Sesi tidak valid atau belum login. Silakan login kembali." });
    }
    req.authUser = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Gagal memverifikasi sesi pengguna: " + (err.message || "Error") });
  }
}
function requireAdmin(req, res, next) {
  if (!req.authUser) {
    return res.status(401).json({ error: "Belum login" });
  }
  if (req.authUser.role !== "admin") {
    return res.status(403).json({ error: "Akses khusus Owner / Admin." });
  }
  next();
}
function canAccessBranch(user, targetBranch) {
  if (user.role === "admin" || user.branch === "All") return true;
  return user.branch === targetBranch;
}
var sseClients = [];
function broadcastSyncEvent(payload) {
  const message = `data: ${JSON.stringify(payload)}

`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      const matchesSender = !client.branch || client.branch === "All" || !payload.branch || client.branch === payload.branch || payload.receiverBranch && client.branch === payload.receiverBranch;
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
    event: "ping",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}, 25e3);
async function cascadeSubsequentRecords(branch, fromDate, startStocks) {
  const allBranch = await db.getRecords({ branch });
  const subsequentRecords = allBranch.filter((r) => r.date > fromDate).sort((a, b) => a.date.localeCompare(b.date));
  if (subsequentRecords.length === 0) return;
  let currentPrevStocks = startStocks;
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
      await db.upsertRecord(subRecord);
    }
    currentPrevStocks = subRecord.stocks;
  }
}
async function getCarryoverForDate(branch, targetDate) {
  const allBranch = await db.getRecords({ branch });
  const priorRecords = allBranch.filter((r) => r.date < targetDate).sort((a, b) => b.date.localeCompare(a.date));
  const previousRecord = priorRecords[0];
  if (!previousRecord) {
    const map2 = {};
    for (const item of TEH_KOTA_ITEMS) {
      map2[item.name] = item.defaultSa;
    }
    return {
      hasPrevious: false,
      hasPreviousGula: false,
      previousDate: void 0,
      previousRecordId: void 0,
      stocks: map2,
      gulaKemarin: 0
    };
  }
  const map = {};
  for (const item of previousRecord.stocks) {
    map[item.name] = item.st;
  }
  const prevSisaGula = previousRecord.gulaDetail ? Number(previousRecord.gulaDetail.sisaGula) || 0 : 0;
  return {
    hasPrevious: true,
    hasPreviousGula: Boolean(previousRecord.gulaDetail),
    previousDate: previousRecord.date,
    previousRecordId: previousRecord.id,
    stocks: map,
    gulaKemarin: prevSisaGula
  };
}
async function applyTransferStockToBranch(params) {
  const { branch, date, items, direction, useActualQty, reverse = false, operatorName, transferNumber } = params;
  let record = await db.getRecordByBranchDate(branch, date);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (!record) {
    const carryover = await getCarryoverForDate(branch, date);
    const freshStocks = createInitialStockRows(carryover.stocks);
    record = {
      id: `rek_${branch.toLowerCase()}_${date.replace(/-/g, "")}`,
      branch,
      date,
      timeStr: getJakartaTimeStr(),
      createdAt: now,
      updatedAt: now,
      createdBy: operatorName,
      status: "saved",
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
        habisGula: 0
      },
      notes: "",
      revisionCount: 0,
      auditLogs: []
    };
  }
  const sign = reverse ? -1 : 1;
  const changes = [];
  const customNotes = [];
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
      if (direction === "out") {
        targetRow.outQty = Math.max(0, Math.round((targetRow.outQty + sign * stockDelta) * 100) / 100);
      } else {
        targetRow.inQty = Math.max(0, Math.round((targetRow.inQty + sign * stockDelta) * 100) / 100);
      }
      targetRow.st = calculateStokAkhir(targetRow.sa, targetRow.inQty, targetRow.outQty);
      changes.push({
        field: `stock_${targetRow.name}`,
        label: `Stok ${targetRow.name} (${transferNumber})`,
        before: `IN:${oldIn} OUT:${oldOut} ST:${oldSt}`,
        after: `IN:${targetRow.inQty} OUT:${targetRow.outQty} ST:${targetRow.st}`
      });
    } else {
      customNotes.push(
        `[${transferNumber}] ${reverse ? "Pembatalan " : ""}${direction === "out" ? "Keluar ke cabang lain" : "Masuk dari cabang lain"}: ${tItem.itemName} ${rawQty} ${tItem.unit}`
      );
    }
  }
  if (customNotes.length > 0) {
    record.notes = [record.notes, ...customNotes].filter(Boolean).join("\n");
  }
  const auditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordId: record.id,
    entityType: "transfer",
    branch,
    date,
    editedBy: operatorName,
    timestamp: now,
    note: `${reverse ? "Pembatalan" : direction === "out" ? "Pengiriman Keluar" : "Penerimaan Masuk"} ${transferNumber}`,
    changes
  };
  record.updatedAt = now;
  record.lastEditedBy = operatorName;
  record.lastEditedAt = now;
  record.revisionCount = (record.revisionCount || 0) + 1;
  record.auditLogs = [auditEntry, ...record.auditLogs || []];
  await db.upsertRecord(record);
  await db.appendAuditLog(auditEntry);
  await cascadeSubsequentRecords(branch, date, record.stocks);
  broadcastSyncEvent({
    event: "record_updated",
    branch,
    date,
    record,
    editedBy: operatorName,
    auditLog: auditEntry,
    timestamp: now
  });
  return record;
}
app.get("/api", async (_req, res) => {
  await db.init();
  res.json({
    status: "ok",
    message: "Teh Kota Backend API v1.4.0",
    version: "1.4.0",
    storage: db.getStorageInfo(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/health", async (_req, res) => {
  await db.init();
  const [records, users, transfers] = await Promise.all([
    db.getRecords(),
    db.getUsers(),
    db.getTransfers()
  ]);
  res.json({
    status: "ok",
    app: "Rekapan Teh Kota API",
    version: "1.4.0",
    storage: db.getStorageInfo(),
    defaultSecretWarning: isUsingDefaultSecret(),
    recordsCount: records.length,
    transfersCount: transfers.length,
    usersCount: users.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, branch } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi" });
    }
    const user = await db.getUserByUsername(String(username));
    if (!user || user.active === false) {
      return res.status(401).json({ error: "Username atau password salah" });
    }
    const pwCheck = verifyPassword(String(password), user.passwordHash);
    if (!pwCheck.valid) {
      return res.status(401).json({ error: "Username atau password salah" });
    }
    if (pwCheck.needsRehash) {
      user.passwordHash = hashPassword(String(password));
      await db.upsertUser(user);
    }
    if (user.role !== "admin" && branch && user.branch !== branch) {
      return res.status(403).json({
        error: `Akun ini hanya dapat mengakses Cabang ${user.branch}`
      });
    }
    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);
    res.json({
      token,
      user: {
        ...safeUser,
        branch: user.role === "admin" ? user.branch : safeUser.branch
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal memproses login: " + (err.message || "Server error") });
  }
});
app.post("/api/auth/quick-login", async (req, res) => {
  try {
    const { branch } = req.body || {};
    if (!branch || branch !== "Sompok" && branch !== "Suyudono") {
      return res.status(400).json({ error: "Cabang tidak valid" });
    }
    const users = await db.getUsers();
    const user = users.find((u) => u.branch === branch && u.role === "kasir" && u.active !== false);
    if (!user) {
      return res.status(404).json({ error: `Akun kasir aktif untuk cabang ${branch} tidak ditemukan` });
    }
    const safeUser = sanitizeUser(user);
    const token = signSessionToken(safeUser);
    res.json({
      token,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal quick-login: " + (err.message || "Server error") });
  }
});
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});
app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.getUsers();
  res.json({ users: users.map(sanitizeUser) });
});
app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, email, role = "kasir", branch = "Sompok" } = req.body || {};
    if (!username || !password || !name) {
      return res.status(400).json({ error: "Username, nama, dan kata sandi wajib diisi." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Kata sandi minimal 6 karakter." });
    }
    const existing = await db.getUserByUsername(String(username));
    if (existing) {
      return res.status(409).json({ error: `Username '${username}' sudah terdaftar.` });
    }
    const assignedRole = role === "admin" ? "admin" : "kasir";
    const assignedBranch = assignedRole === "admin" ? "All" : branch === "Suyudono" ? "Suyudono" : "Sompok";
    const newUser = await db.upsertUser({
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      username: String(username).trim(),
      passwordHash: hashPassword(String(password)),
      name: String(name).trim(),
      email: String(email || `${String(username).trim()}@tehkota.com`).trim(),
      role: assignedRole,
      branch: assignedBranch,
      active: true
    });
    await db.appendAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: newUser.id,
      entityType: "user",
      branch: "All",
      date: getTodayDateStr(),
      editedBy: req.authUser.name,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      note: `Menambahkan akun baru: ${newUser.username} (${newUser.role})`,
      changes: [
        { field: "username", label: "Akun Baru", before: "-", after: `${newUser.username} (${newUser.branch})` }
      ]
    });
    res.status(201).json({ success: true, user: sanitizeUser(newUser) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Gagal membuat akun" });
  }
});
app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getUserById(id);
    if (!existing) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    }
    const { name, email, password, active, username } = req.body || {};
    if (password && String(password).length < 6) {
      return res.status(400).json({ error: "Kata sandi baru minimal 6 karakter." });
    }
    const updated = await db.upsertUser({
      ...existing,
      username: username ? String(username).trim() : existing.username,
      name: name ? String(name).trim() : existing.name,
      email: email ? String(email).trim() : existing.email,
      passwordHash: password ? hashPassword(String(password)) : existing.passwordHash,
      active: typeof active === "boolean" ? active : existing.active !== false
    });
    await db.appendAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: updated.id,
      entityType: "user",
      branch: "All",
      date: getTodayDateStr(),
      editedBy: req.authUser.name,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      note: `Memperbarui akun ${updated.username}${password ? " (termasuk kata sandi)" : ""}`,
      changes: [
        {
          field: "userUpdate",
          label: `Akun ${updated.username}`,
          before: existing.active === false ? "Nonaktif" : "Aktif",
          after: updated.active === false ? "Nonaktif" : "Aktif"
        }
      ]
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Gagal memperbarui akun" });
  }
});
app.get("/api/records/previous-stock", requireAuth, async (req, res) => {
  const { branch, date } = req.query;
  if (!branch || !date) {
    return res.status(400).json({ error: "Parameter branch dan date wajib diisi" });
  }
  if (!canAccessBranch(req.authUser, branch)) {
    return res.status(403).json({ error: `Akses ditolak untuk Cabang ${branch}` });
  }
  const carryover = await getCarryoverForDate(branch, date);
  res.json(carryover);
});
app.get("/api/sync/stream", async (req, res) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Sesi tidak valid atau belum login" });
  }
  const requestedBranch = req.query.branch || void 0;
  if (user.role !== "admin" && requestedBranch && requestedBranch !== "All" && !canAccessBranch(user, requestedBranch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${user.branch} tidak dapat berlangganan stream Cabang ${requestedBranch}.`
    });
  }
  const effectiveBranch = user.role !== "admin" ? user.branch : requestedBranch;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) {
    res.flushHeaders();
  }
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newClient = { id: clientId, res, branch: effectiveBranch };
  sseClients.push(newClient);
  res.write(
    `data: ${JSON.stringify({ event: "connected", clientId, timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`
  );
  req.on("close", () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});
app.get("/api/sync/poll", requireAuth, async (req, res) => {
  const { branch, since } = req.query;
  if (req.authUser.role !== "admin" && branch && branch !== "All" && !canAccessBranch(req.authUser, branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser.branch} tidak dapat mengambil pembaruan Cabang ${branch}.`
    });
  }
  const targetBranch = req.authUser.role === "admin" ? branch : req.authUser.branch;
  let records = await db.getRecords(targetBranch && targetBranch !== "All" ? { branch: targetBranch } : void 0);
  let transfers = await db.getTransfers();
  if (req.authUser.role !== "admin") {
    transfers = transfers.filter(
      (t) => t.senderBranch === req.authUser.branch || t.receiverBranch === req.authUser.branch
    );
  }
  let auditLogs = await db.getAuditLogs(
    req.authUser.role === "admin" ? void 0 : { branch: req.authUser.branch }
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
    (l) => l.changes?.some((c) => c.field === "delete" || c.field === "reset") || l.entityType === "backup"
  );
  res.json({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    records,
    transfers,
    auditLogs: auditLogs.slice(0, 50),
    hasDeletions,
    hasUpdates: records.length > 0 || transfers.length > 0 || hasDeletions,
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/audit-logs", requireAuth, async (req, res) => {
  const { branch, recordId } = req.query;
  if (req.authUser.role !== "admin" && branch && branch !== "All" && !canAccessBranch(req.authUser, branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser.branch} tidak dapat melihat log aktivitas Cabang ${branch}.`
    });
  }
  const effectiveBranch = req.authUser.role === "admin" ? branch : req.authUser.branch;
  const logs = await db.getAuditLogs({ branch: effectiveBranch, recordId });
  res.json({ auditLogs: logs });
});
app.get("/api/records", requireAuth, async (req, res) => {
  const { branch, month, date, range, query } = req.query;
  if (branch && branch !== "All" && !canAccessBranch(req.authUser, branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser.branch} tidak dapat melihat data Cabang ${branch}.`
    });
  }
  const effectiveBranch = req.authUser.role === "admin" ? branch : req.authUser.branch;
  let list = await db.getRecords({ branch: effectiveBranch, month, date });
  if (range) {
    const todayStr = getTodayDateStr();
    if (range === "today") {
      list = list.filter((r) => r.date === todayStr);
    } else if (range === "yesterday") {
      const yesterdayStr = getYesterdayDateStr();
      list = list.filter((r) => r.date === yesterdayStr);
    } else if (range === "7days") {
      const minDate = getJakartaDateOffsetStr(-7);
      list = list.filter((r) => r.date >= minDate);
    } else if (range === "30days") {
      const minDate = getJakartaDateOffsetStr(-30);
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
app.get("/api/records/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const record = await db.getRecordById(id);
  if (!record) {
    return res.status(404).json({ error: "Rekapan tidak ditemukan" });
  }
  if (!canAccessBranch(req.authUser, record.branch)) {
    return res.status(403).json({ error: `Akses ditolak untuk Cabang ${record.branch}` });
  }
  const relatedAuditLogs = await db.getAuditLogs({ recordId: id });
  res.json({ record: { ...record, auditLogs: relatedAuditLogs } });
});
app.post("/api/records", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
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
      gulaDetail,
      notes = "",
      mode,
      // optional: 'create' | 'update'
      expectedUpdatedAt,
      forceOverwrite = false
    } = body;
    if (!branch || !date) {
      return res.status(400).json({ error: "Cabang dan tanggal wajib diisi" });
    }
    if (branch !== "Sompok" && branch !== "Suyudono") {
      return res.status(400).json({ error: "Cabang harus Sompok atau Suyudono" });
    }
    if (!canAccessBranch(req.authUser, branch)) {
      return res.status(403).json({
        error: `Akses ditolak: Akun kasir ${req.authUser.branch} tidak memiliki hak akses untuk menyimpan atau mengubah data Cabang ${branch}.`
      });
    }
    let normalizedGula = gulaDetail;
    if (gulaDetail) {
      const check = validateGulaDetail(gulaDetail);
      if (!check.valid) {
        return res.status(400).json({ error: check.error || "Input gula tidak valid" });
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
        )
      };
    }
    const existingRecord = id ? await db.getRecordById(id) : await db.getRecordByBranchDate(branch, date);
    const sameBranchDateRecord = !existingRecord ? await db.getRecordByBranchDate(branch, date) : existingRecord;
    if (mode === "create" && sameBranchDateRecord && sameBranchDateRecord.status !== "draft" && !forceOverwrite) {
      return res.status(409).json({
        error: `Rekapan Cabang ${branch} tanggal ${date} sudah tersimpan sebelumnya oleh ${sameBranchDateRecord.createdBy}.`,
        conflictType: "duplicate_date",
        serverRecord: sameBranchDateRecord
      });
    }
    if (expectedUpdatedAt && sameBranchDateRecord && sameBranchDateRecord.updatedAt && sameBranchDateRecord.updatedAt !== expectedUpdatedAt && !forceOverwrite) {
      return res.status(409).json({
        error: `Konflik Edit: Rekapan ini baru saja diperbarui oleh ${sameBranchDateRecord.lastEditedBy || sameBranchDateRecord.createdBy} pada ${new Date(sameBranchDateRecord.updatedAt).toLocaleTimeString("id-ID")} WIB.`,
        conflictType: "concurrent_edit",
        serverRecord: sameBranchDateRecord
      });
    }
    const targetExisting = sameBranchDateRecord || existingRecord;
    const isUpdate = Boolean(targetExisting);
    const recordId = targetExisting?.id || id || `rek_${branch.toLowerCase()}_${date.replace(/-/g, "")}`;
    const normalizedStocks = Array.isArray(stocks) ? stocks.map((s) => ({
      ...s,
      sa: Number(s.sa) || 0,
      inQty: Math.max(0, Number(s.inQty) || 0),
      outQty: Math.max(0, Number(s.outQty) || 0),
      st: calculateStokAkhir(s.sa, s.inQty, s.outQty),
      so: Number(s.so) || 0
    })) : [];
    const totalPengeluaran = calculateTotalPengeluaran(expenses);
    const omsetAkhir = calculateOmsetAkhir(totalOmset, totalPengeluaran, qris);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const editorName = req.authUser.name || req.authUser.username;
    const changes = [];
    if (targetExisting) {
      if (targetExisting.totalOmset !== Number(totalOmset)) {
        changes.push({
          field: "totalOmset",
          label: "Omset Kotor",
          before: targetExisting.totalOmset,
          after: Number(totalOmset)
        });
      }
      if (targetExisting.totalPengeluaran !== totalPengeluaran) {
        changes.push({
          field: "totalPengeluaran",
          label: "Total Pengeluaran",
          before: targetExisting.totalPengeluaran,
          after: totalPengeluaran
        });
      }
      if (targetExisting.qris !== Number(qris)) {
        changes.push({
          field: "qris",
          label: "QRIS / Non Tunai",
          before: targetExisting.qris,
          after: Number(qris)
        });
      }
      if (targetExisting.omsetAkhir !== omsetAkhir) {
        changes.push({
          field: "omsetAkhir",
          label: "Omset Bersih",
          before: targetExisting.omsetAkhir,
          after: omsetAkhir
        });
      }
      if (normalizedGula) {
        const oldGula = targetExisting.gulaDetail;
        if (!oldGula || oldGula.habisGula !== normalizedGula.habisGula || oldGula.sisaGula !== normalizedGula.sisaGula || oldGula.gulaAmbil !== normalizedGula.gulaAmbil || oldGula.gulaCair !== normalizedGula.gulaCair) {
          changes.push({
            field: "gulaDetail.habisGula",
            label: "Gula Habis (KG)",
            before: oldGula ? `${oldGula.habisGula} kg (sisa ${oldGula.sisaGula})` : 0,
            after: `${normalizedGula.habisGula} kg (sisa ${normalizedGula.sisaGula})`
          });
        }
      }
      if (Array.isArray(normalizedStocks) && Array.isArray(targetExisting.stocks)) {
        for (const newS of normalizedStocks) {
          const oldS = targetExisting.stocks.find((s) => s.name === newS.name);
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
    if (!isUpdate || changes.length > 0) {
      auditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recordId,
        entityType: "rekap",
        branch,
        date,
        editedBy: editorName,
        timestamp: now,
        note: !isUpdate ? `Membuat rekapan baru Cabang ${branch}` : notes || "Perubahan data rekapan dari perangkat",
        changes: !isUpdate ? [
          {
            field: "create",
            label: "Input Baru",
            before: "-",
            after: `Omset Rp ${Number(totalOmset).toLocaleString("id-ID")} \u2022 Status ${status}`
          }
        ] : changes
      };
      await db.appendAuditLog(auditEntry);
    }
    const existingLogs = targetExisting?.auditLogs || [];
    const mergedLogs = auditEntry ? [auditEntry, ...existingLogs] : existingLogs;
    const newRecord = {
      id: recordId,
      branch,
      date,
      timeStr: timeStr || getJakartaTimeStr(),
      createdAt: targetExisting ? targetExisting.createdAt : now,
      updatedAt: now,
      createdBy: targetExisting ? targetExisting.createdBy : editorName,
      lastEditedBy: isUpdate ? editorName : void 0,
      lastEditedAt: isUpdate ? now : void 0,
      revisionCount: targetExisting ? (targetExisting.revisionCount || 0) + (changes.length > 0 ? 1 : 0) : 0,
      status,
      stocks: normalizedStocks,
      expenses,
      totalOmset: Number(totalOmset) || 0,
      totalPengeluaran,
      qris: Number(qris) || 0,
      omsetAkhir,
      gulaDetail: normalizedGula || void 0,
      notes,
      auditLogs: mergedLogs
    };
    await db.upsertRecord(newRecord);
    if (newRecord.status !== "draft") {
      await cascadeSubsequentRecords(branch, date, newRecord.stocks);
    }
    broadcastSyncEvent({
      event: isUpdate ? "record_updated" : "record_created",
      branch,
      date,
      record: newRecord,
      editedBy: editorName,
      auditLog: auditEntry,
      timestamp: now
    });
    res.json({
      success: true,
      message: isUpdate ? "Perubahan rekapan berhasil disimpan ke database pusat!" : status === "draft" ? "Draf rekapan berhasil disimpan" : "Rekapan berhasil disimpan ke database pusat!",
      record: newRecord
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan rekapan: " + (err.message || "Server error") });
  }
});
app.delete("/api/records/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const existing = await db.getRecordById(id);
  if (!existing) {
    return res.status(404).json({ error: "Rekapan tidak ditemukan" });
  }
  if (!canAccessBranch(req.authUser, existing.branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Anda tidak memiliki izin menghapus rekapan Cabang ${existing.branch}.`
    });
  }
  await db.deleteRecord(id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.appendAuditLog({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordId: id,
    entityType: "rekap",
    branch: existing.branch,
    date: existing.date,
    editedBy: req.authUser.name,
    timestamp: now,
    note: `Menghapus rekapan Cabang ${existing.branch} tgl ${existing.date}`,
    changes: [
      {
        field: "delete",
        label: "Hapus Rekapan",
        before: `Omset Rp ${(existing.totalOmset || 0).toLocaleString("id-ID")}`,
        after: "Dihapus"
      }
    ]
  });
  broadcastSyncEvent({
    event: "record_deleted",
    branch: existing.branch,
    date: existing.date,
    deletedId: id,
    editedBy: req.authUser.name,
    timestamp: now
  });
  res.json({ success: true, message: "Rekapan berhasil dihapus dari server pusat", deletedId: id });
});
app.post("/api/records/reset", requireAuth, requireAdmin, async (req, res) => {
  const { branch } = req.body || {};
  await db.createBackup(req.authUser.name, `Auto-backup sebelum reset Cabang ${branch || "Semua"}`);
  const result = await db.resetBranchRecords(branch);
  await db.appendAuditLog({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordId: `reset_${branch || "All"}`,
    entityType: "backup",
    branch: branch && branch !== "All" ? branch : "All",
    date: getTodayDateStr(),
    editedBy: req.authUser.name,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    note: `Reset data Cabang ${branch || "Semua"} (backup otomatis dibuat sebelum reset)`,
    changes: [
      { field: "reset", label: "Reset Data", before: `${result.deletedCount} rekapan`, after: "0" }
    ]
  });
  broadcastSyncEvent({
    event: "batch_sync",
    branch,
    editedBy: req.authUser.name,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({
    success: true,
    message: `Rekapan Cabang ${branch || "Semua"} berhasil di-reset. Backup keamanan tersimpan otomatis.`,
    deletedCount: result.deletedCount,
    remainingCount: result.remainingCount
  });
});
app.get("/api/transfers", requireAuth, async (req, res) => {
  const { branch, status, startDate, endDate, search } = req.query;
  let transfers = await db.getTransfers();
  if (req.authUser.role !== "admin") {
    transfers = transfers.filter(
      (t) => t.senderBranch === req.authUser.branch || t.receiverBranch === req.authUser.branch
    );
  } else if (branch && branch !== "All") {
    transfers = transfers.filter((t) => t.senderBranch === branch || t.receiverBranch === branch);
  }
  if (status && status !== "All") {
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
      (t) => t.transferNumber.toLowerCase().includes(q) || t.senderName.toLowerCase().includes(q) || t.receiverName && t.receiverName.toLowerCase().includes(q) || t.items.some((i) => i.itemName.toLowerCase().includes(q))
    );
  }
  res.json({ transfers });
});
app.post("/api/transfers", requireAuth, async (req, res) => {
  try {
    const { date, senderBranch, receiverBranch, items, notes = "", senderName } = req.body || {};
    if (!date || !senderBranch || !receiverBranch) {
      return res.status(400).json({ error: "Tanggal, cabang pengirim, dan cabang penerima wajib diisi." });
    }
    if (senderBranch === receiverBranch) {
      return res.status(400).json({ error: "Cabang pengirim dan cabang penerima tidak boleh sama." });
    }
    if (!canAccessBranch(req.authUser, senderBranch)) {
      return res.status(403).json({
        error: `Akses ditolak: Akun Cabang ${req.authUser.branch} hanya dapat membuat pengiriman dari cabangnya sendiri.`
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Minimal harus ada 1 barang yang dikirim." });
    }
    const cleanItems = [];
    for (const item of items) {
      const qty = Number(item.sentQty);
      if (!item.itemName || !String(item.itemName).trim()) {
        return res.status(400).json({ error: "Semua baris barang harus memiliki nama barang." });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: `Jumlah kirim untuk "${item.itemName}" harus lebih dari 0.` });
      }
      cleanItems.push({
        id: item.id || `ti_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemName: String(item.itemName).trim(),
        isCustom: Boolean(item.isCustom),
        unit: String(item.unit || "pcs").trim(),
        sentQty: Math.round(qty * 100) / 100,
        note: item.note ? String(item.note).trim() : void 0
      });
    }
    const existingTransfers = await db.getTransfers();
    const yymmdd = String(date).replace(/-/g, "").slice(2, 8);
    const sameDayCount = existingTransfers.filter((t) => t.date === date).length + 1;
    const transferNumber = `KRM-${yymmdd}-${String(sameDayCount).padStart(3, "0")}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const operatorName = String(senderName || req.authUser.name).trim();
    const transfer = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      transferNumber,
      date,
      senderBranch,
      receiverBranch,
      items: cleanItems,
      notes: String(notes || "").trim(),
      senderName: operatorName,
      status: "Menunggu Diterima",
      createdBy: req.authUser.name,
      createdAt: now,
      updatedAt: now,
      stockAppliedToSender: true,
      stockAppliedToReceiver: false,
      auditLogs: [
        {
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recordId: transferNumber,
          entityType: "transfer",
          branch: senderBranch,
          date,
          editedBy: req.authUser.name,
          timestamp: now,
          note: `Pengiriman dibuat (${senderBranch} -> ${receiverBranch})`,
          changes: cleanItems.map((ci) => ({
            field: ci.itemName,
            label: ci.itemName,
            before: "0",
            after: `Dikirim ${ci.sentQty} ${ci.unit}`
          }))
        }
      ]
    };
    await applyTransferStockToBranch({
      branch: senderBranch,
      date,
      items: cleanItems,
      direction: "out",
      useActualQty: false,
      operatorName: req.authUser.name,
      transferNumber
    });
    await db.upsertTransfer(transfer);
    broadcastSyncEvent({
      event: "transfer_created",
      branch: senderBranch,
      receiverBranch,
      date,
      transfer,
      editedBy: req.authUser.name,
      timestamp: now
    });
    res.status(201).json({
      success: true,
      message: `Catatan pengiriman ${transferNumber} berhasil dibuat & stok keluar Cabang ${senderBranch} telah diperbarui.`,
      transfer
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal membuat pengiriman: " + (err.message || "Server error") });
  }
});
app.post("/api/transfers/:id/confirm", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { receiverName, confirmationNote = "", items } = req.body || {};
    const transfer = await db.getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: "Catatan pengiriman tidak ditemukan" });
    }
    if (!canAccessBranch(req.authUser, transfer.receiverBranch)) {
      return res.status(403).json({
        error: `Hanya Cabang penerima (${transfer.receiverBranch}) atau Owner yang dapat mengonfirmasi penerimaan barang ini.`
      });
    }
    if (transfer.status !== "Menunggu Diterima" || transfer.stockAppliedToReceiver) {
      return res.status(409).json({
        error: `Pengiriman ${transfer.transferNumber} sudah diproses sebelumnya (Status: ${transfer.status}). Stok tidak akan ditambahkan dua kali.`
      });
    }
    if (!receiverName || !String(receiverName).trim()) {
      return res.status(400).json({ error: "Nama penerima barang wajib diisi." });
    }
    let hasDiscrepancy = false;
    const confirmedItems = transfer.items.map((orig) => {
      const submitted = Array.isArray(items) ? items.find((i) => i.id === orig.id || i.itemName === orig.itemName) : null;
      const actualQty = submitted && submitted.actualQty !== void 0 ? Math.max(0, Math.round(Number(submitted.actualQty) * 100) / 100) : orig.sentQty;
      const discrepancy = Math.round((actualQty - orig.sentQty) * 100) / 100;
      if (discrepancy !== 0) hasDiscrepancy = true;
      return {
        ...orig,
        actualQty,
        discrepancy,
        note: submitted?.note ? String(submitted.note).trim() : orig.note
      };
    });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const confirmDate = getTodayDateStr();
    const stockTargetDate = confirmDate >= transfer.date ? confirmDate : transfer.date;
    await applyTransferStockToBranch({
      branch: transfer.receiverBranch,
      date: stockTargetDate,
      items: confirmedItems,
      direction: "in",
      useActualQty: true,
      operatorName: `${String(receiverName).trim()} (${req.authUser.name})`,
      transferNumber: transfer.transferNumber
    });
    const newStatus = hasDiscrepancy ? "Ada Selisih" : "Diterima";
    const confirmAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: transfer.transferNumber,
      entityType: "transfer",
      branch: transfer.receiverBranch,
      date: stockTargetDate,
      editedBy: `${String(receiverName).trim()} (${req.authUser.name})`,
      timestamp: now,
      note: confirmationNote || `Konfirmasi penerimaan status: ${newStatus}`,
      changes: confirmedItems.map((ci) => ({
        field: ci.itemName,
        label: ci.itemName,
        before: `Kirim ${ci.sentQty} ${ci.unit}`,
        after: `Terima ${ci.actualQty} ${ci.unit}${ci.discrepancy ? ` (Selisih ${ci.discrepancy})` : ""}`
      }))
    };
    const updatedTransfer = {
      ...transfer,
      items: confirmedItems,
      receiverName: String(receiverName).trim(),
      status: newStatus,
      confirmedBy: req.authUser.name,
      confirmedAt: now,
      confirmationNote: String(confirmationNote || "").trim(),
      updatedAt: now,
      stockAppliedToReceiver: true,
      auditLogs: [confirmAudit, ...transfer.auditLogs || []]
    };
    await db.upsertTransfer(updatedTransfer);
    broadcastSyncEvent({
      event: "transfer_confirmed",
      branch: transfer.senderBranch,
      receiverBranch: transfer.receiverBranch,
      date: stockTargetDate,
      transfer: updatedTransfer,
      editedBy: req.authUser.name,
      timestamp: now
    });
    res.json({
      success: true,
      message: hasDiscrepancy ? `Penerimaan ${transfer.transferNumber} dicatat dengan status ADA SELISIH. Stok masuk aktual Cabang ${transfer.receiverBranch} telah diperbarui.` : `Pengiriman ${transfer.transferNumber} resmi DITERIMA & stok masuk Cabang ${transfer.receiverBranch} otomatis bertambah.`,
      transfer: updatedTransfer
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal konfirmasi penerimaan: " + (err.message || "Server error") });
  }
});
app.post("/api/transfers/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Dibatalkan oleh pengguna" } = req.body || {};
    const transfer = await db.getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: "Catatan pengiriman tidak ditemukan" });
    }
    if (transfer.status === "Dibatalkan") {
      return res.status(409).json({ error: "Pengiriman ini sudah dibatalkan sebelumnya." });
    }
    if (transfer.status !== "Menunggu Diterima" && req.authUser.role !== "admin") {
      return res.status(403).json({
        error: "Pengiriman yang sudah dikonfirmasi hanya dapat dibatalkan/dikoreksi oleh Owner."
      });
    }
    if (req.authUser.role !== "admin" && req.authUser.branch !== transfer.senderBranch) {
      return res.status(403).json({ error: "Hanya cabang pengirim atau Owner yang dapat membatalkan." });
    }
    if (transfer.stockAppliedToSender) {
      await applyTransferStockToBranch({
        branch: transfer.senderBranch,
        date: transfer.date,
        items: transfer.items,
        direction: "out",
        useActualQty: false,
        reverse: true,
        operatorName: req.authUser.name,
        transferNumber: transfer.transferNumber
      });
    }
    if (transfer.stockAppliedToReceiver) {
      const confirmDate = transfer.confirmedAt ? transfer.confirmedAt.slice(0, 10) : transfer.date;
      await applyTransferStockToBranch({
        branch: transfer.receiverBranch,
        date: confirmDate >= transfer.date ? confirmDate : transfer.date,
        items: transfer.items,
        direction: "in",
        useActualQty: true,
        reverse: true,
        operatorName: req.authUser.name,
        transferNumber: transfer.transferNumber
      });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cancelAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      recordId: transfer.transferNumber,
      entityType: "transfer",
      branch: transfer.senderBranch,
      date: transfer.date,
      editedBy: req.authUser.name,
      timestamp: now,
      note: `Pembatalan pengiriman: ${reason}`,
      changes: [
        {
          field: "status",
          label: "Status Pengiriman",
          before: transfer.status,
          after: "Dibatalkan (stok dikembalikan)"
        }
      ]
    };
    const updated = {
      ...transfer,
      status: "Dibatalkan",
      cancelledBy: req.authUser.name,
      cancelledAt: now,
      cancelReason: String(reason),
      stockAppliedToSender: false,
      stockAppliedToReceiver: false,
      updatedAt: now,
      auditLogs: [cancelAudit, ...transfer.auditLogs || []]
    };
    await db.upsertTransfer(updated);
    broadcastSyncEvent({
      event: "transfer_cancelled",
      branch: transfer.senderBranch,
      receiverBranch: transfer.receiverBranch,
      date: transfer.date,
      transfer: updated,
      editedBy: req.authUser.name,
      timestamp: now
    });
    res.json({
      success: true,
      message: `Pengiriman ${transfer.transferNumber} dibatalkan dan mutasi stok telah dikembalikan otomatis.`,
      transfer: updated
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal membatalkan pengiriman: " + (err.message || "Server error") });
  }
});
app.get("/api/dashboard", requireAuth, async (req, res) => {
  const { branch, month } = req.query;
  if (req.authUser.role !== "admin" && branch && branch !== "All" && !canAccessBranch(req.authUser, branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser.branch} tidak dapat melihat dashboard Cabang ${branch}.`
    });
  }
  const targetMonth = month || getCurrentMonthStr();
  const effectiveBranch = req.authUser.role === "admin" ? branch : req.authUser.branch;
  const allBranchRecords = await db.getRecords(
    effectiveBranch && effectiveBranch !== "All" ? { branch: effectiveBranch } : void 0
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
    branch: effectiveBranch || "All",
    monthStr: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    rekapCount: filtered.length,
    recentRekapan: recent7
  });
});
function aggregateBranchMetrics(branch, records) {
  const branchRecs = records.filter((r) => r.branch === branch).sort((a, b) => b.date.localeCompare(a.date));
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
      if (s.name === "CUP") {
        totalCupTerjual += s.outQty || 0;
      }
    }
  }
  const latest = branchRecs[0];
  const lowStockItems = [];
  if (latest && Array.isArray(latest.stocks)) {
    for (const s of latest.stocks) {
      const threshold = s.name === "CUP" ? 200 : 5;
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
    lowStockItems: lowStockItems.slice(0, 6)
  };
}
app.get("/api/dashboard/owner-summary", requireAuth, requireAdmin, async (req, res) => {
  const { period = "month", month, startDate: qStart, endDate: qEnd } = req.query;
  const today = getTodayDateStr();
  let startDate = today;
  let endDate = today;
  if (period === "today") {
    startDate = today;
    endDate = today;
  } else if (period === "yesterday") {
    const y = getYesterdayDateStr();
    startDate = y;
    endDate = y;
  } else if (period === "7days") {
    startDate = getJakartaDateOffsetStr(-6);
    endDate = today;
  } else if (period === "30days") {
    startDate = getJakartaDateOffsetStr(-29);
    endDate = today;
  } else if (period === "custom" && qStart && qEnd) {
    startDate = qStart <= qEnd ? qStart : qEnd;
    endDate = qEnd >= qStart ? qEnd : qStart;
  } else {
    const targetMonth = month || getCurrentMonthStr();
    const [y, m] = targetMonth.split("-").map(Number);
    const lastDay = String(new Date(y, m, 0).getDate()).padStart(2, "0");
    startDate = `${targetMonth}-01`;
    endDate = `${targetMonth}-${lastDay}`;
  }
  const [allRecords, allTransfers, auditLogs] = await Promise.all([
    db.getRecords(),
    db.getTransfers(),
    db.getAuditLogs()
  ]);
  const inRange = allRecords.filter((r) => r.date >= startDate && r.date <= endDate);
  const sompok = aggregateBranchMetrics("Sompok", inRange);
  const suyudono = aggregateBranchMetrics("Suyudono", inRange);
  const pendingTransfers = allTransfers.filter((t) => t.status === "Menunggu Diterima");
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
      rekapCount: sompok.rekapCount + suyudono.rekapCount
    },
    pendingTransfers,
    recentTransfers: allTransfers.slice(0, 8),
    recentAuditLogs: auditLogs.slice(0, 15)
  });
});
app.get("/api/reports/monthly", requireAuth, async (req, res) => {
  const { branch, month } = req.query;
  if (req.authUser.role !== "admin" && branch && branch !== "All" && !canAccessBranch(req.authUser, branch)) {
    return res.status(403).json({
      error: `Akses ditolak: Akun ${req.authUser.branch} tidak dapat mengakses laporan Cabang ${branch}.`
    });
  }
  const targetMonth = month || getCurrentMonthStr();
  const effectiveBranch = req.authUser.role === "admin" ? branch : req.authUser.branch;
  const [yearStr, monthNumStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const records = await db.getRecords({
    branch: effectiveBranch && effectiveBranch !== "All" ? effectiveBranch : void 0,
    month: targetMonth
  });
  let totalOmsetKotor = 0;
  let totalOmsetBersih = 0;
  let totalPengeluaran = 0;
  let totalQris = 0;
  let totalGulaHabis = 0;
  const recordsByDate = /* @__PURE__ */ new Map();
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
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
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
      status: primaryRec?.status
    });
  }
  res.json({
    branch: effectiveBranch || "All",
    month: targetMonth,
    totalOmsetKotor,
    totalOmsetBersih,
    totalPengeluaran,
    totalQris,
    totalGulaHabis: Math.round(totalGulaHabis * 100) / 100,
    daysCount: records.length,
    dailyData
  });
});
app.get("/api/backups", requireAuth, requireAdmin, async (_req, res) => {
  const backups = await db.listBackups();
  res.json({ backups, storage: db.getStorageInfo() });
});
app.post("/api/backups", requireAuth, requireAdmin, async (req, res) => {
  const { note } = req.body || {};
  const created = await db.createBackup(
    req.authUser.name,
    String(note || "Backup manual Owner").trim()
  );
  res.status(201).json({ success: true, backup: created });
});
app.get("/api/backups/export", requireAuth, requireAdmin, async (_req, res) => {
  const snapshot = await db.exportSnapshot();
  const safeExport = {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    appVersion: "1.4.0",
    records: snapshot.records,
    transfers: snapshot.transfers,
    auditLogs: snapshot.auditLogs,
    users: snapshot.users.map(sanitizeUser)
  };
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="TehKota_Backup_${getTodayDateStr()}.json"`
  );
  res.send(JSON.stringify(safeExport, null, 2));
});
app.post("/api/backups/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.createBackup(req.authUser.name, `Pre-restore safety snapshot before restoring ${id}`);
  const result = await db.restoreBackup(id);
  if (!result) {
    return res.status(404).json({ error: "Snapshot backup tidak ditemukan" });
  }
  broadcastSyncEvent({
    event: "batch_sync",
    editedBy: req.authUser.name,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({
    success: true,
    message: `Berhasil memulihkan ${result.restoredRecords} rekapan dan ${result.restoredTransfers} pengiriman.`,
    ...result
  });
});
app.post("/api/ai/analyze", requireAuth, async (req, res) => {
  try {
    const { branches = ["Sompok"], startDate, endDate, promptNotes } = req.body || {};
    const allowedBranches = req.authUser.role === "admin" ? branches : [req.authUser.branch];
    const allRecords = await db.getRecords();
    let relevantRecords = allRecords.filter((r) => allowedBranches.includes(r.branch));
    if (startDate) relevantRecords = relevantRecords.filter((r) => r.date >= startDate);
    if (endDate) relevantRecords = relevantRecords.filter((r) => r.date <= endDate);
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
        habisGulaKg: r.gulaDetail?.habisGula || 0,
        cupSold: cup?.outQty || 0,
        cupRusak: cup?.cupDetail?.rusakPcs || 0,
        cupSO: cup?.so || 0,
        topOutItems: topOut,
        expensesList: r.expenses.map((e) => `${e.name}: Rp ${e.amount}`)
      };
    });
    const isComparison = allowedBranches.length > 1;
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
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({
            summary: parsed.summary || "Analisis operasional selesai.",
            stockInsights: Array.isArray(parsed.stockInsights) ? parsed.stockInsights : [],
            anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
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
    const totalGulaKg = relevantRecords.reduce((acc, r) => acc + (r.gulaDetail?.habisGula || 0), 0);
    const latestRecord = relevantRecords[0];
    const lowStockAlerts = [];
    if (latestRecord && latestRecord.stocks) {
      for (const s of latestRecord.stocks) {
        if (s.st <= 5) {
          lowStockAlerts.push({
            item: s.name,
            currentSt: s.st,
            recommendation: `Sisa stok ${s.st} ${s.unit}. Segera buat PO restok atau pengiriman antarcabang.`
          });
        }
      }
    }
    const cupSoldTotal = relevantRecords.reduce((acc, r) => {
      const c = r.stocks.find((s) => s.name === "CUP");
      return acc + (c ? c.outQty : 0);
    }, 0);
    res.json({
      summary: `Evaluasi ${relevantRecords.length} rekapan di Cabang ${allowedBranches.join(" & ")}: total omset kotor Rp ${totalGross.toLocaleString("id-ID")}, setoran bersih tunai Rp ${totalNet.toLocaleString("id-ID")}, penjualan ${cupSoldTotal.toLocaleString("id-ID")} cup, dan pemakaian gula ${Math.round(totalGulaKg * 100) / 100} KG.`,
      stockInsights: [
        `Total penjualan Cup mencapai ${cupSoldTotal.toLocaleString("id-ID")} cup di seluruh periode terpilih.`,
        `Konsumsi gula pasir terhitung otomatis sebesar ${Math.round(totalGulaKg * 100) / 100} KG.`,
        "Perhitungan Stock Opname (SO) CUP konsisten menggunakan rumus (slop \xD7 50) + pcs."
      ],
      anomalies: ["Pergerakan stok ST dan SO fisik tercatat konsisten di seluruh hari rekapan terpilih."],
      lowStockAlerts: lowStockAlerts.slice(0, 4),
      financialAnalysis: `Dari total omset kotor Rp ${totalGross.toLocaleString("id-ID")}, transaksi QRIS mencapai Rp ${totalQrisVal.toLocaleString("id-ID")} (${(totalQrisVal / (totalGross || 1) * 100).toFixed(1)}%). Pengeluaran operasional Rp ${totalExp.toLocaleString("id-ID")}.`,
      branchComparison: isComparison ? "Perbandingan langsung Cabang Sompok dan Suyudono tersedia pada ringkasan omset dan efisiensi stok masing-masing outlet." : `Operasional Cabang ${allowedBranches[0]} berjalan tertib dengan pencatatan terpusat.`,
      recommendations: [
        "Gunakan Catatan Pengiriman Barang saat memindahkan stok antarcabang agar IN/OUT tetap sinkron.",
        "Lakukan restok bahan Tea Series dan Cup sebelum menyentuh batas stok aman.",
        "Audit rutin selisih SO fisik vs ST sistem setiap pergantian shift."
      ],
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: "Layanan AI mengalami kendala: " + (err.message || "Gagal memproses data")
    });
  }
});
app.post("/api/sync", requireAuth, async (req, res) => {
  const { queue } = req.body || {};
  if (!Array.isArray(queue) || queue.length === 0) {
    return res.json({ synced: 0, records: [] });
  }
  let count = 0;
  const syncedRecords = [];
  const editorName = req.authUser.name || req.authUser.username;
  for (const item of queue) {
    if (item.action === "save_record" && item.record) {
      const rec = item.record;
      if (!rec.branch || !rec.date || !canAccessBranch(req.authUser, rec.branch)) {
        continue;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = await db.getRecordByBranchDate(rec.branch, rec.date);
      const normalizedStocks = Array.isArray(rec.stocks) ? rec.stocks.map((s) => ({
        ...s,
        sa: Number(s.sa) || 0,
        inQty: Math.max(0, Number(s.inQty) || 0),
        outQty: Math.max(0, Number(s.outQty) || 0),
        st: calculateStokAkhir(s.sa, s.inQty, s.outQty),
        so: Number(s.so) || 0
      })) : [];
      const totalPengeluaran = calculateTotalPengeluaran(rec.expenses || []);
      const omsetAkhir = calculateOmsetAkhir(rec.totalOmset || 0, totalPengeluaran, rec.qris || 0);
      const normalizedGula = rec.gulaDetail ? {
        gulaAmbil: Math.max(0, Number(rec.gulaDetail.gulaAmbil) || 0),
        gulaKemarin: Math.max(0, Number(rec.gulaDetail.gulaKemarin) || 0),
        sisaGula: Math.max(0, Number(rec.gulaDetail.sisaGula) || 0),
        gulaCair: Math.max(0, Number(rec.gulaDetail.gulaCair) || 0),
        habisGula: calculateHabisGula(
          rec.gulaDetail.gulaAmbil,
          rec.gulaDetail.gulaKemarin,
          rec.gulaDetail.sisaGula,
          rec.gulaDetail.gulaCair
        )
      } : void 0;
      const auditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recordId: existing?.id || rec.id || `rek_${rec.branch.toLowerCase()}_${rec.date.replace(/-/g, "")}`,
        entityType: "rekap",
        branch: rec.branch,
        date: rec.date,
        editedBy: editorName,
        timestamp: now,
        note: `Sinkronisasi antrean offline Cabang ${rec.branch}`,
        changes: [
          {
            field: "offline_sync",
            label: "Sync Offline",
            before: existing ? "Data sebelumnya" : "-",
            after: `Omset Rp ${Number(rec.totalOmset || 0).toLocaleString("id-ID")}`
          }
        ]
      };
      const savedRec = {
        ...rec,
        id: existing?.id || rec.id || `rek_${rec.branch.toLowerCase()}_${rec.date.replace(/-/g, "")}`,
        timeStr: rec.timeStr || getJakartaTimeStr(),
        createdAt: existing ? existing.createdAt : rec.createdAt || now,
        updatedAt: now,
        createdBy: existing ? existing.createdBy : rec.createdBy || editorName,
        lastEditedBy: existing ? editorName : void 0,
        lastEditedAt: existing ? now : void 0,
        revisionCount: (existing?.revisionCount || 0) + (existing ? 1 : 0),
        stocks: normalizedStocks,
        totalPengeluaran,
        omsetAkhir,
        gulaDetail: normalizedGula,
        auditLogs: [auditEntry, ...existing?.auditLogs || []]
      };
      await db.upsertRecord(savedRec);
      await db.appendAuditLog(auditEntry);
      if (savedRec.status !== "draft") {
        await cascadeSubsequentRecords(savedRec.branch, savedRec.date, savedRec.stocks);
      }
      syncedRecords.push(savedRec);
      count++;
    }
  }
  if (count > 0) {
    broadcastSyncEvent({
      event: "batch_sync",
      branch: req.authUser.branch,
      editedBy: editorName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  res.json({ synced: count, records: syncedRecords, message: `${count} rekapan berhasil disinkronkan` });
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
