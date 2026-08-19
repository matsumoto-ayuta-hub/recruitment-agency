/**
 * 【最初に必ずこれを実行してください】
 * シート構成の診断スクリプト
 *
 * 使い方:
 *   1. この関数 shindan() を実行
 *   2. 「実行ログ」に表示された内容を確認
 *   3. その結果を CONFIG のタブ名に設定する
 *
 * ※このスクリプトは読み取りのみ。データを一切変更しません。
 */

const SHEET_A_ID = '15B9X9aE0d9JgY4B0o_ainBYC2gHMfFbT2_sUL7FkkjI'; // 求人媒体経由（Indeed等）
const SHEET_B_ID = '1wEKLJ-J-cPiso-9TfxkW7oLcOFbcPTIVvtrSznfUtLQ'; // 広告面談（キャリカミ等）

function shindan() {
  Logger.log('================================================');
  Logger.log(' シート構成診断 — ' + new Date().toLocaleString('ja-JP'));
  Logger.log('================================================');

  [['A（求人媒体経由）', SHEET_A_ID], ['B（広告面談）', SHEET_B_ID]].forEach(function (pair) {
    const label = pair[0];
    const id = pair[1];
    Logger.log('');
    Logger.log('■ スプレッドシート ' + label);

    let ss;
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      Logger.log('  ✕ 開けません: ' + e.message);
      return;
    }

    Logger.log('  名前: ' + ss.getName());
    ss.getSheets().forEach(function (sh, i) {
      const lastRow = sh.getLastRow();
      const lastCol = sh.getLastColumn();
      let headers = [];
      if (lastRow >= 1 && lastCol >= 1) {
        // 上から5行スキャンして、最も「ヘッダーらしい」行を探す
        const top = sh.getRange(1, 1, Math.min(5, lastRow), lastCol).getValues();
        let best = [], bestScore = 0;
        top.forEach(function (row) {
          const filled = row.filter(function (c) { return String(c).trim() !== ''; });
          if (filled.length > bestScore) { bestScore = filled.length; best = row; }
        });
        headers = best.map(function (c) { return String(c).trim(); })
                      .filter(function (c) { return c !== ''; });
      }
      Logger.log('  [' + i + '] タブ名「' + sh.getName() + '」 行数=' + lastRow + ' 列数=' + lastCol);
      Logger.log('       ヘッダー候補: ' + headers.slice(0, 16).join(' / '));
    });
  });

  Logger.log('');
  Logger.log('================================================');
  Logger.log(' 上記の「タブ名」を CONFIG に設定してください');
  Logger.log('================================================');
}

/**
 * 現在設定されているトリガー一覧を表示
 * 不要なトリガーが残っていないか確認用
 */
function torigaIchiran() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('設定中のトリガー: ' + triggers.length + '件');
  triggers.forEach(function (t, i) {
    Logger.log('  [' + i + '] ' + t.getHandlerFunction() + ' (' + t.getEventType() + ')');
  });
  if (triggers.length === 0) Logger.log('  （トリガーなし）');
}

/**
 * 【緊急停止】全トリガーを削除
 * 何かおかしいと思ったらこれを実行してください
 */
function zenTriggerSakujo() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('✅ ' + triggers.length + '件のトリガーを削除しました。自動処理は全て停止しました。');
}
