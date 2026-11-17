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
    notes: 'Grab: 2 pesanan, ShopeeFood: 1 pesanan',
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

test('buildRecordCsvContent menyertakan catatan kasir lengkap dan menjaga rumus omzet kotor', () => {
  const sampleRecord = makeSampleRecord();
  const csv = buildRecordCsvContent(sampleRecord);

  assert.ok(csv.includes('CABANG SOMPOK'));
  assert.ok(csv.includes('Tanggal;2026-04-01'));
  assert.ok(csv.includes('Total Omset (Kotor);Rp 1920000'));
  assert.ok(csv.includes('CATATAN TAMBAHAN KASIR / OUTLET'));
  assert.ok(csv.includes('Catatan;"Grab: 2 pesanan, ShopeeFood: 1 pesanan"'));

  // Catatan kosong -> '-'
  const emptyNotesCsv = buildRecordCsvContent(makeSampleRecord({ notes: '   ' }));
  assert.ok(emptyNotesCsv.includes('Catatan;"-"'));

  // Catatan panjang + tanda kutip + titik koma tidak terpotong & ter-escape aman
  const complexLongNote =
    'Grab: 2 pesanan ("Es Teh Ori"); ShopeeFood: 1 pesanan\nShift 2: tutup lebih awal karena hujan.';
  const complexCsv = buildRecordCsvContent(makeSampleRecord({ notes: complexLongNote }));
  assert.ok(
    complexCsv.includes(
      'Catatan;"Grab: 2 pesanan (""Es Teh Ori""); ShopeeFood: 1 pesanan\r\nShift 2: tutup lebih awal karena hujan."'
    ) ||
      complexCsv.includes(
        'Catatan;"Grab: 2 pesanan (""Es Teh Ori""); ShopeeFood: 1 pesanan\nShift 2: tutup lebih awal karena hujan."'
      )
  );
});

// 1x1 valid PNG & JPEG data URLs so jsPDF can embed image bytes cleanly during headless Node verification
const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('Export CSV, PDF, PNG, dan JPG merender catatan kasir lengkap sesuai outlet & tanggal tanpa terpotong', async () => {
  const drawnTexts: string[] = [];
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
          fillText: (txt: string) => {
            drawnTexts.push(txt);
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
      notes: 'Grab: 2 pesanan, ShopeeFood: 1 pesanan',
    });

    // 1. Render Canvas check (basis untuk PDF, PNG, JPG)
    drawnTexts.length = 0;
    const canvasShort = renderRecordCanvas(sampleRecord, null);
    assert.ok(drawnTexts.includes('CABANG: SUYUDONO'));
    assert.ok(drawnTexts.includes('CATATAN TAMBAHAN KASIR / OUTLET'));
    assert.ok(drawnTexts.includes('Grab: 2 pesanan, ShopeeFood: 1 pesanan'));

    // 2. Canvas dengan catatan panjang (>250 karakter) tinggi kanvas bertambah otomatis & tidak terpotong
    drawnTexts.length = 0;
    const veryLongNote =
      'Grab: 2 pesanan, ShopeeFood: 1 pesanan. Tambahan keterangan panjang sekali: ' +
      'seluruh pesanan ojol sudah selesai dipacking rapi dengan seal ganda, stok es batu sudah ditimbang ulang, dan selisih receh kasir sudah dicatat.';
    const canvasLong = renderRecordCanvas(makeSampleRecord({ notes: veryLongNote }), null);
    assert.ok(
      canvasLong.height > canvasShort.height,
      'Tinggi canvas harus bertambah otomatis mengikuti panjang catatan'
    );
    const renderedJoined = drawnTexts.join(' ');
    assert.ok(renderedJoined.includes('Grab: 2 pesanan, ShopeeFood: 1 pesanan.'));
    assert.ok(renderedJoined.includes('selisih receh kasir sudah dicatat.'));

    // 3. Canvas dengan catatan kosong menampilkan "-"
    drawnTexts.length = 0;
    renderRecordCanvas(makeSampleRecord({ notes: '' }), null);
    assert.ok(drawnTexts.includes('CATATAN TAMBAHAN KASIR / OUTLET'));
    assert.ok(drawnTexts.includes('-'));

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
