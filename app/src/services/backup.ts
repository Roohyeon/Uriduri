// 전체 백업 ZIP (R9, D5, D6, D16): 브라우저에서 만든다 (02-plan 7장)
import { zipSync, strToU8 } from 'fflate';
import { MOOD_NAMES } from '../data';
import { sortReceipts } from '../lib/board';
import { backupFileName, buildBackupHtml, buildBackupJson, photoFileName, type BackupInput } from '../lib/backupDoc';
import { todayIso } from '../lib/dates';
import { backend } from './index';
import type { ReceiptRec, RoomInfo } from './types';

/** 진행률(0~100)을 알리며 ZIP을 만든다. 사진을 하나라도 못 받으면 실패로 본다(빠진 백업을 주지 않게) */
export async function buildBackupZip(
  records: ReceiptRec[],
  room: RoomInfo,
  onProgress: (pct: number) => void,
): Promise<File> {
  const nick = (id: string) => room.members.find((m) => m.id === id)?.nickname ?? '알 수 없음';
  const sorted = sortReceipts(records);
  const files: Record<string, Uint8Array> = {};
  onProgress(0);

  // 1) 사진 받기 — 전체의 85%
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const blob = await backend.photoBlob(r.photoPath);
    files[photoFileName(r.no, r.date)] = new Uint8Array(await blob.arrayBuffer());
    onProgress(Math.round(((i + 1) / sorted.length) * 85));
  }

  // 2) 문서 만들기
  const input: BackupInput = {
    exportedAt: new Date().toISOString(),
    exportedOn: todayIso(),
    anniversary: room.anniversary,
    members: room.members.map((m) => m.nickname),
    moodNames: MOOD_NAMES,
    receipts: sorted.map((r) => ({
      id: r.id,
      no: r.no,
      date: r.date,
      place: r.place,
      memo: r.memo,
      mood: r.mood,
      author: nick(r.authorId),
      publishedAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
      photoFile: photoFileName(r.no, r.date),
      stamps: r.stamps.map((s) => ({ by: nick(s.userId), shape: s.shape, label: s.label })),
    })),
  };
  files['index.html'] = strToU8(buildBackupHtml(input));
  files['data.json'] = strToU8(buildBackupJson(input));
  onProgress(90);
  await new Promise((r) => setTimeout(r, 0)); // 진행률이 화면에 그려지게 한 번 쉰다

  // 3) 묶기 — 사진은 이미 압축돼 있어 그대로 담는다
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([name, data]) => [`uriduri-backup/${name}`, [data, { level: name.endsWith('.jpg') ? 0 : 6 }]])),
  );
  onProgress(100);
  return new File([zipped], backupFileName(todayIso()), { type: 'application/zip' });
}
