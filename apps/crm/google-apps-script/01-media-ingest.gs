/**
 * Indeed / 求人ボックス / engage 応募メール → スプレッドシート自動取込
 *
 * 【重要な前提】
 * Indeedや求人ボックスは、スプレッドシートに直接データを送る機能がありません。
 * 応募が入ると「応募通知メール」が届きます。
 * このスクリプトはそのメールをGmailから読み取り、スプシに転記します。
 *
 * 【導入手順】
 *   STEP1: chosa_ouboMail()      … どんな応募メールが届いているか調査（書き込みなし）
 *   STEP2: INGEST_CONFIG を調整   … STEP1の結果に合わせてパターンを設定
 *   STEP3: torikomi_TEST()        … 試験実行（書き込みなし・結果だけ表示）
 *   STEP4: torikomi_HONBAN()      … 本番実行（スプシに書き込み）
 *   STEP5: triggerSettei()        … 15分おきの自動実行を有効化
 */

const INGEST_CONFIG = {
  // 応募データを書き込むスプレッドシートとタブ
  // ※ shindan() の結果を見て、正しいタブ名に必ず書き換えてください
  SHEET_ID: '15B9X9aE0d9JgY4B0o_ainBYC2gHMfFbT2_sUL7FkkjI',
  TAB_NAME: '',   // ← 空欄のままだと安全のため実行が中止されます

  // 取込対象のメール検索条件（Gmail検索構文）
  // newer_than:1d = 過去1日分。初回は 7d などに広げてもOK
  MEDIA_SOURCES: [
    {
      name: 'Indeed',
      query: 'from:(indeed.com) subject:(応募 OR application) newer_than:1d',
    },
    {
      name: '求人ボックス',
      query: 'from:(kyujinbox.com) subject:(応募) newer_than:1d',
    },
    {
      name: 'engage',
      query: 'from:(en-gage.net OR engage.en-japan.com) subject:(応募) newer_than:1d',
    },
    {
      name: 'ジョブオレ',
      query: 'from:(joboole) subject:(応募) newer_than:1d',
    },
  ],

  // 処理済みメールに付けるラベル（二重取込を防ぐ）
  PROCESSED_LABEL: '取込済み',

  // 通知先
  SLACK_WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL') || '',
};

// メール本文から情報を抜き出すパターン
// STEP1の調査結果を見て、必要ならここを調整してください
const PARSE_PATTERNS = {
  name: [
    /(?:応募者名|お名前|氏名|名前)[\s　]*[:：]?[\s　]*([^\n\r<]{2,30})/,
    /([^\n\r]{2,20})[\s　]*様(?:から|より)(?:の)?応募/,
  ],
  phone: [
    /(?:電話番号|電話|TEL|連絡先)[\s　]*[:：]?[\s　]*([0-9\-\(\)\s]{10,20})/i,
    /(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})/,
  ],
  email: [
    /(?:メールアドレス|メール|E-?mail)[\s　]*[:：]?[\s　]*([\w.+-]+@[\w.-]+\.\w+)/i,
    /([\w.+-]+@[\w.-]+\.\w+)/,
  ],
  age: [
    /(?:年齢)[\s　]*[:：]?[\s　]*(\d{1,2})[\s　]*歳?/,
    /(\d{2})歳/,
  ],
};

// ======================================================
// STEP1: 応募メールの調査（書き込みなし・安全）
// ======================================================
function chosa_ouboMail() {
  Logger.log('==============================================');
  Logger.log(' 応募メール調査（書き込みは一切しません）');
  Logger.log('==============================================');

  INGEST_CONFIG.MEDIA_SOURCES.forEach(function (src) {
    Logger.log('');
    Logger.log('■ ' + src.name);
    Logger.log('  検索条件: ' + src.query);

    let threads;
    try {
      threads = GmailApp.search(src.query, 0, 5);
    } catch (e) {
      Logger.log('  ✕ 検索エラー: ' + e.message);
      return;
    }

    Logger.log('  該当メール: ' + threads.length + '件');

    threads.slice(0, 2).forEach(function (th, i) {
      const msg = th.getMessages()[0];
      const body = msg.getPlainBody();
      Logger.log('  --- サンプル' + (i + 1) + ' ---');
      Logger.log('  差出人: ' + msg.getFrom());
      Logger.log('  件名  : ' + msg.getSubject());
      Logger.log('  受信日: ' + msg.getDate().toLocaleString('ja-JP'));
      Logger.log('  本文冒頭(400字):');
      Logger.log('  ' + body.slice(0, 400).replace(/\n/g, '\n  '));
      Logger.log('  → 抽出テスト: ' + JSON.stringify(parseOuboMail(body)));
    });
  });

  Logger.log('');
  Logger.log('==============================================');
  Logger.log(' 該当0件の場合 → 検索条件(query)の見直しが必要です');
  Logger.log(' 抽出テストが空 → PARSE_PATTERNS の調整が必要です');
  Logger.log('==============================================');
}

// ======================================================
// STEP3: 試験実行（書き込みなし）
// ======================================================
function torikomi_TEST() {
  jikkou(true);
}

// ======================================================
// STEP4: 本番実行（スプシに書き込み）
// ======================================================
function torikomi_HONBAN() {
  jikkou(false);
}

function jikkou(isDryRun) {
  const mode = isDryRun ? '【試験モード：書き込みなし】' : '【本番モード】';
  Logger.log('==============================================');
  Logger.log(' 応募メール取込 ' + mode);
  Logger.log('==============================================');

  // 安全確認: タブ名が未設定なら中止
  if (!INGEST_CONFIG.TAB_NAME) {
    Logger.log('✕ 中止しました。');
    Logger.log('  INGEST_CONFIG.TAB_NAME が空欄です。');
    Logger.log('  shindan() を実行して正しいタブ名を確認し、設定してください。');
    Logger.log('  ※誤ったタブへの書き込みを防ぐための安全装置です。');
    return;
  }

  const ss = SpreadsheetApp.openById(INGEST_CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(INGEST_CONFIG.TAB_NAME);

  if (!sheet) {
    Logger.log('✕ 中止しました。タブ「' + INGEST_CONFIG.TAB_NAME + '」が見つかりません。');
    Logger.log('  存在するタブ: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(' / '));
    return;
  }

  // 既存データを読み、電話番号・メールで重複判定
  const existing = sheet.getDataRange().getValues();
  const headerRowIndex = findHeaderRow(existing);
  if (headerRowIndex < 0) {
    Logger.log('✕ 中止しました。ヘッダー行（応募日・氏名・電話番号を含む行）が見つかりません。');
    return;
  }
  const headers = existing[headerRowIndex].map(function (h) { return String(h).trim(); });
  Logger.log('ヘッダー行: ' + (headerRowIndex + 1) + '行目');
  Logger.log('列構成: ' + headers.filter(function (h) { return h; }).join(' / '));

  const colPhone = headers.indexOf('電話番号');
  const colEmail = headers.indexOf('メールアドレス');

  const seen = {};
  for (let i = headerRowIndex + 1; i < existing.length; i++) {
    if (colPhone >= 0) {
      const p = normalizePhone(existing[i][colPhone]);
      if (p) seen[p] = true;
    }
    if (colEmail >= 0) {
      const e = String(existing[i][colEmail]).trim().toLowerCase();
      if (e) seen[e] = true;
    }
  }
  Logger.log('既存レコード: ' + Object.keys(seen).length + '件（重複判定用）');

  const label = getOrCreateLabel(INGEST_CONFIG.PROCESSED_LABEL);
  const newRows = [];
  const processedThreads = [];
  let skipDup = 0, skipParse = 0;

  INGEST_CONFIG.MEDIA_SOURCES.forEach(function (src) {
    const query = src.query + ' -label:"' + INGEST_CONFIG.PROCESSED_LABEL + '"';
    let threads = [];
    try {
      threads = GmailApp.search(query, 0, 50);
    } catch (e) {
      Logger.log('✕ ' + src.name + ' 検索エラー: ' + e.message);
      return;
    }

    Logger.log('');
    Logger.log('■ ' + src.name + ': ' + threads.length + '件のメールを検査');

    threads.forEach(function (th) {
      th.getMessages().forEach(function (msg) {
        const parsed = parseOuboMail(msg.getPlainBody());

        if (!parsed.name && !parsed.phone) {
          skipParse++;
          return;
        }

        const key = normalizePhone(parsed.phone) || String(parsed.email).toLowerCase();
        if (key && seen[key]) {
          skipDup++;
          return;
        }
        if (key) seen[key] = true;

        newRows.push(buildRow(headers, {
          media: src.name,
          oubobi: msg.getDate(),
          name: parsed.name,
          phone: parsed.phone,
          email: parsed.email,
          age: parsed.age,
        }));

        Logger.log('  + ' + (parsed.name || '(氏名不明)') + ' / ' + (parsed.phone || '-'));
      });
      processedThreads.push(th);
    });
  });

  Logger.log('');
  Logger.log('----------------------------------------------');
  Logger.log(' 新規取込: ' + newRows.length + '件');
  Logger.log(' 重複スキップ: ' + skipDup + '件');
  Logger.log(' 解析失敗スキップ: ' + skipParse + '件');
  Logger.log('----------------------------------------------');

  if (isDryRun) {
    Logger.log('試験モードのため、書き込みは行いませんでした。');
    Logger.log('問題なければ torikomi_HONBAN() を実行してください。');
    return;
  }

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
    processedThreads.forEach(function (th) { th.addLabel(label); });
    Logger.log('✅ ' + newRows.length + '件をスプレッドシートに追記しました。');
    notifySlackIngest('📥 応募自動取込: ' + newRows.length + '件を追加しました（重複' + skipDup + '件スキップ）');
  } else {
    Logger.log('新規の応募はありませんでした。');
  }
}

// ======================================================
// パース処理
// ======================================================
function parseOuboMail(body) {
  return {
    name: matchFirst(body, PARSE_PATTERNS.name),
    phone: matchFirst(body, PARSE_PATTERNS.phone),
    email: matchFirst(body, PARSE_PATTERNS.email),
    age: matchFirst(body, PARSE_PATTERNS.age),
  };
}

function matchFirst(text, patterns) {
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function buildRow(headers, data) {
  const row = new Array(headers.length).fill('');
  const put = function (colName, value) {
    const idx = headers.indexOf(colName);
    if (idx >= 0) row[idx] = value;
  };

  // 媒体名は先頭列（ヘッダー名が空欄）に入るケースが多い
  if (headers[0] === '' || headers[0] === '媒体' || headers[0] === '媒体名') {
    row[0] = data.media;
  }

  put('応募日', formatYmd(data.oubobi));
  put('氏名', data.name);
  put('電話番号', data.phone);
  put('メールアドレス', data.email);
  put('年齢', data.age);
  put('架電ステータス', '未架電');
  put('面談ステータス', '応募');

  return row;
}

function normalizePhone(v) {
  const s = String(v || '').replace(/[^0-9]/g, '');
  if (s.length < 10) return '';
  return s.slice(-10); // 下10桁で比較（0始まり有無の揺れを吸収）
}

function findHeaderRow(values) {
  for (let i = 0; i < Math.min(10, values.length); i++) {
    const row = values[i].map(function (c) { return String(c).trim(); });
    if (row.indexOf('氏名') >= 0 && row.indexOf('電話番号') >= 0) return i;
  }
  return -1;
}

function formatYmd(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '/' +
    ('0' + (dt.getMonth() + 1)).slice(-2) + '/' +
    ('0' + dt.getDate()).slice(-2);
}

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function notifySlackIngest(message) {
  if (!INGEST_CONFIG.SLACK_WEBHOOK_URL) return;
  try {
    UrlFetchApp.fetch(INGEST_CONFIG.SLACK_WEBHOOK_URL, {
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
// STEP5: 自動実行トリガー設定
// ======================================================
function triggerSettei() {
  if (!INGEST_CONFIG.TAB_NAME) {
    Logger.log('✕ TAB_NAME が未設定です。先に設定してください。');
    return;
  }

  // このスクリプトのトリガーだけ削除（他は残す）
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'torikomi_HONBAN') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('torikomi_HONBAN')
    .timeBased().everyMinutes(15).create();

  Logger.log('✅ 15分おきの自動取込を有効化しました。');
}
