import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecordCsvContent,
  exportRecordToCsv,
  exportRecordToImage,
  exportRecordToPdf,
  renderRecordCanvas,
  wrapTextLines,
} from './exportUtils';
import { RekapRecord } from '../types';

function makeSampleRecord(overrides: Partial<RekapRecord> = {}): RekapRecord {
  return {
    id: 'rek_sompok_20260401',
    branch: 'Sompok',
    date: '2026-04-01',
    timeStr: '21:15',
    createdAt: '2026-04-01T14:15:00.000Z',
    updatedAt: '2026-04-01T14:15:00.000Z',
    createdBy: 'Kasir Sompok',
    status: 'saved',
    stocks: [
      { category: 'Perlengkapan / Bahan Pokok', name: 'CUP', unit: 'pcs', inQty: 50, outQty: 20, sa: 100, st: 130, so: 130 },
      { category: 'Tea Series', name: 'ORI', unit: 'pcs', inQty: 0, outQty: 10, sa: 30, st: 20, so: 20 },
      { category: 'Yoghurt Series', name: 'LECI', unit: 'pcs', inQty: 0, outQty: 2, sa: 10, st: 8, so: 8 },
      { category: 'Choco Series', name: 'MILO', unit: 'pcs', inQty: 0, outQty: 3, sa: 15, st: 12, so: 12 },
      { category: 'Coffee Series', name: 'CAPPUCINO', unit: 'pcs', inQty: 0, outQty: 1, sa: 8, st: 7, so: 7 },
    ],
    expenses: [{ id: 'e1', name: 'Es Batu Kristal', amount: 60000 }],
    totalOmset: 1920000,
    totalPengeluaran: 60000,
    qris: 780000,
    omsetAkhir: 1080000,
    gulaDetail: {
      gulaAmbil: 5,
      gulaKemarin: 3,
      sisaGula: 2,
      gulaCair: 1,
      habisGula: 5,
    },
    catatanGrab: 'Grab 2 pesanan, ShopeeFood 1 pesanan.',
    catatanBarang: 'Cup kurang 2 slop, gula 1 karung, plastik belum datang.',
    notes: 'Mesin sealer kondisi normal.',
    ...overrides,
  };
}

test('wrapTextLines memproses catatan kosong, multibaris, dan teks panjang tanpa terpotong', () => {
  assert.deepEqual(wrapTextLines('', 100, (s) => s.length * 6), ['-']);
  assert.deepEqual(wrapTextLines('   \n  ', 100, (s) => s.length * 6), ['-']);

  const sample = 'Grab: 2 pesanan, ShopeeFood: 1 pesanan';
  const shortWrapped = wrapTextLines(sample, 540, (s) => s.length * 6);
  assert.equal(shortWrapped.join(' '), sample);

  const longNote =
    'Grab: 12 pesanan (Es Teh Manis Jumbo 8, Thai Tea 4), ShopeeFood: 9 pesanan (Green Tea 5, Choco Milo 4), GoFood: 5 pesanan.\n' +
    'Catatan tambahan: Mesin sealer sudah dibersihkan, cup stok aman, dan seluruh transaksi QRIS sudah dicocokkan dengan mutasi outlet pada shift malam.';
  const wrapped = wrapTextLines(longNote, 240, (s) => s.length * 6);
  assert.ok(wrapped.length >= 4, 'Teks panjang harus terbungkus menjadi beberapa baris');
  for (const line of wrapped) {
    assert.ok(line.length * 6 <= 240, `Lebar baris melebihi batas: "${line}"`);
  }
  const reconstructed = wrapped.join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(reconstructed, longNote.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());

  // Kata tanpa spasi melebihi lebar
  const unbroken = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const splitUnbroken = wrapTextLines(unbroken, 60, (s) => s.length * 6);
  assert.equal(splitUnbroken.join(''), unbroken);
});

test('buildRecordCsvContent menyertakan CATATAN GO FOOD, CATATAN BARANG, serta catatan lama lengkap dan menjaga rumus omzet kotor', () => {
  const sampleRecord = makeSampleRecord();
  const csv = buildRecordCsvContent(sampleRecord);

  assert.ok(csv.includes('CABANG SOMPOK'));
  assert.ok(csv.includes('Tanggal;2026-04-01'));
  assert.ok(csv.includes('Total Omset (Kotor);Rp 1920000'));
  assert.ok(csv.includes('CATATAN TAMBAHAN KASIR / OUTLET'));
  assert.ok(csv.includes('CATATAN GO FOOD;"Grab 2 pesanan, ShopeeFood 1 pesanan."'));
  assert.ok(csv.includes('CATATAN BARANG;"Cup kurang 2 slop, gula 1 karung, plastik belum datang."'));
  assert.ok(csv.includes('Catatan;"Mesin sealer kondisi normal."'));

  // Catatan kosong -> '-'
  const emptyNotesCsv = buildRecordCsvContent(
    makeSampleRecord({ catatanGrab: '  ', catatanBarang: '', notes: '   ' })
  );
  assert.ok(emptyNotesCsv.includes('CATATAN GO FOOD;"-"'));
  assert.ok(emptyNotesCsv.includes('CATATAN BARANG;"-"'));
  assert.ok(emptyNotesCsv.includes('Catatan;"-"'));

  // Catatan panjang + tanda kutip + titik koma tidak terpotong & ter-escape aman
  const complexLongNote =
    'Grab: 2 pesanan ("Es Teh Ori"); ShopeeFood: 1 pesanan\nShift 2: tutup lebih awal karena hujan.';
  const complexCsv = buildRecordCsvContent(
    makeSampleRecord({
      catatanGrab: complexLongNote,
      catatanBarang: 'Gula 1 karung ("Kemasan Baru"); plastik 15 kurang 3 pack',
      notes: 'Catatan lama tetap aman',
    })
  );
  assert.ok(
    complexCsv.includes(
      'CATATAN GO FOOD;"Grab: 2 pesanan (""Es Teh Ori""); ShopeeFood: 1 pesanan\r\nShift 2: tutup lebih awal karena hujan."'
    ) ||
      complexCsv.includes(
        'CATATAN GO FOOD;"Grab: 2 pesanan (""Es Teh Ori""); ShopeeFood: 1 pesanan\nShift 2: tutup lebih awal karena hujan."'
      )
  );
  assert.ok(
    complexCsv.includes('CATATAN BARANG;"Gula 1 karung (""Kemasan Baru""); plastik 15 kurang 3 pack"')
  );
  assert.ok(complexCsv.includes('Catatan;"Catatan lama tetap aman"'));
});

// 1x1 valid PNG & JPEG data URLs so jsPDF can embed image bytes cleanly during headless Node verification
const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('Export CSV, PDF, PNG, dan JPG merender catatan kasir lengkap sesuai outlet & tanggal tanpa terpotong', async () => {
  const drawnTexts: string[] = [];
  const drawnPlacements: Array<{ text: string; x: number; y: number }> = [];
  const downloads: { filename: string; href: string }[] = [];
  const createdCanvases: { width: number; height: number }[] = [];

  const origDocument = (globalThis as any).document;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  (globalThis as any).document = {
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const ctx = {
          font: '11px sans-serif',
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          textAlign: 'left',
          save: () => {},
          restore: () => {},
          scale: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          clip: () => {},
          closePath: () => {},
          quadraticCurveTo: () => {},
          fill: () => {},
          stroke: () => {},
          fillRect: () => {},
          strokeRect: () => {},
          drawImage: () => {},
          measureText: (txt: string) => ({ width: txt.length * 6 }),
          fillText: (txt: string, x = 0, y = 0) => {
            drawnTexts.push(txt);
            drawnPlacements.push({ text: txt, x, y });
          },
        };
        const canvasObj = {
          width: 0,
          height: 0,
          getContext: () => ctx,
          toDataURL: (mime: string) => (mime === 'image/png' ? TINY_PNG_DATA_URL : TINY_JPEG_DATA_URL),
        };
        createdCanvases.push(canvasObj);
        return canvasObj;
      }
      if (tag === 'a') {
        const anchor = {
          href: '',
          download: '',
          click: () => {
            downloads.push({ filename: anchor.download, href: anchor.href });
          },
          dispatchEvent: () => {
            downloads.push({ filename: anchor.download, href: anchor.href });
            return true;
          },
        };
        return anchor;
      }
      return {};
    },
  };

  URL.createObjectURL = () => 'blob:mock-csv-url';
  URL.revokeObjectURL = () => {};

  try {
    const sampleRecord = makeSampleRecord({
      branch: 'Suyudono',
      date: '2026-04-02',
      catatanGrab: 'Grab 2 pesanan, ShopeeFood 1 pesanan.',
      catatanBarang: 'Cup kurang 2 slop, gula 1 karung, plastik belum datang.',
      notes: '',
    });

    // 1. Render Canvas check (basis untuk PDF, PNG, JPG): CATATAN BARANG di kolom kiri di bawah Pengeluaran Operasional
    drawnTexts.length = 0;
    drawnPlacements.length = 0;
    const canvasShort = renderRecordCanvas(sampleRecord, null);
    assert.ok(drawnTexts.includes('CABANG: SUYUDONO'));
    assert.ok(drawnTexts.includes('CATATAN GO FOOD'));
    assert.ok(drawnTexts.includes('Grab 2 pesanan, ShopeeFood 1 pesanan.'));
    assert.ok(drawnTexts.includes('CATATAN BARANG'));
    assert.ok(drawnTexts.includes('Cup kurang 2 slop, gula 1 karung, plastik belum datang.'));

    const totalPengeluaranPos = drawnPlacements.find((p) => p.text === 'TOTAL PENGELUARAN');
    const catatanBarangPos = drawnPlacements.find((p) => p.text === 'CATATAN BARANG');
    const catatanBarangTextPos = drawnPlacements.find(
      (p) => p.text === 'Cup kurang 2 slop, gula 1 karung, plastik belum datang.'
    );
    const ringkasanPos = drawnPlacements.find((p) => p.text === 'RINGKASAN KEUANGAN OUTLET');
    const catatanGoFoodPos = drawnPlacements.find((p) => p.text === 'CATATAN GO FOOD');
    assert.ok(totalPengeluaranPos && catatanBarangPos && catatanBarangTextPos && ringkasanPos && catatanGoFoodPos);
    assert.ok(catatanBarangPos.x < 600, 'CATATAN BARANG harus berada di kolom kiri');
    assert.ok(catatanBarangTextPos.x < 600, 'Isi CATATAN BARANG harus berada di kolom kiri');
    assert.ok(catatanBarangPos.y > totalPengeluaranPos.y, 'CATATAN BARANG harus tepat di bawah TOTAL PENGELUARAN');
    assert.equal(
      drawnPlacements.some((p) => p.text === 'CATATAN BARANG' && p.x >= 600),
      false,
      'CATATAN BARANG tidak boleh berada di kolom kanan'
    );
    assert.ok(catatanGoFoodPos.x >= 600, 'CATATAN GO FOOD tetap berada di kolom kanan');
    assert.ok(catatanGoFoodPos.y > ringkasanPos.y);

    // 1b. Rekapan lama yang masih memiliki kolom notes tetap merender CATATAN TAMBAHAN KASIR / OUTLET di kolom kanan
    drawnTexts.length = 0;
    drawnPlacements.length = 0;
    renderRecordCanvas(
      makeSampleRecord({
        catatanGrab: 'Grab 2 pesanan',
        catatanBarang: 'Cup kurang 2 slop',
        notes: 'Catatan historis kasir sebelumnya tetap terbaca.',
      }),
      null
    );
    assert.ok(drawnTexts.includes('CATATAN TAMBAHAN KASIR / OUTLET'));
    assert.ok(drawnTexts.includes('Catatan historis kasir sebelumnya tetap terbaca.'));
    const legacyNotesPos = drawnPlacements.find((p) => p.text === 'CATATAN TAMBAHAN KASIR / OUTLET');
    assert.ok(legacyNotesPos && legacyNotesPos.x >= 600, 'CATATAN TAMBAHAN KASIR / OUTLET harus tetap di kolom kanan');

    // 2. Canvas dengan catatan panjang (>250 karakter) tinggi kanvas bertambah otomatis & tidak terpotong
    drawnTexts.length = 0;
    drawnPlacements.length = 0;
    const veryLongGrab =
      'Grab: 12 pesanan, ShopeeFood: 8 pesanan. Tambahan keterangan panjang sekali: ' +
      'seluruh pesanan ojol sudah selesai dipacking rapi dengan seal ganda dan catatan driver.';
    const veryLongBarang =
      'Cup kurang 2 slop, gula 1 karung, plastik belum datang, sedotan kecil sisa 1 pack, ' +
      'tutup cup butuh restock segera besok pagi sebelum outlet buka.';
    const canvasLong = renderRecordCanvas(
      makeSampleRecord({ catatanGrab: veryLongGrab, catatanBarang: veryLongBarang, notes: '' }),
      null
    );
    assert.ok(
      canvasLong.height > canvasShort.height,
      'Tinggi canvas harus bertambah otomatis mengikuti panjang catatan'
    );
    const renderedJoined = drawnTexts.join(' ');
    assert.ok(renderedJoined.includes('seluruh pesanan ojol sudah selesai dipacking rapi'));
    assert.ok(renderedJoined.includes('tutup cup butuh restock segera besok pagi sebelum outlet buka.'));

    // 2b. Khusus CATATAN BARANG ekstra panjang di kolom kiri menambah tinggi kanvas tanpa terpotong
    drawnTexts.length = 0;
    drawnPlacements.length = 0;
    const extraLongBarangOnly = Array.from({ length: 18 }, (_, idx) => `Item barang baris ${idx + 1}: butuh restock segera`).join('\n');
    const canvasLongBarang = renderRecordCanvas(
      makeSampleRecord({ catatanBarang: extraLongBarangOnly, catatanGrab: '', notes: '' }),
      null
    );
    assert.ok(
      canvasLongBarang.height > canvasShort.height,
      'Tinggi canvas harus bertambah saat CATATAN BARANG di kolom kiri sangat panjang'
    );
    assert.ok(drawnTexts.includes('Item barang baris 18: butuh restock segera'));

    // 3. Canvas dengan kedua catatan kosong menampilkan "-" pada masing-masing bagian
    drawnTexts.length = 0;
    drawnPlacements.length = 0;
    renderRecordCanvas(makeSampleRecord({ catatanGrab: '', catatanBarang: '', notes: '' }), null);
    assert.ok(drawnTexts.includes('CATATAN GO FOOD'));
    assert.ok(drawnTexts.includes('CATATAN BARANG'));
    assert.equal(drawnTexts.filter((t) => t === '-').length >= 2, true);

    // 4. Jalankan seluruh 4 fungsi download
    exportRecordToCsv(sampleRecord);
    await exportRecordToImage(sampleRecord, 'png');
    await exportRecordToImage(sampleRecord, 'jpeg');
    await exportRecordToPdf(sampleRecord);

    const downloadedFiles = downloads.map((d) => d.filename);
    assert.ok(downloadedFiles.includes('Rekap_TehKota_Suyudono_2026-04-02.csv'));
    assert.ok(downloadedFiles.includes('Rekap_TehKota_Suyudono_2026-04-02.png'));
    assert.ok(downloadedFiles.includes('Rekap_TehKota_Suyudono_2026-04-02.jpg'));
  } finally {
    (globalThis as any).document = origDocument;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  }
});
