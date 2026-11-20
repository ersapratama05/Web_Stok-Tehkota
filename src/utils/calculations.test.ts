import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStokAkhir,
  calculateCupSO,
  calculateGulaKemarinCarryover,
  calculateHabisGula,
  calculateProductEceranPcsSO,
  calculateTotalPengeluaran,
  calculateOmsetAkhir,
  calculateOmsetKotor,
  calculateStokSelisih,
  formatNumberId,
  hasMeaningfulDraftContent,
  isProductSoCalculatorItem,
  normalizeSoValue,
  parseRupiahInput,
  reconcileStockRowsWithCarryover,
  resolvePreviousGulaCarryover,
  SO_CALCULATOR_PRODUCTS,
} from './calculations';
import { createInitialStockRows } from './itemsList';

test('Rumus ST = SA + IN - OUT', () => {
  // SA: 100, IN: 50, OUT: 30 -> ST: 120
  assert.equal(calculateStokAkhir(100, 50, 30), 120);

  // SA: 0, IN: 200, OUT: 150 -> ST: 50
  assert.equal(calculateStokAkhir(0, 200, 150), 50);

  // Negative or edge cases
  assert.equal(calculateStokAkhir(50, 0, 10), 40);
  assert.equal(calculateStokAkhir(10, 0, 10), 0);
});

test('Rumus SO CUP: 1 slop = 50 pcs', () => {
  // 5 slop + 12 pcs = 5 * 50 + 12 = 262 pcs
  assert.equal(calculateCupSO(5, 12), 262);

  // 10 slop + 0 pcs = 500 pcs
  assert.equal(calculateCupSO(10, 0), 500);

  // 0 slop + 37 pcs = 37 pcs
  assert.equal(calculateCupSO(0, 37), 37);
});

test('Kalkulator SO Produk (LEMON, LECI, PASSION, MELON, APEL, MANGGA, GRAPE): Jumlah Eceran + Jumlah PCS', () => {
  assert.deepEqual(
    [...SO_CALCULATOR_PRODUCTS],
    ['LEMON', 'LECI', 'PASSION', 'MELON', 'APEL', 'MANGGA', 'GRAPE']
  );

  // Contoh wajib: Jumlah Eceran = 5, Jumlah PCS = 10 -> Total SO = 15
  assert.equal(calculateProductEceranPcsSO(5, 10), 15);
  assert.equal(calculateProductEceranPcsSO(0, 0), 0);
  assert.equal(calculateProductEceranPcsSO(3, 0), 3);
  assert.equal(calculateProductEceranPcsSO(0, 12), 12);

  // Pastikan hanya 7 produk target yang aktif, produk lain di luar daftar tidak terpengaruh
  for (const name of SO_CALCULATOR_PRODUCTS) {
    assert.equal(isProductSoCalculatorItem(name), true);
  }
  assert.equal(isProductSoCalculatorItem('CUP'), false);
  assert.equal(isProductSoCalculatorItem('Yoghurt Lemon'), false);
  assert.equal(isProductSoCalculatorItem('Yoghurt Leci'), false);
  assert.equal(isProductSoCalculatorItem('Thai Tea'), false);
  assert.equal(isProductSoCalculatorItem('GULA PASIR'), false);

  // Pastikan baris awal baru untuk ke-7 produk memiliki so: null dan soDetail: undefined
  const freshRows = createInitialStockRows({ LEMON: 20, LECI: 30, PASSION: 10 });
  for (const name of SO_CALCULATOR_PRODUCTS) {
    const row = freshRows.find((r) => r.name === name);
    assert.ok(row, `Produk ${name} harus ada di daftar stok`);
    assert.equal(row?.so, null);
    assert.equal(row?.soDetail, undefined);
  }
});

test('Rumus Habis Gula = (Ambil + Kemarin) - Sisa Gula - Gula Cair', () => {
  // Ambil: 10, Kemarin: 5, Sisa: 3, Cair: 2 -> (10 + 5) - 3 - 2 = 10
  assert.equal(calculateHabisGula(10, 5, 3, 2), 10);

  // Ambil: 20, Kemarin: 0, Sisa: 5, Cair: 3 -> (20 + 0) - 5 - 3 = 12
  assert.equal(calculateHabisGula(20, 0, 5, 3), 12);

  // Decimal case: Ambil 12.5, Kemarin 2.5, Sisa 4, Cair 1 -> (15) - 5 = 10
  assert.equal(calculateHabisGula(12.5, 2.5, 4, 1), 10);

  // Zero / empty inputs
  assert.equal(calculateHabisGula(0, 0, 0, 0), 0);
  assert.equal(calculateHabisGula(null, undefined, '', 0), 0);
});

test('Total Pengeluaran otomatis dari seluruh baris', () => {
  const expenses = [
    { id: '1', name: 'Es Batu Kristal', amount: 35000 },
    { id: '2', name: 'Kresek Sampah', amount: 15000 },
    { id: '3', name: 'Air Galon', amount: 18000 },
  ];
  assert.equal(calculateTotalPengeluaran(expenses), 68000);

  // Empty list returns 0
  assert.equal(calculateTotalPengeluaran([]), 0);
});

test('Rumus OMSET AKHIR = TOTAL OMSET - TOTAL PENGELUARAN - QRIS', () => {
  const totalOmset = 1500000;
  const totalPengeluaran = 68000;
  const qris = 432000;
  // 1500000 - 68000 - 432000 = 1000000
  assert.equal(calculateOmsetAkhir(totalOmset, totalPengeluaran, qris), 1000000);

  // Zero values
  assert.equal(calculateOmsetAkhir(500000, 0, 0), 500000);
});

test('Rumus OMZET KOTOR = PENGELUARAN + QRIS + OMZET BERSIH (tanpa penghitungan ganda)', () => {
  // Contoh 1 (data riil): Pengeluaran 60.000, QRIS 780.000, Omzet Bersih 1.080.000 -> Omzet Kotor 1.920.000
  assert.equal(calculateOmsetKotor(60000, 780000, 1080000), 1920000);

  // Contoh 2 (Sompok): Pengeluaran 150.000, QRIS 450.000, Omzet Bersih 900.000 -> Omzet Kotor 1.500.000
  const expenses = [
    { id: 'e1', name: 'Es Batu', amount: 100000 },
    { id: 'e2', name: 'Galon', amount: 50000 },
  ];
  const pengeluaran = calculateTotalPengeluaran(expenses);
  assert.equal(pengeluaran, 150000);
  assert.equal(calculateOmsetKotor(pengeluaran, 450000, 900000), 1500000);

  // Contoh 3 (Suyudono): Pengeluaran 75.000, QRIS 325.000, Omzet Bersih 600.000 -> Omzet Kotor 1.000.000
  assert.equal(calculateOmsetKotor(75000, 325000, 600000), 1000000);

  // Zero & empty cases
  assert.equal(calculateOmsetKotor(0, 0, 0), 0);
  assert.equal(calculateOmsetKotor(50000, 0, 500000), 550000);
});

test('Selisih Stok SO - ST (SO kosong tidak dianggap 0)', () => {
  // ST Buku = 120, Fisik SO = 118 -> -2 (hilang 2)
  assert.equal(calculateStokSelisih(120, 118), -2);

  // ST Buku = 50, Fisik SO = 55 -> +5 (lebih 5)
  assert.equal(calculateStokSelisih(50, 55), 5);

  // SO masih kosong (null/undefined/'') -> selisih wajib null, BUKAN 0 - ST
  assert.equal(calculateStokSelisih(120, null), null);
  assert.equal(calculateStokSelisih(120, undefined), null);
  assert.equal(calculateStokSelisih(120, ''), null);

  // Jika kasir benar-benar mengisi angka 0 saat stok fisik habis -> selisih = -120
  assert.equal(calculateStokSelisih(120, 0), -120);
  assert.equal(normalizeSoValue(''), null);
  assert.equal(normalizeSoValue(null), null);
  assert.equal(normalizeSoValue(0), 0);
  assert.equal(normalizeSoValue('25'), 25);
});

test('createInitialStockRows tidak menyalin SO hari sebelumnya (SO wajib null & CUP cupDetail kosong)', () => {
  const prevStMap = {
    CUP: 175,
    LECI: 25,
    'GULA PASIR': 12,
  };
  const fresh = createInitialStockRows(prevStMap);
  const cup = fresh.find((r) => r.name === 'CUP');
  const leci = fresh.find((r) => r.name === 'LECI');
  const gula = fresh.find((r) => r.name === 'GULA PASIR');

  // SA dan ST awal tetap mengambil ST hari sebelumnya
  assert.equal(cup?.sa, 175);
  assert.equal(cup?.st, 175);
  // SO dan cupDetail wajib kosong (tidak menyalin SO kemarin / SA)
  assert.equal(cup?.so, null);
  assert.equal(cup?.cupDetail, undefined);

  assert.equal(leci?.sa, 25);
  assert.equal(leci?.st, 25);
  assert.equal(leci?.so, null);

  assert.equal(gula?.sa, 12);
  assert.equal(gula?.st, 12);
  assert.equal(gula?.so, null);
});

test('Parsing dan format Rupiah dengan pemisah ribuan titik', () => {
  // Format pemisah titik
  assert.equal(formatNumberId(10000), '10.000');
  assert.equal(formatNumberId(1000000), '1.000.000');
  assert.equal(formatNumberId(50000), '50.000');
  assert.equal(formatNumberId(0), '0');

  // Parse input dengan atau tanpa titik
  assert.equal(parseRupiahInput('Rp 1.500.000'), 1500000);
  assert.equal(parseRupiahInput('75.000'), 75000);
  assert.equal(parseRupiahInput('10000'), 10000);
  assert.equal(parseRupiahInput('10.0000'), 100000);
  assert.equal(parseRupiahInput(''), 0);
});

test('Perpindahan stok gula harian: 16 Nov -> 17 Nov -> 18 Nov (Gula Kemarin = Sisa Fisik + Gula Cair)', () => {
  // Kasus contoh wajib: 16 Nov -> Ambil 10, Kemarin 12, Sisa Fisik 6, Gula Cair 2
  const nov16Habis = calculateHabisGula(10, 12, 6, 2);
  assert.equal(nov16Habis, 14);

  const records = [
    {
      branch: 'Sompok',
      date: '2026-11-16',
      status: 'saved',
      gulaDetail: {
        gulaAmbil: 10,
        gulaKemarin: 12,
        sisaGula: 6,
        gulaCair: 2,
        habisGula: nov16Habis,
      },
    },
  ];

  // Buat rekapan 17 Nov -> Gula Kemarin wajib 6 + 2 = 8 KG
  const carry17 = resolvePreviousGulaCarryover(records, 'Sompok', '2026-11-17');
  assert.equal(carry17.hasPreviousRecord, true);
  assert.equal(carry17.hasPreviousGula, true);
  assert.equal(carry17.isIncomplete, false);
  assert.equal(carry17.previousDate, '2026-11-16');
  assert.equal(carry17.gulaKemarin, 8);

  // Simpan rekapan 17 Nov (misal Ambil 4, Kemarin 8, Sisa Fisik 5, Gula Cair 1 -> Habis 6)
  const nov17Habis = calculateHabisGula(4, carry17.gulaKemarin, 5, 1);
  assert.equal(nov17Habis, 6);
  records.push({
    branch: 'Sompok',
    date: '2026-11-17',
    status: 'saved',
    gulaDetail: {
      gulaAmbil: 4,
      gulaKemarin: carry17.gulaKemarin,
      sisaGula: 5,
      gulaCair: 1,
      habisGula: nov17Habis,
    },
  });

  // Buat rekapan 18 Nov -> Gula Kemarin wajib 5 + 1 = 6 KG
  const carry18 = resolvePreviousGulaCarryover(records, 'Sompok', '2026-11-18');
  assert.equal(carry18.hasPreviousGula, true);
  assert.equal(carry18.previousDate, '2026-11-17');
  assert.equal(carry18.gulaKemarin, 6);

  // Pastikan rekapan tanggal sebelumnya (16 Nov) tidak berubah
  assert.deepEqual(records[0].gulaDetail, {
    gulaAmbil: 10,
    gulaKemarin: 12,
    sisaGula: 6,
    gulaCair: 2,
    habisGula: 14,
  });

  // Kasus desimal: Sisa 3.5 + Cair 1.25 = 4.75
  assert.equal(calculateGulaKemarinCarryover(3.5, 1.25), 4.75);
});

test('Pemisahan outlet (Sompok vs Suyudono), pemisahan tanggal, dan penanganan rekapan sebelumnya kosong/belum lengkap', () => {
  const multiBranchRecords = [
    {
      branch: 'Sompok',
      date: '2026-11-16',
      status: 'saved',
      gulaDetail: { gulaAmbil: 10, gulaKemarin: 12, sisaGula: 6, gulaCair: 2, habisGula: 14 },
    },
    {
      branch: 'Suyudono',
      date: '2026-11-16',
      status: 'saved',
      gulaDetail: { gulaAmbil: 8, gulaKemarin: 5, sisaGula: 3, gulaCair: 1, habisGula: 9 },
    },
    {
      branch: 'Sompok',
      date: '2026-11-20',
      status: 'saved',
      gulaDetail: { gulaAmbil: 5, gulaKemarin: 2, sisaGula: 4, gulaCair: 3, habisGula: 0 },
    },
  ];

  // Suyudono 17 Nov hanya mengambil Suyudono 16 Nov (3 + 1 = 4), bukan Sompok (8)
  const suyudono17 = resolvePreviousGulaCarryover(multiBranchRecords, 'Suyudono', '2026-11-17');
  assert.equal(suyudono17.gulaKemarin, 4);
  assert.equal(suyudono17.previousDate, '2026-11-16');

  // Sompok 17 Nov tidak boleh mengambil data masa depan (20 Nov)
  const sompok17 = resolvePreviousGulaCarryover(multiBranchRecords, 'Sompok', '2026-11-17');
  assert.equal(sompok17.gulaKemarin, 8);
  assert.equal(sompok17.previousDate, '2026-11-16');

  // Tanggal sebelum rekapan pertama Suyudono tidak mengarang nilai atau mengambil dari Sompok
  const suyudonoNoPrev = resolvePreviousGulaCarryover(multiBranchRecords, 'Suyudono', '2026-11-16');
  assert.equal(suyudonoNoPrev.hasPreviousRecord, false);
  assert.equal(suyudonoNoPrev.hasPreviousGula, false);
  assert.equal(suyudonoNoPrev.isIncomplete, false);
  assert.equal(suyudonoNoPrev.gulaKemarin, 0);

  // Rekapan sebelumnya belum lengkap (gulaDetail null/undefined)
  const incompleteMissingDetail = resolvePreviousGulaCarryover(
    [{ branch: 'Suyudono', date: '2026-11-29', status: 'saved', gulaDetail: undefined }],
    'Suyudono',
    '2026-11-30'
  );
  assert.equal(incompleteMissingDetail.hasPreviousRecord, true);
  assert.equal(incompleteMissingDetail.hasPreviousGula, false);
  assert.equal(incompleteMissingDetail.isIncomplete, true);
  assert.equal(incompleteMissingDetail.gulaKemarin, 0);

  // Rekapan sebelumnya masih draft
  const draftPrior = resolvePreviousGulaCarryover(
    [
      {
        branch: 'Sompok',
        date: '2026-11-16',
        status: 'draft',
        gulaDetail: { gulaAmbil: 0, gulaKemarin: 0, sisaGula: 6, gulaCair: 2, habisGula: 0 },
      },
    ],
    'Sompok',
    '2026-11-17'
  );
  assert.equal(draftPrior.hasPreviousRecord, true);
  assert.equal(draftPrior.hasPreviousGula, false);
  assert.equal(draftPrior.isIncomplete, true);
  assert.equal(draftPrior.gulaKemarin, 0);

  // Rekapan sebelumnya field gulaCair kosong/undefined -> tidak dianggap terkonfirmasi
  const partialGula = resolvePreviousGulaCarryover(
    [
      {
        branch: 'Sompok',
        date: '2026-11-16',
        status: 'saved',
        gulaDetail: { gulaAmbil: 10, gulaKemarin: 12, sisaGula: 6, gulaCair: undefined as any },
      },
    ],
    'Sompok',
    '2026-11-17'
  );
  assert.equal(partialGula.hasPreviousRecord, true);
  assert.equal(partialGula.hasPreviousGula, false);
  assert.equal(partialGula.isIncomplete, true);
  assert.equal(partialGula.gulaKemarin, 0);
});

test('Rekonsiliasi draf lokal SA & ST terhadap carryover server (kasus 19 Nov DRAFT -> disimpan 20 Nov)', () => {
  // Simulasi draf lokal kasir 20 Nov yang terlanjur terbentuk saat 19 Nov masih DRAFT/belum final (SA lama 0)
  const staleDraftRows = createInitialStockRows({ CUP: 0, LEMON: 0 });
  const draftCup = staleDraftRows.find((r) => r.name === 'CUP')!;
  draftCup.inQty = 100;
  draftCup.outQty = 40;
  draftCup.st = calculateStokAkhir(draftCup.sa, draftCup.inQty, draftCup.outQty); // 0 + 100 - 40 = 60

  const draftLemon = staleDraftRows.find((r) => r.name === 'LEMON')!;
  draftLemon.inQty = 5;
  draftLemon.outQty = 2;
  draftLemon.so = 13;
  draftLemon.soDetail = { eceran: 3, pcs: 10, calculatedSo: 13 };
  draftLemon.st = calculateStokAkhir(draftLemon.sa, draftLemon.inQty, draftLemon.outQty);

  // Setelah rekapan 19 Nov Sompok disimpan final -> server mengembalikan ST 19 Nov: CUP = 250, LEMON = 20
  const serverCarryover = { CUP: 250, LEMON: 20 };
  const baseRows = createInitialStockRows(serverCarryover);
  const reconciled = reconcileStockRowsWithCarryover(staleDraftRows, serverCarryover, baseRows);

  assert.equal(reconciled.changed, true);
  const resCup = reconciled.stocks.find((r) => r.name === 'CUP')!;
  const resLemon = reconciled.stocks.find((r) => r.name === 'LEMON')!;
  const resLeci = reconciled.stocks.find((r) => r.name === 'LECI')!;

  // SA wajib ikut ST 19 Nov dari server, ST wajib SA + IN - OUT, input kasir & SO tetap aman
  assert.equal(resCup.sa, 250);
  assert.equal(resCup.inQty, 100);
  assert.equal(resCup.outQty, 40);
  assert.equal(resCup.st, 310); // 250 + 100 - 40
  assert.equal(resCup.so, null); // SO kosong tetap kosong

  assert.equal(resLemon.sa, 20);
  assert.equal(resLemon.inQty, 5);
  assert.equal(resLemon.outQty, 2);
  assert.equal(resLemon.st, 23); // 20 + 5 - 2
  assert.equal(resLemon.so, 13);
  assert.deepEqual(resLemon.soDetail, { eceran: 3, pcs: 10, calculatedSo: 13 });

  assert.equal(resLeci.sa, 0);
  assert.equal(resLeci.st, 0);
  assert.equal(resLeci.so, null);

  // Rekonsiliasi ulang dengan nilai sama -> changed = false
  const secondPass = reconcileStockRowsWithCarryover(reconciled.stocks, serverCarryover, baseRows);
  assert.equal(secondPass.changed, false);
});

test('hasMeaningfulDraftContent membedakan draf kosong (phantom draft) vs draf dengan input kasir', () => {
  const emptyStocks = createInitialStockRows({ CUP: 150 });
  assert.equal(
    hasMeaningfulDraftContent({
      branch: 'Sompok',
      date: '2026-11-20',
      stocks: emptyStocks,
      expenses: [],
      omsetAkhir: 0,
      qris: 0,
      notes: '   ',
      gulaDetail: { gulaAmbil: 0, gulaKemarin: 5, sisaGula: 0, gulaCair: 0, habisGula: 5 },
    }),
    false
  );

  assert.equal(
    hasMeaningfulDraftContent({
      stocks: emptyStocks,
      notes: 'Grab: 2 pesanan',
    }),
    true
  );

  const stocksWithZeroSo = createInitialStockRows({ CUP: 150 });
  stocksWithZeroSo[0].so = 0;
  assert.equal(hasMeaningfulDraftContent({ stocks: stocksWithZeroSo }), true);
});

