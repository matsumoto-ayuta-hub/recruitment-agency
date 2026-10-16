# Recruitment Agency - Referral Nurturing Platform

## 概要
リファラルナーチャリング特化型の採用エージェントプラットフォーム。
温度感の高い求職者（高決定率）の流入を50%に引き上げることを目標とする。

## システム構成

```
recruitment-agency/
├── apps/
│   ├── ca-media/          # CA個人メディアプラットフォーム
│   ├── chatbot/           # AIカウンセリングチャットボット
│   ├── dashboard/         # 管理ダッシュボード（松本氏確認用）
│   └── niche-launcher/    # ニッチサービス自動ローンチシステム
├── packages/
│   ├── llmo-engine/       # LLMO最適化エンジン
│   ├── lead-scorer/       # リード温度スコアリング
│   └── persona-generator/ # ペルソナ生成エンジン
├── automation/            # 自動化スクリプト
└── .github/workflows/     # CI/CD・定期実行
```

## 自動化フロー（ClaudeCode代替フロー）

| フェーズ | 担当 | 内容 |
|---------|------|------|
| ペルソナ生成 | Claude Code | 日次・新規ニッチペルソナ自動生成 |
| コンテンツ作成 | Claude Code | LLMO最適化記事・ランディングページ自動生成 |
| リードスコアリング | Claude Code | 温度感スコア算出・セグメント分類 |
| ナーチャリング配信 | Claude Code | メール・チャットシナリオ自動送信 |
| アンケート分析 | Claude Code | 面談アンケート数値化・インサイト抽出 |
| レポーティング | Claude Code | KPIダッシュボード更新 |
| **最終決定** | **松本氏** | **サービスローンチ承認・戦略承認** |

## クイックスタート

```bash
npm install
npm run dev
```

## KPI目標
- 高温度感求職者比率: 50%（現状 → 目標）
- CA個人メディア月間PV: 10,000+
- AIチャットボット解決率: 70%+
- 新規ニッチサービス: 毎日1件自動ローンチ
