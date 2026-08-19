/**
 * ナーチャリングパイプライン自動実行スクリプト
 * 求職者の温度感に基づいて、最適なタイミングで最適なコンテンツを配信
 * 高温度感（Hot）求職者比率を50%まで引き上げる
 */

import { LeadScorer, type JobSeekerProfile, type LeadScore } from "../packages/lead-scorer/src/index.js";
import * as fs from "fs";

interface NurturingAction {
  seekerId: string;
  seekerName: string;
  temperature: "hot" | "warm" | "cold";
  score: number;
  action: string;
  channel: string;
  scheduledAt: Date;
  executed: boolean;
}

interface PipelineReport {
  runAt: Date;
  totalProcessed: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  hotRatio: number;
  actions: NurturingAction[];
  kpiStatus: KPIStatus;
  recommendations: string[];
}

interface KPIStatus {
  target: 0.5;
  current: number;
  gap: number;
  onTrack: boolean;
  projectedWeeksToTarget: number;
}

const scorer = new LeadScorer();

async function runNurturingPipeline(): Promise<void> {
  console.log("=== ナーチャリングパイプライン開始 ===");

  const profiles = loadJobSeekerProfiles();
  console.log(`処理対象求職者: ${profiles.length}名`);

  const scores = scorer.batchScore(profiles);

  const hot = scores.filter((s) => s.temperature === "hot");
  const warm = scores.filter((s) => s.temperature === "warm");
  const cold = scores.filter((s) => s.temperature === "cold");

  const hotRatio = hot.length / Math.max(scores.length, 1);

  console.log(`\n📊 温度感分布:`);
  console.log(`  Hot (高): ${hot.length}名 (${Math.round(hotRatio * 100)}%)`);
  console.log(`  Warm (中): ${warm.length}名 (${Math.round((warm.length / scores.length) * 100)}%)`);
  console.log(`  Cold (低): ${cold.length}名 (${Math.round((cold.length / scores.length) * 100)}%)`);

  const actions: NurturingAction[] = [];

  for (const score of hot) {
    const profile = profiles.find((p) => p.id === score.seekerId)!;
    actions.push({
      seekerId: score.seekerId,
      seekerName: profile.name,
      temperature: "hot",
      score: score.totalScore,
      action: score.recommendedAction.action,
      channel: score.recommendedAction.channel,
      scheduledAt: new Date(),
      executed: false,
    });
  }

  for (const score of warm.slice(0, 20)) {
    const profile = profiles.find((p) => p.id === score.seekerId)!;
    actions.push({
      seekerId: score.seekerId,
      seekerName: profile.name,
      temperature: "warm",
      score: score.totalScore,
      action: score.recommendedAction.action,
      channel: score.recommendedAction.channel,
      scheduledAt: getScheduledTime("today"),
      executed: false,
    });
  }

  const coldToNurture = cold.filter((s) => s.totalScore > 20).slice(0, 50);
  for (const score of coldToNurture) {
    const profile = profiles.find((p) => p.id === score.seekerId)!;
    actions.push({
      seekerId: score.seekerId,
      seekerName: profile.name,
      temperature: "cold",
      score: score.totalScore,
      action: "週次ニュースレター + ニッチメディア記事配信",
      channel: "email",
      scheduledAt: getScheduledTime("this_week"),
      executed: false,
    });
  }

  const kpiStatus: KPIStatus = {
    target: 0.5,
    current: hotRatio,
    gap: 0.5 - hotRatio,
    onTrack: hotRatio >= 0.4,
    projectedWeeksToTarget: hotRatio >= 0.5 ? 0 : Math.ceil((0.5 - hotRatio) / 0.02),
  };

  const recommendations = generateRecommendations(scores, kpiStatus, profiles);

  const report: PipelineReport = {
    runAt: new Date(),
    totalProcessed: profiles.length,
    hotLeads: hot.length,
    warmLeads: warm.length,
    coldLeads: cold.length,
    hotRatio,
    actions,
    kpiStatus,
    recommendations,
  };

  saveReport(report);
  printReport(report);
}

function generateRecommendations(
  scores: LeadScore[],
  kpi: KPIStatus,
  profiles: JobSeekerProfile[]
): string[] {
  const recs: string[] = [];

  if (kpi.gap > 0.2) {
    recs.push(
      "🔴 Hot比率が目標から大幅に乖離。リファラル経由・CA個人メディア経由の流入強化が急務。"
    );
  }

  const referralProfiles = profiles.filter((p) => p.source === "referral");
  const referralScores = scores.filter((s) =>
    referralProfiles.some((p) => p.id === s.seekerId)
  );
  const referralHotRatio =
    referralScores.filter((s) => s.temperature === "hot").length /
    Math.max(referralScores.length, 1);
  if (referralHotRatio > 0.6) {
    recs.push(
      `✅ リファラル経由のHot率: ${Math.round(referralHotRatio * 100)}% — リファラル流入をさらに増加させる施策を優先。`
    );
  }

  const noSurveyProfiles = profiles.filter((p) => !p.surveyResponses?.length);
  if (noSurveyProfiles.length > profiles.length * 0.4) {
    recs.push(
      `📋 アンケート未回答者: ${noSurveyProfiles.length}名 — チャットボット経由でアンケート誘導を強化し温度感データを収集。`
    );
  }

  const chatbotProfiles = profiles.filter((p) => p.chatbotInteractions?.length);
  const chatbotEscalated = chatbotProfiles.filter((p) =>
    p.chatbotInteractions?.some((i) => i.escalatedToCA)
  );
  if (chatbotEscalated.length > 0) {
    recs.push(
      `🤖 チャットボットからCA引き継ぎ: ${chatbotEscalated.length}名 — 本日中に優先連絡を。`
    );
  }

  recs.push(
    `📅 次の施策: 本日のニッチサービスローンチページへの流入を${scores.filter((s) => s.temperature === "cold").length}名のCold層にメール配信。`
  );

  return recs;
}

function loadJobSeekerProfiles(): JobSeekerProfile[] {
  const dataPath = "./data/job-seekers.json";
  if (fs.existsSync(dataPath)) {
    const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    return raw.map((p: JobSeekerProfile) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      behaviors: p.behaviors.map((b) => ({ ...b, timestamp: new Date(b.timestamp) })),
    }));
  }

  return generateSampleProfiles();
}

function generateSampleProfiles(): JobSeekerProfile[] {
  const now = new Date();
  const profiles: JobSeekerProfile[] = [];

  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    profiles.push({
      id: `seeker-${i.toString().padStart(3, "0")}`,
      name: `求職者${i + 1}`,
      email: `seeker${i + 1}@example.com`,
      createdAt,
      source: (["referral", "ca_media", "chatbot", "niche_landing", "organic", "paid"] as const)[
        i % 6
      ],
      attributes: {
        currentStatus: (["employed", "unemployed", "student"] as const)[i % 3],
        urgency: (["immediate", "within_month", "within_3months", "exploratory"] as const)[i % 4],
        targetJobCategory: ["エンジニア", "営業", "介護士", "ドライバー"][i % 4],
        targetRegion: ["東京", "大阪", "愛知", "福岡"][i % 4],
      },
      behaviors: generateSampleBehaviors(i, createdAt),
      surveyResponses:
        i % 3 === 0
          ? [
              {
                surveyId: "initial-survey",
                completedAt: createdAt,
                answers: { urgency: "high", jobType: "fulltime" },
                satisfactionScore: 4 + (i % 2),
                urgencyScore: 5 + (i % 5),
                clarityScore: 7,
              },
            ]
          : [],
      chatbotInteractions:
        i % 4 === 0
          ? [
              {
                sessionId: `chat-${i}`,
                startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
                messageCount: 8 + (i % 10),
                resolvedIssue: i % 2 === 0,
                escalatedToCA: i % 5 === 0,
                topics: ["給与", "職種", "勤務地"],
              },
            ]
          : [],
    });
  }

  return profiles;
}

function generateSampleBehaviors(
  index: number,
  createdAt: Date
): JobSeekerProfile["behaviors"] {
  const types: JobSeekerProfile["behaviors"][0]["type"][] = [
    "page_view",
    "article_read",
    "survey_complete",
    "ca_profile_view",
    "email_open",
  ];
  const now = new Date();
  const count = 1 + (index % 8);

  return Array.from({ length: count }, (_, j) => ({
    type: types[(index + j) % types.length],
    timestamp: new Date(
      createdAt.getTime() + j * 24 * 60 * 60 * 1000 + Math.random() * 8 * 60 * 60 * 1000
    ),
    durationSeconds: 30 + Math.floor(Math.random() * 300),
  })).filter((b) => b.timestamp <= now);
}

function getScheduledTime(timing: "now" | "today" | "this_week"): Date {
  const now = new Date();
  if (timing === "now") return now;
  if (timing === "today") {
    const d = new Date(now);
    d.setHours(14, 0, 0, 0);
    return d;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 3);
  d.setHours(10, 0, 0, 0);
  return d;
}

function saveReport(report: PipelineReport): void {
  const dir = "./reports";
  fs.mkdirSync(dir, { recursive: true });
  const filename = `nurturing-${report.runAt.toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(`${dir}/${filename}`, JSON.stringify(report, null, 2));
  console.log(`\nレポート保存: ${dir}/${filename}`);
}

function printReport(report: PipelineReport): void {
  const { kpiStatus: kpi } = report;
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ナーチャリングパイプライン実行結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
実行日時: ${report.runAt.toLocaleString("ja-JP")}
処理求職者数: ${report.totalProcessed}名

🌡️ 温度感KPI
  目標Hot比率: 50%
  現在Hot比率: ${Math.round(kpi.current * 100)}%
  ギャップ: ${Math.round(kpi.gap * 100)}%
  状況: ${kpi.onTrack ? "✅ 順調" : "⚠️ 要施策強化"}
  ${kpi.gap > 0 ? `目標達成予測: 約${kpi.projectedWeeksToTarget}週間後` : "目標達成中"}

🎯 本日のアクション (${report.actions.length}件)
  Hot対応: ${report.hotLeads}件（即時）
  Warm対応: ${report.warmLeads}件（本日中）
  Cold育成: ${report.actions.filter((a) => a.temperature === "cold").length}件（今週中）

💡 推奨施策
${report.recommendations.map((r) => `  ${r}`).join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

runNurturingPipeline().catch(console.error);
