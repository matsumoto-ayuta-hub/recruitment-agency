/**
 * CRMツール比較・推奨レポート
 * CareerJapanの現状規模・予算・要件に基づく客観的な評価
 */

export interface CRMOption {
  name: string;
  provider: string;
  monthlyFee: string;
  pros: string[];
  cons: string[];
  suitableFor: string;
  integrations: string[];
  verdict: "推奨" | "候補" | "不要";
  priority: number;
}

export const CRM_OPTIONS: CRMOption[] = [
  {
    name: "Google Sheets + Apps Script（現状強化）",
    provider: "Google",
    monthlyFee: "¥0（G Suite利用中なら追加費用なし）",
    pros: [
      "既存データをそのまま活用（移行コストゼロ）",
      "CAが既に慣れているUI",
      "Apps Scriptで手動コピペを完全自動化",
      "カスタマイズ自由度が高い",
      "ClaudeCodeと連携して自動化しやすい",
    ],
    cons: [
      "大規模化した時にデータ管理が複雑になる",
      "メール自動化機能がない（GmailとApps Scriptで補完可能）",
      "リアルタイムの活動ログ管理が弱い",
    ],
    suitableFor: "月間登録50件以下・CA3名規模の今すぐ",
    integrations: ["Gmail", "Slack", "HubSpot（片方向同期）", "Claude API"],
    verdict: "推奨",
    priority: 1,
  },
  {
    name: "HubSpot Free CRM",
    provider: "HubSpot",
    monthlyFee: "¥0（Free）/ ¥2,400〜（Starter）",
    pros: [
      "コンタクト管理が直感的でCAが使いやすい",
      "メールシーケンス（Free: 5個）",
      "ミーティング予約リンク（timerexの代替にも）",
      "Google Sheetsとの連携可能",
      "スマホアプリあり",
      "パイプライン視覚化で進捗が一目でわかる",
    ],
    cons: [
      "Free版は自動化が限定的",
      "日本語UIはあるが一部英語が残る",
      "Starter以上で$50/月〜と費用がかかる",
      "求人エージェント専用機能はなくカスタマイズが必要",
    ],
    suitableFor: "月間登録50件超えたタイミングで導入検討",
    integrations: ["Gmail", "Google Calendar", "Slack", "Zoom", "Zapier"],
    verdict: "候補",
    priority: 2,
  },
  {
    name: "Notion CRM",
    provider: "Notion",
    monthlyFee: "¥0〜¥1,500/ユーザー",
    pros: [
      "求職者カードをリッチに管理（メモ・履歴・添付）",
      "CA個人メディアのコンテンツ管理も同じツールで",
      "データベース×ビュー（カンバン・テーブル・カレンダー）",
      "AIサマリー機能（面談メモの要約など）",
    ],
    cons: [
      "CRMとして使うには自分でDB設計が必要",
      "メール自動化はできない（Zapier必要）",
      "既存スプシからの移行が面倒",
    ],
    suitableFor: "CA個人メディア管理も兼ねたい場合",
    integrations: ["Slack", "GitHub", "Zapier"],
    verdict: "候補",
    priority: 3,
  },
  {
    name: "Salesforce（求人業界特化版）",
    provider: "Salesforce",
    monthlyFee: "¥30,000〜/月",
    pros: [
      "求人業界特化のATS機能",
      "高度な自動化・レポート",
    ],
    cons: [
      "現在の規模では完全オーバースペック",
      "導入・運用コストが高い",
      "CAの習熟に時間がかかる",
    ],
    suitableFor: "月間内定100件以上の大規模化後",
    integrations: ["全ての主要ツール"],
    verdict: "不要",
    priority: 4,
  },
];

export function generateCRMRecommendationReport(): string {
  const recommended = CRM_OPTIONS.filter((o) => o.verdict === "推奨");
  const candidates = CRM_OPTIONS.filter((o) => o.verdict === "候補");

  return `# CRM戦略レポート — CareerJapan

## 現状分析（スプレッドシートから読み取った課題）

| 課題 | 深刻度 | 解決方法 |
|------|--------|---------|
| 手動コピペ（キャリカミ→求職者スプシ） | 🔴 高 | Apps Script自動化（即対応済み） |
| フェーズ変更のCA通知がない | 🔴 高 | Apps Script onEditトリガー（即対応済み） |
| Hot求職者の見逃しリスク | 🔴 高 | 温度感スコアリング＋自動アラート（即対応済み） |
| 面談前日リマインダーなし | 🟡 中 | Apps Scriptリマインダー（即対応済み） |
| キャリカミ以外の媒体が未活用 | 🟡 中 | LLMO・ニッチサービスで新流入開拓 |
| 日次KPIレポートが手動 | 🟡 中 | Apps Script日次レポート（即対応済み） |
| メール自動化ができていない | 🟡 中 | HubSpot Free導入で解決 |
| 求職者の行動履歴が見えない | 🔵 低 | チャットボット＋スコアリング（中期で対応） |

## 推奨CRM戦略（3フェーズ）

### フェーズ1: 今すぐ（コスト: ¥0）
**Google Sheets + Apps Script強化**

実装済みの自動化:
- キャリカミ新規リード自動転記（手動コピペ廃止）
- フェーズ変更 → CA即時Slack/メール通知
- Hot判定求職者 → CA優先対応アラート（1日2回）
- 面談前日リマインダー自動送信
- 日次KPIレポート自動生成（18:00）

**期待効果:** CA1人あたり週3〜4時間の工数削減

---

### フェーズ2: 登録者50件/月を超えたら（コスト: ¥0〜¥7,200/月）
**HubSpot Free CRM導入**

追加できること:
- 視覚的なパイプライン管理（カンバンボード）
- メールシーケンス自動化（Cold層への定期ナーチャリング）
- ミーティング予約リンク（timerexと統合または代替）
- CAの活動ログ自動記録

**移行方法:** 既存スプシからCSVインポート（30分で完了）
**Google Sheetsとの関係:** 併用（SpreadsheetはCAが慣れた入力ツールとして継続）

---

### フェーズ3: 月間内定30件以上（コスト: ¥15,000〜/月）
**HubSpot Starter または 専門ATSへ移行**

必要になる機能:
- 高度なワークフロー自動化
- A/Bテスト
- 詳細な分析レポート
- 複数パイプライン管理

---

## 即時推奨アクション

1. **今日:** Apps Scriptを求職者スプシに設定（作業時間: 30分）
   → スクリプトプロパティにSlack Webhook URLとCA別メールを設定
   → \`setupTriggers()\` を実行

2. **今週:** HubSpot Freeアカウント作成（セットアップガイド参照）
   → カスタムプロパティ9個を設定
   → 既存データをインポート

3. **来月:** メールシーケンス3本を設定
   → 新規登録者ウェルカム
   → 面談後フォロー
   → Cold層ナーチャリング（3ヶ月後/6ヶ月後）

---

## HubSpot vs Salesforce: どちらが正解か

**CareerJapanには今はHubSpot Free が正解。理由:**

| 比較軸 | HubSpot Free | Salesforce |
|--------|-------------|-----------|
| 費用 | ¥0 | ¥30,000〜/月 |
| 導入難易度 | 低（1日で完了） | 高（1〜3ヶ月） |
| 現在の規模感 | ✅ ぴったり | ❌ オーバースペック |
| 求人業界特化 | △ カスタマイズで対応 | ◎ 業界テンプレあり |
| Claude/API連携 | ◎ 簡単 | △ 複雑 |

**Salesforceを検討するのは年間売上5,000万円を超えてから。**
`;
}
