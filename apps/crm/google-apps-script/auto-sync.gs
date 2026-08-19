/**
 * CareerJapan CRM自動同期スクリプト
 * Google Apps Script — スプレッドシートに直接貼り付けて使用
 *
 * 自動化する内容:
 * 1. キャリカミ/TT/ハックツからの新規リードを求職者スプシへ自動転記（手動コピペ廃止）
 * 2. フェーズ変更時にCA担当者へSlack/メール自動通知
 * 3. 面談日が近づいたらリマインダー自動送信
 * 4. Hot判定求職者をリアルタイムアラート
 * 5. 日次KPIレポートを自動集計
 */

// ======================================================
// 設定（スクリプトプロパティに設定してください）
// ======================================================
const CONFIG = {
  SEEKER_SHEET_ID: '15B9X9aE0d9JgY4B0o_ainBYC2gHMfFbT2_sUL7FkkjI',
  OPS_SHEET_ID: '1wEKLJ-J-cPiso-9TfxkW7oLcOFbcPTIVvtrSznfUtLQ',
  SLACK_WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL') || '',
  HUBSPOT_API_KEY: PropertiesService.getScriptProperties().getProperty('HUBSPOT_API_KEY') || '',
  CA_EMAILS: {
    '松本': 'matsumoto.ayuta@careerjapan.co',
    '荒木': PropertiesService.getScriptProperties().getProperty('EMAIL_ARAKI') || '',
    '合志': PropertiesService.getScriptProperties().getProperty('EMAIL_GOSHI') || '',
  },
  HOT_SCORE_THRESHOLD: 70,
};

// フェーズ定義（スプシの「フェーズ」列と一致させる）
const PHASES = {
  INTERVIEW_SCHEDULED: '面談設定',
  INTERVIEW_DONE: '面談実施',
  JOB_OFFERED: '求人提案',
  IN_SELECTION: '選考中',
  CANNOT_REFER: '求人紹介不可',
  OTHER_DROPOUT: 'その他離脱',
};

// 温度感スコア計算（スプシ列情報を使用）
function calculateTemperatureScore(row) {
  let score = 0;

  // 緊急度スコア
  const urgency = row['希望就職時期'] || '';
  if (urgency === '今すぐ') score += 25;
  else if (urgency === '1~2ヶ月以内') score += 18;
  else if (urgency === '3〜4ヶ月以内') score += 10;
  else if (urgency === '5ヶ月以内') score += 5;

  // フェーズスコア
  const phase = row['フェーズ'] || '';
  if (phase === PHASES.IN_SELECTION) score += 20;
  else if (phase === PHASES.JOB_OFFERED) score += 15;
  else if (phase === PHASES.INTERVIEW_DONE) score += 10;
  else if (phase === PHASES.INTERVIEW_SCHEDULED) score += 5;

  // 承認スコア
  if (row['承認/否認'] === '〇') score += 15;

  // 面談実施スコア
  if (row['面談実施の有無'] === '〇') score += 10;

  // 経験スコア
  const exp = row['正社員経験'] || '';
  if (exp === '3年以上') score += 10;
  else if (exp.includes('年')) score += 5;

  return Math.min(100, score);
}

function classifyTemperature(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// ======================================================
// メイン: キャリカミデータ自動転記（手動コピペ廃止）
// ======================================================
function autoSyncFromKyarikamiru() {
  const opsSS = SpreadsheetApp.openById(CONFIG.OPS_SHEET_ID);
  const seekerSS = SpreadsheetApp.openById(CONFIG.SEEKER_SHEET_ID);

  // OpsシートのキャリカミデータシートからRAWデータを取得
  const rawSheet = opsSS.getSheetByName('キャリカミ_RAW') || opsSS.getSheets()[0];
  const seekerSheet = seekerSS.getSheets()[0];

  if (!rawSheet || !seekerSheet) {
    Logger.log('シートが見つかりません');
    return;
  }

  const rawData = rawSheet.getDataRange().getValues();
  if (rawData.length < 2) return;

  const rawHeaders = rawData[0];
  const existingData = seekerSheet.getDataRange().getValues();
  const existingPhones = new Set(existingData.slice(1).map(r => String(r[3]).trim()));

  let newCount = 0;
  const newRows = [];

  for (let i = 1; i < rawData.length; i++) {
    const raw = rawData[i];
    if (!raw[0]) continue;

    const phone = String(raw[10] || '').trim(); // 電話番号列
    if (!phone || existingPhones.has(phone)) continue;

    // キャリカミRAW → 求職者スプシ形式にマッピング
    const seekerRow = mapKyarikamiru(raw, rawHeaders);
    newRows.push(seekerRow);
    existingPhones.add(phone);
    newCount++;
  }

  if (newRows.length > 0) {
    const lastRow = seekerSheet.getLastRow();
    seekerSheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length)
      .setValues(newRows);

    Logger.log(`${newCount}件の新規求職者を自動転記しました`);
    notifySlack(`✅ キャリカミ自動転記: ${newCount}件の新規求職者を追加しました`);
  }
}

function mapKyarikamiru(raw, headers) {
  const get = (name) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? raw[idx] : '';
  };

  // 求職者スプシの列順: 未, 氏名, フリガナ, 電話番号, 年齢, 現住所, 希望勤務地,
  // 現職(経験職種), 正社員経験, 最終学歴, 希望職種, 希望就職時期,
  // 登録日, 面談日, 担当者, リード元詳細, フェーズ, メモ, 面談実施の有無, 承認/否認, 却下理由, 実施月
  return [
    false,                                    // 未
    get('氏名') || get('lastName') || '',     // 氏名
    get('フリガナ') || '',                    // フリガナ
    get('電話番号') || get('phoneNumber') || '', // 電話番号
    get('年齢') || '',                        // 年齢
    get('現住所') || get('prefecture') || '', // 現住所
    get('希望勤務地') || '',                  // 希望勤務地
    get('現職') || get('currentJob') || '',   // 現職
    get('正社員経験') || '',                  // 正社員経験
    get('最終学歴') || '',                    // 最終学歴
    '',                                       // 希望職種
    get('希望就職時期') || '',                // 希望就職時期
    new Date(),                               // 登録日（今日）
    get('面談日') || '',                      // 面談日
    '',                                       // 担当者（後で割り当て）
    'キャリカミ',                              // リード元詳細
    PHASES.INTERVIEW_SCHEDULED,              // フェーズ
    '',                                       // メモ
    '',                                       // 面談実施の有無
    '',                                       // 承認/否認
    '',                                       // 却下理由
    formatMonth(new Date()),                  // 実施月
  ];
}

function formatMonth(date) {
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}年${m}月`;
}

// ======================================================
// 面談リマインダー自動送信（毎日8:30実行）
// ======================================================
function sendInterviewReminders() {
  const ss = SpreadsheetApp.openById(CONFIG.SEEKER_SHEET_ID);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const interviewDateIdx = headers.indexOf('面談日');
  const nameIdx = headers.indexOf('氏名');
  const phoneIdx = headers.indexOf('電話番号');
  const caIdx = headers.indexOf('担当者');
  const phaseIdx = headers.indexOf('フェーズ');

  let reminderCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const interviewDate = row[interviewDateIdx];
    if (!interviewDate) continue;

    const iDate = new Date(interviewDate);
    iDate.setHours(0, 0, 0, 0);

    const phase = row[phaseIdx] || '';
    if (phase === PHASES.OTHER_DROPOUT || phase === PHASES.CANNOT_REFER) continue;

    // 明日の面談
    if (iDate.getTime() === tomorrow.getTime()) {
      const name = row[nameIdx];
      const phone = row[phoneIdx];
      const ca = row[caIdx];
      const caEmail = CONFIG.CA_EMAILS[ca] || '';

      if (caEmail) {
        GmailApp.sendEmail(
          caEmail,
          `【明日面談】${name}様 — リマインダー`,
          `${ca}さん\n\n明日の面談リマインダーです。\n\n求職者: ${name}様\n電話: ${phone}\n面談日: ${formatDate(iDate)}\n\n面談前にスプシのメモ欄も確認しておいてください。\n\n※このメールはClaudeCodeが自動送信しました`
        );
        reminderCount++;
      }

      // Slackにも通知
      notifySlack(`🗓️ 明日の面談リマインダー\n担当: ${ca} / ${name}様 / ${phone}`);
    }

    // 今日の面談（当日朝）
    if (iDate.getTime() === today.getTime()) {
      const name = row[nameIdx];
      const ca = row[caIdx];
      notifySlack(`⚡ 本日面談: ${ca}担当 / ${name}様`);
    }
  }

  Logger.log(`${reminderCount}件のリマインダーを送信しました`);
}

// ======================================================
// Hot判定チェック（毎日10:00、15:00実行）
// ======================================================
function checkHotLeads() {
  const ss = SpreadsheetApp.openById(CONFIG.SEEKER_SHEET_ID);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const hotLeads = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue; // 氏名なし

    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = row[idx]);

    const score = calculateTemperatureScore(rowObj);
    const temp = classifyTemperature(score);

    if (temp === 'hot') {
      const phase = rowObj['フェーズ'] || '';
      const isActive = phase !== PHASES.OTHER_DROPOUT && phase !== PHASES.CANNOT_REFER;

      if (isActive) {
        hotLeads.push({
          name: rowObj['氏名'],
          ca: rowObj['担当者'],
          phone: rowObj['電話番号'],
          phase,
          urgency: rowObj['希望就職時期'],
          score,
        });
      }
    }
  }

  if (hotLeads.length > 0) {
    const msg = hotLeads.map(l =>
      `🔴 Hot求職者: ${l.name}様 (スコア:${l.score}) | 担当:${l.ca} | ${l.urgency} | ${l.phone}`
    ).join('\n');
    notifySlack(`🚨 Hot判定求職者 ${hotLeads.length}名\n${msg}`);

    // 担当CAに個別メール
    const byCA = {};
    hotLeads.forEach(l => {
      if (!byCA[l.ca]) byCA[l.ca] = [];
      byCA[l.ca].push(l);
    });

    Object.entries(byCA).forEach(([ca, leads]) => {
      const email = CONFIG.CA_EMAILS[ca] || '';
      if (!email) return;

      const body = leads.map(l =>
        `・${l.name}様 | 転職時期:${l.urgency} | 電話:${l.phone} | 現フェーズ:${l.phase}`
      ).join('\n');

      GmailApp.sendEmail(
        email,
        `【Hot判定】本日対応優先の求職者 ${leads.length}名`,
        `${ca}さん\n\n本日優先対応が必要なHot判定求職者をお知らせします。\n\n${body}\n\n本日中にご連絡をお願いします。\n\n※ClaudeCodeが自動判定・送信`
      );
    });
  }
}

// ======================================================
// フェーズ変更検知 → CA自動通知（onEdit トリガー）
// ======================================================
function onPhaseChange(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const phaseCol = headers.indexOf('フェーズ') + 1;
  const caCol = headers.indexOf('担当者') + 1;
  const nameCol = headers.indexOf('氏名') + 1;

  if (range.getColumn() !== phaseCol) return;

  const row = range.getRow();
  if (row < 2) return;

  const newPhase = range.getValue();
  const name = sheet.getRange(row, nameCol).getValue();
  const ca = sheet.getRange(row, caCol).getValue();
  const oldPhase = e.oldValue || '(不明)';

  // フェーズ変更通知
  const msg = `📋 フェーズ更新\n${name}様 | ${ca}担当\n${oldPhase} → ${newPhase}`;
  notifySlack(msg);

  // 選考中になったら求職者スコアを再計算
  if (newPhase === PHASES.IN_SELECTION) {
    const rowData = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = rowData[idx]);

    const score = calculateTemperatureScore(rowObj);
    if (score >= CONFIG.HOT_SCORE_THRESHOLD) {
      const caEmail = CONFIG.CA_EMAILS[ca] || '';
      if (caEmail) {
        GmailApp.sendEmail(
          caEmail,
          `【Hot判定】${name}様が選考中フェーズに進みました`,
          `${ca}さん\n\n${name}様が選考中フェーズに進み、Hot判定されました（スコア: ${score}/100）。\n\n迅速なフォローアップをお願いします。\n\n※ClaudeCodeが自動判定・送信`
        );
      }
    }
  }

  // 内定・離脱時の処理
  if (newPhase === PHASES.OTHER_DROPOUT) {
    const caEmail = CONFIG.CA_EMAILS[ca] || '';
    if (caEmail) {
      GmailApp.sendEmail(
        caEmail,
        `【離脱】${name}様 — 振り返りをお願いします`,
        `${ca}さん\n\n${name}様が「その他離脱」となりました。\n\n離脱理由を「却下理由」欄に記入してください（データ改善に使います）。\n\n※ClaudeCodeが自動送信`
      );
    }
  }
}

// ======================================================
// 日次KPIレポート（毎日18:00実行）
// ======================================================
function generateDailyKPIReport() {
  const ss = SpreadsheetApp.openById(CONFIG.SEEKER_SHEET_ID);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = formatMonth(today);

  let monthTotal = 0, monthApproved = 0, monthDropout = 0;
  let hotCount = 0, warmCount = 0, coldCount = 0;
  const caStats = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;

    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = row[idx]);

    const month = rowObj['実施月'] || '';
    if (month !== currentMonth) continue;

    monthTotal++;
    if (rowObj['承認/否認'] === '〇') monthApproved++;
    if (rowObj['フェーズ'] === PHASES.OTHER_DROPOUT) monthDropout++;

    const ca = rowObj['担当者'] || '未割当';
    if (!caStats[ca]) caStats[ca] = { total: 0, approved: 0 };
    caStats[ca].total++;
    if (rowObj['承認/否認'] === '〇') caStats[ca].approved++;

    // 温度感集計
    const score = calculateTemperatureScore(rowObj);
    const temp = classifyTemperature(score);
    if (temp === 'hot') hotCount++;
    else if (temp === 'warm') warmCount++;
    else coldCount++;
  }

  const approvalRate = monthTotal > 0 ? Math.round(monthApproved / monthTotal * 100) : 0;
  const hotRatio = (hotCount + warmCount + coldCount) > 0
    ? Math.round(hotCount / (hotCount + warmCount + coldCount) * 100) : 0;

  const caReport = Object.entries(caStats)
    .map(([ca, s]) => `  ${ca}: ${s.total}件 / 承認${s.approved}件 (${Math.round(s.approved/s.total*100)}%)`)
    .join('\n');

  const report = `
📊 日次KPIレポート — ${today.toLocaleDateString('ja-JP')}
━━━━━━━━━━━━━━━━━━
今月累計 (${currentMonth})
  面談数: ${monthTotal}件
  承認数: ${monthApproved}件
  承認率: ${approvalRate}%
  離脱数: ${monthDropout}件

🌡️ 温度感分布
  Hot🔴: ${hotCount}名 (${hotRatio}%) ← 目標50%
  Warm🟡: ${warmCount}名
  Cold🔵: ${coldCount}名

👥 CA別実績
${caReport}
━━━━━━━━━━━━━━━━━━
Hot比率が50%未満の場合は施策強化が必要です`;

  notifySlack(report);
  Logger.log(report);
}

// ======================================================
// HubSpot連携（フェーズ = 選考中以上の人を同期）
// ======================================================
function syncToHubSpot() {
  if (!CONFIG.HUBSPOT_API_KEY) {
    Logger.log('HubSpot APIキーが設定されていません');
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SEEKER_SHEET_ID);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const syncPhases = [PHASES.IN_SELECTION, PHASES.JOB_OFFERED, PHASES.INTERVIEW_DONE];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;

    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = row[idx]);

    const phase = rowObj['フェーズ'] || '';
    if (!syncPhases.includes(phase)) continue;

    // HubSpot Contact作成/更新
    const contact = {
      properties: {
        lastname: rowObj['氏名'] || '',
        phone: rowObj['電話番号'] || '',
        city: rowObj['現住所'] || '',
        jobtitle: rowObj['現職(経験職種)'] || '',
        hs_lead_status: mapPhaseToHubSpot(phase),
        // カスタムプロパティ
        career_urgency: rowObj['希望就職時期'] || '',
        assigned_ca: rowObj['担当者'] || '',
        temperature_score: String(calculateTemperatureScore(rowObj)),
        lead_source: rowObj['リード元詳細'] || '',
      }
    };

    upsertHubSpotContact(rowObj['電話番号'], contact);
  }

  Logger.log('HubSpot同期完了');
}

function mapPhaseToHubSpot(phase) {
  const map = {
    [PHASES.INTERVIEW_SCHEDULED]: 'NEW',
    [PHASES.INTERVIEW_DONE]: 'OPEN',
    [PHASES.JOB_OFFERED]: 'IN_PROGRESS',
    [PHASES.IN_SELECTION]: 'IN_PROGRESS',
    [PHASES.CANNOT_REFER]: 'UNQUALIFIED',
    [PHASES.OTHER_DROPOUT]: 'UNQUALIFIED',
  };
  return map[phase] || 'NEW';
}

function upsertHubSpotContact(phone, contact) {
  const baseUrl = 'https://api.hubapi.com/crm/v3/objects/contacts';

  try {
    // まず既存の連絡先を検索
    const searchResponse = UrlFetchApp.fetch(
      `${baseUrl}/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify({
          filterGroups: [{
            filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }]
          }]
        }),
        muteHttpExceptions: true,
      }
    );

    const searchResult = JSON.parse(searchResponse.getContentText());

    if (searchResult.total > 0) {
      // 更新
      const contactId = searchResult.results[0].id;
      UrlFetchApp.fetch(`${baseUrl}/${contactId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CONFIG.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(contact),
        muteHttpExceptions: true,
      });
    } else {
      // 新規作成
      UrlFetchApp.fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(contact),
        muteHttpExceptions: true,
      });
    }
  } catch (e) {
    Logger.log(`HubSpot同期エラー (${phone}): ${e.message}`);
  }
}

// ======================================================
// Slack通知ユーティリティ
// ======================================================
function notifySlack(message) {
  if (!CONFIG.SLACK_WEBHOOK_URL) return;

  try {
    UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ text: message }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log(`Slack通知エラー: ${e.message}`);
  }
}

function formatDate(date) {
  return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
}

// ======================================================
// トリガー設定（初回のみ実行）
// ======================================================
function setupTriggers() {
  // 既存トリガーを全削除
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // キャリカミ自動転記: 毎時
  ScriptApp.newTrigger('autoSyncFromKyarikamiru')
    .timeBased().everyHours(1).create();

  // 面談リマインダー: 毎朝8:30
  ScriptApp.newTrigger('sendInterviewReminders')
    .timeBased().atHour(8).everyDays(1).create();

  // Hot判定チェック: 毎日10:00
  ScriptApp.newTrigger('checkHotLeads')
    .timeBased().atHour(10).everyDays(1).create();

  // Hot判定チェック: 毎日15:00
  ScriptApp.newTrigger('checkHotLeads')
    .timeBased().atHour(15).everyDays(1).create();

  // 日次KPIレポート: 毎日18:00
  ScriptApp.newTrigger('generateDailyKPIReport')
    .timeBased().atHour(18).everyDays(1).create();

  // HubSpot同期: 毎日夜
  ScriptApp.newTrigger('syncToHubSpot')
    .timeBased().atHour(23).everyDays(1).create();

  // フェーズ変更検知: スプシ編集時
  const ss = SpreadsheetApp.openById(CONFIG.SEEKER_SHEET_ID);
  ScriptApp.newTrigger('onPhaseChange')
    .forSpreadsheet(ss).onEdit().create();

  Logger.log('✅ 全トリガーを設定しました');
}
