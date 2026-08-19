/**
 * HubSpot CRM連携モジュール
 * Google Sheetsのデータを HubSpot Free CRMと同期
 *
 * HubSpot Free の活用ポイント:
 * - コンタクト管理（無制限）
 * - ディール（商談）パイプライン
 * - メールシーケンス（最大5件/月）
 * - ミーティング予約リンク
 * - レポートダッシュボード（2個まで）
 */

// HubSpot Free で使えるカスタムプロパティ（事前に作成必要）
export const HUBSPOT_CUSTOM_PROPERTIES = [
  {
    name: "career_urgency",
    label: "転職緊急度",
    type: "enumeration",
    options: [
      { label: "今すぐ", value: "immediate" },
      { label: "1〜2ヶ月以内", value: "within_2months" },
      { label: "3〜4ヶ月以内", value: "within_4months" },
      { label: "5ヶ月以内", value: "within_5months" },
      { label: "半年以降", value: "over_6months" },
    ],
  },
  {
    name: "assigned_ca",
    label: "担当CA",
    type: "enumeration",
    options: [
      { label: "松本", value: "matsumoto" },
      { label: "荒木", value: "araki" },
      { label: "合志", value: "goshi" },
    ],
  },
  {
    name: "lead_source_detail",
    label: "リード元詳細",
    type: "enumeration",
    options: [
      { label: "キャリカミ", value: "kyarikamiru" },
      { label: "TT", value: "tt" },
      { label: "ハックツ", value: "hackutsu" },
      { label: "広告経由", value: "ads" },
      { label: "その他求人媒体", value: "other_media" },
    ],
  },
  {
    name: "temperature_score",
    label: "温度感スコア",
    type: "number",
  },
  {
    name: "temperature_label",
    label: "温度感",
    type: "enumeration",
    options: [
      { label: "Hot🔴", value: "hot" },
      { label: "Warm🟡", value: "warm" },
      { label: "Cold🔵", value: "cold" },
    ],
  },
  {
    name: "interview_phase",
    label: "フェーズ",
    type: "enumeration",
    options: [
      { label: "面談設定", value: "interview_scheduled" },
      { label: "面談実施", value: "interview_done" },
      { label: "求人提案", value: "job_offered" },
      { label: "選考中", value: "in_selection" },
      { label: "求人紹介不可", value: "cannot_refer" },
      { label: "その他離脱", value: "dropout" },
    ],
  },
  {
    name: "current_employment_status",
    label: "現在の就業状況",
    type: "enumeration",
    options: [
      { label: "在職中", value: "employed" },
      { label: "離職中", value: "unemployed" },
      { label: "アルバイト", value: "part_time" },
    ],
  },
  {
    name: "target_region",
    label: "希望勤務地",
    type: "string",
  },
  {
    name: "work_experience_years",
    label: "正社員経験",
    type: "enumeration",
    options: [
      { label: "なし", value: "none" },
      { label: "〜半年", value: "under_6months" },
      { label: "〜1年", value: "under_1year" },
      { label: "〜2年", value: "under_2years" },
      { label: "〜3年", value: "under_3years" },
      { label: "3年以上", value: "over_3years" },
    ],
  },
];

// HubSpot パイプライン設定（求職者ライフサイクルに合わせてカスタム）
export const HUBSPOT_PIPELINE_CONFIG = {
  pipelineName: "求職者パイプライン",
  stages: [
    { label: "1. リード獲得", probability: 0.1, automations: ["welcome_email"] },
    { label: "2. 面談設定済み", probability: 0.2, automations: ["reminder_email"] },
    { label: "3. 面談実施完了", probability: 0.4, automations: ["post_interview_survey"] },
    { label: "4. 求人提案中", probability: 0.6, automations: ["job_proposal_email"] },
    { label: "5. 選考中", probability: 0.75, automations: ["selection_support_email"] },
    { label: "6. 内定獲得", probability: 1.0, automations: ["congratulations_email", "ca_bonus_notify"] },
  ],
};

// HubSpot メールシーケンス（Free版: 5シーケンスまで）
export const HUBSPOT_EMAIL_SEQUENCES = [
  {
    name: "新規登録者ウェルカムシーケンス",
    triggerPhase: "interview_scheduled",
    emails: [
      {
        delay: 0,
        subject: "【CareerJapan】ご登録ありがとうございます",
        template: "welcome_v1",
      },
      {
        delay: 1,
        subject: "面談のご確認 — {{interview_date}}",
        template: "interview_confirm_v1",
      },
    ],
  },
  {
    name: "面談後フォローシーケンス",
    triggerPhase: "interview_done",
    emails: [
      {
        delay: 0,
        subject: "本日はありがとうございました — 次のステップについて",
        template: "post_interview_v1",
      },
      {
        delay: 3,
        subject: "求人紹介のご提案",
        template: "job_proposal_v1",
      },
    ],
  },
  {
    name: "Cold層ナーチャリングシーケンス",
    triggerPhase: "dropout",
    emails: [
      {
        delay: 30,
        subject: "3ヶ月後の状況はいかがですか？",
        template: "cold_nurture_3month",
      },
      {
        delay: 90,
        subject: "転職市場の最新情報をお届けします",
        template: "cold_nurture_6month",
      },
    ],
  },
];

// セットアップ手順のMarkdown出力
export function generateHubSpotSetupGuide(): string {
  return `# HubSpot Free CRM セットアップ手順

## ステップ1: アカウント作成（5分）
1. https://app.hubspot.com/signup にアクセス
2. 「無料で始める」をクリック
3. メールアドレス: matsumoto.ayuta@careerjapan.co で登録

## ステップ2: カスタムプロパティ作成（15分）
Settings → Properties → Contact Properties → Create property

作成するプロパティ（${HUBSPOT_CUSTOM_PROPERTIES.length}個）:
${HUBSPOT_CUSTOM_PROPERTIES.map((p) => `- ${p.label} (${p.name}): ${p.type}`).join("\n")}

## ステップ3: パイプライン設定（10分）
CRM → Deals → Actions → Edit pipelines
パイプライン名: ${HUBSPOT_PIPELINE_CONFIG.pipelineName}

ステージ:
${HUBSPOT_PIPELINE_CONFIG.stages.map((s, i) => `${i + 1}. ${s.label} (確率: ${s.probability * 100}%)`).join("\n")}

## ステップ4: Google Apps Script接続（20分）
1. 求職者スプレッドシートを開く
2. 拡張機能 → Apps Script
3. auto-sync.gs の内容を貼り付け
4. スクリプトプロパティに設定:
   - HUBSPOT_API_KEY: [HubSpot設定 → プライベートアプリ → APIキー]
   - SLACK_WEBHOOK_URL: [Slack → アプリ → Incoming Webhooks]
   - EMAIL_ARAKI: 荒木さんのメールアドレス
   - EMAIL_GOSHI: 合志さんのメールアドレス
5. \`setupTriggers()\` を実行（一度だけ）

## ステップ5: 既存データ移行（30分）
1. 現在の求職者スプレッドシートをCSVエクスポート
2. HubSpot → Contacts → Import → Upload a file
3. カラムマッピングを設定
4. インポート実行

## HubSpot Free 活用制限と対策

| 機能 | Free制限 | 対策 |
|------|---------|------|
| コンタクト数 | 無制限 | ✅ 問題なし |
| メールシーケンス | 5個まで | 重要な5シーケンスに絞る |
| レポート | 2ダッシュボード | 週次・月次の2つに集中 |
| ユーザー | 無制限 | ✅ 問題なし |
| 自動化 | 限定的 | Apps Scriptで補完 |

## 費用試算

| プラン | 月額 | 必要時期 |
|--------|-----|---------|
| Free | ¥0 | 今すぐ〜CA5名まで |
| Starter | ~¥2,400/月 | 月間50件以上の時 |
| Professional | ~¥50,000/月 | 年間売上1,000万円超の時 |

**推奨: まずFreeで始め、月間登録50件を超えたらStarterに移行**

## 自動化フロー（Apps Script + HubSpot Free）

\`\`\`
キャリカミ/TT/ハックツ登録
    ↓ (Apps Script: 毎時自動転記)
求職者スプシ更新
    ↓ (Apps Script: onEdit)
フェーズ変更検知
    ↓ (Apps Script: Slack/Gmail)
CA即時通知
    ↓ (Apps Script: 毎日23:00)
HubSpot同期
    ↓ (HubSpot: メールシーケンス)
自動ナーチャリング
\`\`\`
`;
}
