import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFileName, buildBackupHtml, buildBackupJson, photoFileName, type BackupInput } from '../src/lib/backupDoc.ts';

const input: BackupInput = {
  exportedAt: '2026-11-17T16:00:00.000Z', // 한국 시각 11/18 01:00
  exportedOn: '2026-11-18',
  anniversary: '2025-09-30',
  members: ['민지', '준호'],
  moodNames: { flutter: '설레' },
  receipts: [
    {
      id: 'b', no: 2, date: '2026-11-16', place: '반포 <한강>', memo: '노을 & 라면', mood: 'flutter', author: '준호',
      publishedAt: '2026-11-16T10:00:00.000Z', updatedAt: '2026-11-16T10:00:00.000Z', photoFile: photoFileName(2, '2026-11-16'),
      stamps: [{ by: '민지', shape: 'heart', label: '또 가자!' }],
    },
    {
      id: 'a', no: 1, date: '2025-09-20', memo: '사귀기 전', author: '민지',
      publishedAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z', photoFile: photoFileName(1, '2025-09-20'), stamps: [],
    },
  ],
};

test('JSON: 영수증 수가 같고 표시 항목·발행 시각·사진 이름이 들어 있다 (R9)', () => {
  const j = JSON.parse(buildBackupJson(input));
  assert.equal(j.receiptCount, 2);
  assert.equal(j.receipts.length, 2);
  const r = j.receipts[0];
  assert.deepEqual(
    { date: r.date, place: r.place, memo: r.memo, mood: r.mood, author: r.author, publishedAt: r.publishedAt, photo: r.photo, stamps: r.stamps },
    { date: '2026-11-16', place: '반포 <한강>', memo: '노을 & 라면', mood: { key: 'flutter', name: '설레' }, author: '준호', publishedAt: '2026-11-16T10:00:00.000Z', photo: 'photos/0002-2026-11-16.jpg', stamps: [{ by: '민지', shape: 'heart', label: '또 가자!' }] },
  );
  assert.equal(j.receipts[1].place, null);
});

test('HTML: 사진·날짜·장소·메모·기분·작성자·스탬프가 보이고, 사진은 상대 경로 (R9)', () => {
  const h = buildBackupHtml(input);
  for (const s of ['2026.11.16 (월)', '반포 &lt;한강&gt;', '노을 &amp; 라면', '설레', '준호', '민지의 하트 스탬프', '또 가자!', 'src="photos/0002-2026-11-16.jpg"', 'D+413']) {
    assert.ok(h.includes(s), s);
  }
  assert.ok(h.includes('D-10') && h.includes('사귄 날 10일 전'), '사귀기 전 영수증은 D- (9/20은 9/30보다 10일 전)');
  assert.equal((h.match(/<article /g) ?? []).length, 2);
});

test('HTML: 백업 날짜는 기기 날짜 (UTC로 자르지 않음)', () => {
  assert.ok(buildBackupHtml(input).includes('2026.11.18 백업'));
});

test('HTML: 인터넷이 필요한 것이 없다 (외부 주소·스크립트 없음)', () => {
  const h = buildBackupHtml(input);
  assert.ok(!/https?:\/\//.test(h));
  assert.ok(!/<script/i.test(h));
});

test('파일 이름', () => {
  assert.equal(photoFileName(12, '2026-01-02'), 'photos/0012-2026-01-02.jpg');
  assert.equal(backupFileName('2026-11-18'), 'uriduri-backup-2026-11-18.zip');
});
