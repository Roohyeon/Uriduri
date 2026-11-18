// 전체 백업 ZIP 안의 문서 만들기 (R9) — 순수 함수. 테스트: tests/backup.test.ts
// ZIP 구성: photos/ 사진 폴더 + index.html(인터넷 없이 열리는 기록 보기) + data.json(전체 데이터)
import { dday, fmtDate, fmtDplus } from './dates.ts';

export type BackupStamp = { by: string; shape: 'circle' | 'heart' | 'triangle'; label: string };
export type BackupReceipt = {
  id: string;
  no: number;
  date: string; // YYYY-MM-DD
  place?: string;
  memo: string;
  mood?: string; // 키 (happy 등)
  author: string; // 닉네임
  publishedAt: string; // ISO 시각
  updatedAt: string;
  photoFile: string; // photos/0001-2026-11-08.jpg
  stamps: BackupStamp[];
};
export type BackupInput = {
  exportedAt: string; // ISO 시각 (JSON용)
  exportedOn: string; // 기기 시간 기준 날짜 YYYY-MM-DD (화면용 — ISO를 자르면 한국 아침엔 하루 전이 됨)
  anniversary: string;
  members: string[]; // 닉네임
  receipts: BackupReceipt[]; // 영수증 날짜순(최근이 위)
  moodNames: Record<string, string>;
};

/** 사진 파일 이름: 번호-날짜.jpg (정렬하기 쉽게) */
export const photoFileName = (no: number, date: string) => `photos/${String(no).padStart(4, '0')}-${date}.jpg`;

/** ZIP 파일 이름: uriduri-backup-2026-11-18.zip */
export const backupFileName = (today: string) => `uriduri-backup-${today}.zip`;

export function buildBackupJson(input: BackupInput): string {
  return JSON.stringify(
    {
      format: 'uriduri-backup',
      version: 1,
      exportedAt: input.exportedAt,
      room: { anniversary: input.anniversary, members: input.members },
      receiptCount: input.receipts.length,
      receipts: input.receipts.map((r) => ({
        no: r.no,
        date: r.date,
        place: r.place ?? null,
        memo: r.memo,
        mood: r.mood ? { key: r.mood, name: input.moodNames[r.mood] ?? r.mood } : null,
        author: r.author,
        publishedAt: r.publishedAt,
        updatedAt: r.updatedAt,
        photo: r.photoFile,
        stamps: r.stamps,
      })),
    },
    null,
    2,
  );
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SHAPE_MARK: Record<BackupStamp['shape'], string> = { circle: '◯', heart: '♡', triangle: '△' };
const SHAPE_NAME: Record<BackupStamp['shape'], string> = { circle: '동그라미', heart: '하트', triangle: '세모' };

/** 인터넷 없이 열리는 기록 보기 파일. 외부 글꼴·스크립트 없이, 사진은 같은 폴더의 photos/를 가리킨다 */
export function buildBackupHtml(input: BackupInput): string {
  const cards = input.receipts
    .map((r) => {
      const d = fmtDplus(dday(input.anniversary, r.date));
      const rows = [
        ['작성', esc(r.author)],
        ...(r.place ? [['장소', esc(r.place)]] : []),
        ...(r.mood ? [['기분', esc(input.moodNames[r.mood] ?? r.mood)]] : []),
        ['합계', `${d.short} <small>(${d.long})</small>`],
      ]
        .map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`)
        .join('');
      const stamps = r.stamps.length
        ? `<ul class="stamps" aria-label="스탬프">${r.stamps
            .map((s) => `<li><span class="seal" aria-hidden="true">${SHAPE_MARK[s.shape]}</span> ${esc(s.by)}의 ${SHAPE_NAME[s.shape]} 스탬프: <b>${esc(s.label)}</b></li>`)
            .join('')}</ul>`
        : '';
      return `<article class="receipt" id="r${r.no}">
  <header><span class="no">No.${String(r.no).padStart(4, '0')}</span><time datetime="${r.date}">${fmtDate(r.date)}</time></header>
  <img src="${esc(r.photoFile)}" alt="${esc(r.author)}의 ${fmtDate(r.date)} 데이트 사진" loading="lazy">
  <p class="memo">“${esc(r.memo)}”</p>
  <dl>${rows}</dl>
  ${stamps}
</article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>우리두리 백업 · ${esc(input.members.join(' ♥ '))}</title>
<style>
  :root { --paper:#fcfcfa; --ink:#1f2023; --fade:#5f5688; --rule:#c9cacd; --seal:#a92e21; --bg:#e6e7e9; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; word-break:keep-all; overflow-wrap:anywhere; }
  main { max-width:420px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font-size:24px; margin:0; }
  .meta { color:var(--fade); font-size:14px; margin:4px 0 24px; }
  .receipt { background:var(--paper); padding:20px; margin:0 0 20px; box-shadow:0 6px 14px -8px rgb(31 32 35/.25); }
  header { display:flex; justify-content:space-between; font-family:ui-monospace,monospace; font-size:14px; }
  .no { color:var(--fade); }
  img { display:block; width:100%; height:auto; margin:12px 0; background:var(--bg); }
  .memo { font-size:18px; font-weight:600; margin:8px 0 12px; }
  dl { margin:0; border-top:1px dashed var(--rule); padding-top:8px; }
  .row { display:flex; justify-content:space-between; gap:16px; font-size:14px; padding:2px 0; }
  dt { color:var(--fade); } dd { margin:0; text-align:right; }
  small { color:var(--fade); }
  .stamps { list-style:none; margin:12px 0 0; padding:8px 0 0; border-top:1px dashed var(--rule); font-size:14px; }
  .seal { color:var(--seal); font-weight:700; }
  footer { color:var(--fade); font-size:12px; text-align:center; }
</style>
</head>
<body>
<main>
  <h1>${esc(input.members.join(' ♥ '))}</h1>
  <p class="meta">사귄 날 ${fmtDate(input.anniversary, false)} · 영수증 ${input.receipts.length}장 · ${fmtDate(input.exportedOn, false)} 백업</p>
${cards}
  <footer>우리두리 전체 백업 · 이 파일은 인터넷 없이 열려요. 사진은 같은 폴더의 photos 안에 있어요.</footer>
</main>
</body>
</html>
`;
}
