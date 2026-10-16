/**
 * 求職者ナーチャリング自動化（広告面談シート = キャリカミ/TT/ハックツ）
 *
 * ※旧 auto-sync.gs の修正版です。旧版は参照先タブが誤っていたため使用しないでください。
 *
 * 【導入手順】
 *   STEP1: shindan() でタブ名を確認
 *   STEP2: NURTURE_CONFIG.TAB_NAME を設定
 *   STEP3: kakunin_TEST() で試験実行（通知は飛びません）
 *   STEP4: nurtureTriggerSettei() で自動実行を有効化
 */

const NURTURE_CONFIG = {
  SHEET_ID: '1wEKLJ-J-cPiso-9TfxkW7oLcOFbcPTIVvtrSznfUtLQ', // 広告面談シート
  TAB_NAME: '',   // ← 空欄だと安全のため実行中止。shindan()で確認して設定してください

  SLACK_WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL') || '',

  CA_EMAILS: {
    '松本': PropertiesService.getScriptProperties().getProperty('EMAIL_MATSUMOTO') || '',
    '荒木': PropertiesService.getScriptProperties().getProperty('EMAIL_ARAKI') || '',
    '合志': PropertiesService.getScriptProperties().getProperty('EMAIL_GOSHI') || '',
  },

  HOT_THRESHOLD: 55,
};

const PHASE = {
  SCHEDULED: '面談設定',
  DONE: '面談実施',
  OFFERED: '求人提案',
  SELECTION: '選考中',
  NO_MATCH: '求人紹介不可',
  DROPOUT: 'その他離脱',
};

// 離脱・紹介不可は対象外
function isActivePhase(phase) {
  return phase !== PHASE.DROPOUT && phase !== PHASE.NO_MATCH;
}

/**
 * 温度感スコア（0〜100）
 * 実際のスプシ列（希望就職時期・フェーズ・承認/否認・正社員経験）から算出
 */
function scoreSeeker(rec) {
  let score = 0;

  const urgency = String(rec['希望就職時期'] || '');
  if (urgency.indexOf('今すぐ') >= 0) score += 35;
  else if (urgency.indexOf('1') >= 0 && urgency.indexOf('2') >= 0) score += 26; // 1~2ヶ月以内
  else if (urgency.indexOf('3') >= 0 && urgency.indexOf('4') >= 0) score += 14; // 3〜4ヶ月以内
  else if (urgency.indexOf('5') >= 0) score += 6;

  const phase = String(rec['フェーズ'] || '');
  if (phase === PHASE.SELECTION) score += 30;
  else if (phase === PHASE.OFFERED) score += 22;
  else if (phase === PHASE.DONE) score += 14;
  else if (phase === PHASE.SCHEDULED) score += 8;

  if (String(rec['承認/否認']).trim() === '〇') score += 15;
  if (String(rec['面談実施の有無']).trim() === '〇') score += 10;

  const exp = String(rec['正社員経験'] || '');
  if (exp.indexOf('3年以上') >= 0) score += 10;
  else if (exp.indexOf('年') >= 0) score += 5;

  return Math.min(100, score);
}

function tempLabel(score) {
  if (score >= NURTURE_CONFIG.HOT_THRESHOLD) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

// ======================================================
// シート読み込み（共通・安全装置つき）
// ======================================================
function loadRecords() {
  if (!NURTURE_CONFIG.TAB_NAME) {
    Logger.log('✕ 中止: NURTURE_CONFIG.TAB_NAME が未設定です。shindan() で確認してください。');
    return null;
  }

  const ss = SpreadsheetApp.openById(NURTURE_CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(NURTURE_CONFIG.TAB_NAME);
  if (!sheet) {
    Logger.log('✕ 中止: タブ「' + NURTURE_CONFIG.TAB_NAME + '」が見つかりません。');
    Logger.log('  存在するタブ: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(' / '));
    return null;
  }

  const values = sheet.getDataRange().getValues();
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, values.length); i++) {
    const r = values[i].map(function (c) { return String(c).trim(); });
    if (r.indexOf('氏名') >= 0 && r.indexOf('フェーズ') >= 0) { headerRow = i; break; }
  }
  if (headerRow < 0) {
    Logger.log('✕ 中止: ヘッダー行（氏名・フェーズを含む行）が見つかりません。');
    return null;
  }

  const headers = values[headerRow].map(function (c) { return String(c).trim(); });
  const records = [];
  for (let i = headerRow + 1; i < values.length; i++) {
    if (!String(values[i][headers.indexOf('氏名')]).trim()) continue;
    const rec = {};
    headers.forEach(function (h, idx) { if (h) rec[h] = values[i][idx]; });
    rec.__row = i + 1;
    records.push(rec);
  }

  return { sheet: sheet, headers: headers, records: records, headerRow: headerRow };
}

// ======================================================
// 試験実行（通知を飛ばさず、結果だけ表示）
// ======================================================
function kakunin_TEST() {
  const data = loadRecords();
  if (!data) return;

  Logger.log('==============================================');
  Logger.log(' 試験モード（メール・Slackは送信しません）');
  Logger.log('==============================================');
  Logger.log('読み込み件数: ' + data.records.length + '件');

  const hot = [], warm = [], cold = [];
  data.records.forEach(function (r) {
    if (!isActivePhase(String(r['フェーズ'] || ''))) return;
    const s = scoreSeeker(r);
    const t = tempLabel(s);
    if (t === 'hot') hot.push({ r: r, s: s });
    else if (t === 'warm') warm.push({ r: r, s: s });
    else cold.push({ r: r, s: s });
  });

  const active = hot.length + warm.length + cold.length;
  Logger.log('');
  Logger.log('🌡️ 温度感分布（アクティブ ' + active + '名）');
  Logger.log('  Hot : ' + hot.length + '名 (' + pct(hot.length, active) + '%)  ← 目標50%');
  Logger.log('  Warm: ' + warm.length + '名 (' + pct(warm.length, active) + '%)');
  Logger.log('  Cold: ' + cold.length + '名 (' + pct(cold.length, active) + '%)');
  Logger.log('');
  Logger.log('🔴 Hot判定（本日対応推奨）');
  hot.sort(function (a, b) { return b.s - a.s; }).forEach(function (h) {
    Logger.log('  ' + h.r['氏名'] + ' (スコア' + h.s + ') 担当:' + (h.r['担当者'] || '未割当') +
               ' / ' + h.r['希望就職時期'] + ' / ' + h.r['フェーズ']);
  });
  Logger.log('');
  Logger.log('通知先メール設定状況:');
  Object.keys(NURTURE_CONFIG.CA_EMAILS).forEach(function (ca) {
    const e = NURTURE_CONFIG.CA_EMAILS[ca];
    Logger.log('  ' + ca + ': ' + (e ? e : '✕ 未設定（スクリプトプロパティに登録してください）'));
  });
  Logger.log('Slack Webhook: ' + (NURTURE_CONFIG.SLACK_WEBHOOK_URL ? '設定済み' : '✕ 未設定'));
}

function pct(n, total) {
  return total > 0 ? Math.round(n / total * 100) : 0;
}

// ======================================================
// Hot判定通知（本番・1日2回）
// ======================================================
function hotLeadTsuchi() {
  const data = loadRecords();
  if (!data) return;

  const byCA = {};
  const all = [];

  data.records.forEach(function (r) {
    if (!isActivePhase(String(r['フェーズ'] || ''))) return;
    const s = scoreSeeker(r);
    if (tempLabel(s) !== 'hot') return;

    const ca = String(r['担当者'] || '未割当').trim();
    if (!byCA[ca]) byCA[ca] = [];
    byCA[ca].push({ rec: r, score: s });
    all.push({ rec: r, score: s, ca: ca });
  });

  if (all.length === 0) {
    Logger.log('Hot判定該当なし');
    return;
  }

  // Slack（全体）
  const slackMsg = '🔴 Hot判定 ' + all.length + '名（本日対応推奨）\n' +
    all.sort(function (a, b) { return b.score - a.score; }).map(function (x) {
      return '・' + x.rec['氏名'] + '（' + x.score + '点）担当:' + x.ca +
             ' / ' + x.rec['希望就職時期'] + ' / ' + x.rec['フェーズ'];
    }).join('\n');
  notifySlackNurture(slackMsg);

  // CA別メール
  Object.keys(byCA).forEach(function (ca) {
    const email = NURTURE_CONFIG.CA_EMAILS[ca];
    if (!email) return;

    const list = byCA[ca].sort(function (a, b) { return b.score - a.score; });
    const body = ca + 'さん\n\n' +
      '本日優先対応が必要な求職者をお知らせします（' + list.length + '名）。\n\n' +
      list.map(function (x) {
        return '■ ' + x.rec['氏名'] + '様（温度感スコア ' + x.score + '/100）\n' +
               '   電話: ' + (x.rec['電話番号'] || '-') + '\n' +
               '   転職時期: ' + (x.rec['希望就職時期'] || '-') + '\n' +
               '   現フェーズ: ' + (x.rec['フェーズ'] || '-') + '\n' +
               '   面談日: ' + fmtDate(x.rec['面談日']);
      }).join('\n\n') +
      '\n\n本日中のご連絡をお願いします。\n\n---\nこの通知は自動送信です。';

    GmailApp.sendEmail(email, '【Hot判定】本日対応推奨 ' + list.length + '名', body);
  });

  Logger.log('✅ Hot判定通知を送信: ' + all.length + '名');
}

// ======================================================
// 面談前日リマインダー（毎朝）
// ======================================================
function menndanRemind() {
  const data = loadRecords();
  if (!data) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowList = [], todayList = [];

  data.records.forEach(function (r) {
    if (!isActivePhase(String(r['フェーズ'] || ''))) return;
    const raw = r['面談日'];
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === tomorrow.getTime()) tomorrowList.push(r);
    else if (d.getTime() === today.getTime()) todayList.push(r);
  });

  if (todayList.length > 0) {
    notifySlackNurture('⚡ 本日の面談 ' + todayList.length + '件\n' +
      todayList.map(function (r) {
        return '・' + r['氏名'] + '（担当:' + (r['担当者'] || '未割当') + '）';
      }).join('\n'));
  }

  if (tomorrowList.length > 0) {
    notifySlackNurture('🗓️ 明日の面談 ' + tomorrowList.length + '件\n' +
      tomorrowList.map(function (r) {
        return '・' + r['氏名'] + '（担当:' + (r['担当者'] || '未割当') + '）';
      }).join('\n'));

    const byCA = {};
    tomorrowList.forEach(function (r) {
      const ca = String(r['担当者'] || '').trim();
      if (!ca) return;
      if (!byCA[ca]) byCA[ca] = [];
      byCA[ca].push(r);
    });

    Object.keys(byCA).forEach(function (ca) {
      const email = NURTURE_CONFIG.CA_EMAILS[ca];
      if (!email) return;
      const body = ca + 'さん\n\n明日の面談予定です（' + byCA[ca].length + '件）。\n\n' +
        byCA[ca].map(function (r) {
          return '■ ' + r['氏名'] + '様\n' +
                 '   電話: ' + (r['電話番号'] || '-') + '\n' +
                 '   希望勤務地: ' + (r['希望勤務地'] || '-') + '\n' +
                 '   転職時期: ' + (r['希望就職時期'] || '-') + '\n' +
                 '   メモ: ' + (String(r['メモ'] || '').slice(0, 120) || 'なし');
        }).join('\n\n') +
        '\n\n---\nこの通知は自動送信です。';
      GmailApp.sendEmail(email, '【明日の面談】' + byCA[ca].length + '件のリマインダー', body);
    });
  }

  Logger.log('リマインダー送信: 本日' + todayList.length + '件 / 明日' + tomorrowList.length + '件');
}

// ======================================================
// 日次KPIレポート
// ======================================================
function nichijiKPI() {
  const data = loadRecords();
  if (!data) return;

  const now = new Date();
  const thisMonth = String(now.getFullYear()).slice(2) + '年' +
                    ('0' + (now.getMonth() + 1)).slice(-2) + '月';

  let total = 0, approved = 0, dropout = 0, interviewed = 0;
  let hot = 0, warm = 0, cold = 0;
  const caStats = {};

  data.records.forEach(function (r) {
    if (String(r['実施月'] || '').trim() === thisMonth) {
      total++;
      if (String(r['承認/否認']).trim() === '〇') approved++;
      if (String(r['面談実施の有無']).trim() === '〇') interviewed++;
      if (String(r['フェーズ']) === PHASE.DROPOUT) dropout++;

      const ca = String(r['担当者'] || '未割当').trim();
      if (!caStats[ca]) caStats[ca] = { t: 0, a: 0 };
      caStats[ca].t++;
      if (String(r['承認/否認']).trim() === '〇') caStats[ca].a++;
    }

    if (isActivePhase(String(r['フェーズ'] || ''))) {
      const t = tempLabel(scoreSeeker(r));
      if (t === 'hot') hot++; else if (t === 'warm') warm++; else cold++;
    }
  });

  const active = hot + warm + cold;
  const msg = '📊 日次KPI — ' + now.toLocaleDateString('ja-JP') + '\n' +
    '━━━━━━━━━━━━━━━\n' +
    '【今月 ' + thisMonth + '】\n' +
    '  登録: ' + total + '件 / 面談実施: ' + interviewed + '件\n' +
    '  承認: ' + approved + '件（承認率 ' + pct(approved, interviewed) + '%）\n' +
    '  離脱: ' + dropout + '件\n\n' +
    '【温度感（アクティブ ' + active + '名）】\n' +
    '  Hot : ' + hot + '名 ' + pct(hot, active) + '%  ← 目標50%\n' +
    '  Warm: ' + warm + '名 ' + pct(warm, active) + '%\n' +
    '  Cold: ' + cold + '名 ' + pct(cold, active) + '%\n\n' +
    '【CA別】\n' +
    Object.keys(caStats).map(function (ca) {
      return '  ' + ca + ': ' + caStats[ca].t + '件 / 承認' + caStats[ca].a +
             '件 (' + pct(caStats[ca].a, caStats[ca].t) + '%)';
    }).join('\n');

  notifySlackNurture(msg);
  Logger.log(msg);
}

function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
}

function notifySlackNurture(message) {
  if (!NURTURE_CONFIG.SLACK_WEBHOOK_URL) {
    Logger.log('[Slack未設定のためスキップ]\n' + message);
    return;
  }
  try {
    UrlFetchApp.fetch(NURTURE_CONFIG.SLACK_WEBHOOK_URL, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ text: message }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('Slack通知エラー: ' + e.message);
  }
}

// ======================================================
// トリガー設定
// ======================================================
function nurtureTriggerSettei() {
  if (!NURTURE_CONFIG.TAB_NAME) {
    Logger.log('✕ TAB_NAME が未設定です。先に設定してください。');
    return;
  }

  const mine = ['hotLeadTsuchi', 'menndanRemind', 'nichijiKPI'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (mine.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('menndanRemind').timeBased().atHour(8).everyDays(1).create();
  ScriptApp.newTrigger('hotLeadTsuchi').timeBased().atHour(10).everyDays(1).create();
  ScriptApp.newTrigger('hotLeadTsuchi').timeBased().atHour(15).everyDays(1).create();
  ScriptApp.newTrigger('nichijiKPI').timeBased().atHour(18).everyDays(1).create();

  Logger.log('✅ ナーチャリング自動化トリガーを設定しました（8時/10時/15時/18時）');
}
