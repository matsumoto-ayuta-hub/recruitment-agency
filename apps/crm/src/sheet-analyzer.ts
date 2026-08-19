/**
 * 既存スプレッドシートのデータ分析
 * 現状のKPIと改善ポイントを自動分析
 */

export interface SeekerRecord {
  name: string;
  phone: string;
  age: number;
  currentAddress: string;
  targetRegion: string;
  currentJob: string;
  workExperience: string;
  education: string;
  targetJob: string;
  urgency: string;
  registeredAt: Date;
  interviewDate?: Date;
  assignedCA: string;
  leadSource: string;
  phase: string;
  memo: string;
  interviewDone: boolean;
  approved: boolean;
  rejectionReason: string;
  month: string;
}

export interface SheetAnalysis {
  totalRecords: number;
  activeRecords: number;
  byPhase: Record<string, number>;
  byCA: Record<string, { total: number; approved: number; dropout: number }>;
  byLeadSource: Record<string, { total: number; approved: number }>;
  byUrgency: Record<string, number>;
  approvalRate: number;
  dropoutRate: number;
  avgDaysToInterview: number;
  hotLeads: SeekerRecord[];
  insights: string[];
}

// スプシデータの列マッピング（実際のスプシに合わせて調整）
const COLUMN_MAP = {
  checked: 0,
  name: 1,
  furigana: 2,
  phone: 3,
  age: 4,
  currentAddress: 5,
  targetRegion: 6,
  currentJob: 7,
  workExperience: 8,
  education: 9,
  targetJob: 10,
  urgency: 11,
  registeredAt: 12,
  interviewDate: 13,
  assignedCA: 14,
  leadSource: 15,
  phase: 16,
  memo: 17,
  interviewDone: 18,
  approved: 19,
  rejectionReason: 20,
  month: 21,
};

export function parseSheetData(rawRows: unknown[][]): SeekerRecord[] {
  return rawRows
    .filter((row) => row[COLUMN_MAP.name])
    .map((row) => ({
      name: String(row[COLUMN_MAP.name] ?? ""),
      phone: String(row[COLUMN_MAP.phone] ?? ""),
      age: Number(row[COLUMN_MAP.age]) || 0,
      currentAddress: String(row[COLUMN_MAP.currentAddress] ?? ""),
      targetRegion: String(row[COLUMN_MAP.targetRegion] ?? ""),
      currentJob: String(row[COLUMN_MAP.currentJob] ?? ""),
      workExperience: String(row[COLUMN_MAP.workExperience] ?? ""),
      education: String(row[COLUMN_MAP.education] ?? ""),
      targetJob: String(row[COLUMN_MAP.targetJob] ?? ""),
      urgency: String(row[COLUMN_MAP.urgency] ?? ""),
      registeredAt: row[COLUMN_MAP.registeredAt]
        ? new Date(String(row[COLUMN_MAP.registeredAt]))
        : new Date(),
      interviewDate: row[COLUMN_MAP.interviewDate]
        ? new Date(String(row[COLUMN_MAP.interviewDate]))
        : undefined,
      assignedCA: String(row[COLUMN_MAP.assignedCA] ?? ""),
      leadSource: String(row[COLUMN_MAP.leadSource] ?? ""),
      phase: String(row[COLUMN_MAP.phase] ?? ""),
      memo: String(row[COLUMN_MAP.memo] ?? ""),
      interviewDone: row[COLUMN_MAP.interviewDone] === "〇",
      approved: row[COLUMN_MAP.approved] === "〇",
      rejectionReason: String(row[COLUMN_MAP.rejectionReason] ?? ""),
      month: String(row[COLUMN_MAP.month] ?? ""),
    }));
}

export function analyzeSheet(records: SeekerRecord[]): SheetAnalysis {
  const active = records.filter(
    (r) => r.phase !== "その他離脱" && r.phase !== "求人紹介不可"
  );

  const byPhase = groupBy(records, (r) => r.phase || "未設定");
  const byCA: Record<string, { total: number; approved: number; dropout: number }> = {};
  const byLeadSource: Record<string, { total: number; approved: number }> = {};
  const byUrgency = groupBy(records, (r) => r.urgency || "未設定");

  for (const r of records) {
    const ca = r.assignedCA || "未割当";
    if (!byCA[ca]) byCA[ca] = { total: 0, approved: 0, dropout: 0 };
    byCA[ca].total++;
    if (r.approved) byCA[ca].approved++;
    if (r.phase === "その他離脱") byCA[ca].dropout++;

    const src = r.leadSource || "不明";
    if (!byLeadSource[src]) byLeadSource[src] = { total: 0, approved: 0 };
    byLeadSource[src].total++;
    if (r.approved) byLeadSource[src].approved++;
  }

  const interviewDoneRecords = records.filter((r) => r.interviewDone && r.interviewDate);
  const avgDaysToInterview =
    interviewDoneRecords.length > 0
      ? interviewDoneRecords.reduce((sum, r) => {
          const days =
            (r.interviewDate!.getTime() - r.registeredAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0) / interviewDoneRecords.length
      : 0;

  const approved = records.filter((r) => r.approved).length;
  const dropout = records.filter((r) => r.phase === "その他離脱").length;
  const withInterview = records.filter((r) => r.interviewDone);

  const hotLeads = active.filter((r) => {
    return r.urgency === "今すぐ" || r.urgency === "1~2ヶ月以内";
  });

  const insights = generateInsights(records, byCA, byLeadSource, hotLeads);

  return {
    totalRecords: records.length,
    activeRecords: active.length,
    byPhase,
    byCA,
    byLeadSource,
    byUrgency,
    approvalRate: withInterview.length > 0 ? approved / withInterview.length : 0,
    dropoutRate: records.length > 0 ? dropout / records.length : 0,
    avgDaysToInterview: Math.round(avgDaysToInterview),
    hotLeads,
    insights,
  };
}

function generateInsights(
  records: SeekerRecord[],
  byCA: SheetAnalysis["byCA"],
  byLeadSource: SheetAnalysis["byLeadSource"],
  hotLeads: SeekerRecord[]
): string[] {
  const insights: string[] = [];

  // 承認率分析
  const withInterview = records.filter((r) => r.interviewDone);
  const approvalRate = withInterview.length > 0
    ? records.filter((r) => r.approved).length / withInterview.length
    : 0;
  if (approvalRate < 0.7) {
    insights.push(
      `⚠️ 承認率が${Math.round(approvalRate * 100)}%と低め。否認理由の上位を確認し、面談前スクリーニングを強化を検討。`
    );
  }

  // CA別分析
  const caEntries = Object.entries(byCA);
  if (caEntries.length > 0) {
    const topCA = caEntries.sort((a, b) => b[1].approved - a[1].approved)[0];
    const botCA = caEntries.sort((a, b) => {
      const rateA = a[1].total > 0 ? a[1].approved / a[1].total : 0;
      const rateB = b[1].total > 0 ? b[1].approved / b[1].total : 0;
      return rateA - rateB;
    })[0];
    insights.push(`✅ 承認数トップ: ${topCA[0]}（${topCA[1].approved}件）`);
    if (botCA[0] !== topCA[0]) {
      const rate = botCA[1].total > 0
        ? Math.round(botCA[1].approved / botCA[1].total * 100)
        : 0;
      insights.push(`💡 ${botCA[0]}の承認率${rate}% — トップCAの手法を横展開できるか確認。`);
    }
  }

  // リード元分析
  const srcEntries = Object.entries(byLeadSource);
  if (srcEntries.length > 0) {
    const bestSrc = srcEntries
      .filter(([, v]) => v.total >= 3)
      .sort((a, b) => b[1].approved / b[1].total - a[1].approved / a[1].total)[0];
    if (bestSrc) {
      insights.push(
        `📊 最高承認率リード元: ${bestSrc[0]}（${Math.round(bestSrc[1].approved / bestSrc[1].total * 100)}%）— このチャネルへの投資増を推奨。`
      );
    }
  }

  // Hot求職者アラート
  if (hotLeads.length > 0) {
    insights.push(`🔴 Hot求職者 ${hotLeads.length}名が対応待ち — 本日中に連絡を。`);
  }

  // 年齢分析
  const youngSeekersCount = records.filter((r) => r.age >= 17 && r.age <= 28).length;
  if (youngSeekersCount / records.length > 0.6) {
    insights.push(`👥 登録者の${Math.round(youngSeekersCount/records.length*100)}%が28歳以下。若年層向けコンテンツ強化でリファラルを増やせる可能性あり。`);
  }

  return insights;
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

export function printAnalysis(analysis: SheetAnalysis): string {
  const date = new Date().toLocaleDateString("ja-JP");
  const { byCA, byLeadSource } = analysis;

  const caReport = Object.entries(byCA)
    .map(([ca, s]) => {
      const rate = s.total > 0 ? Math.round(s.approved / s.total * 100) : 0;
      return `  ${ca}: 面談${s.total}件 / 承認${s.approved}件 (${rate}%) / 離脱${s.dropout}件`;
    })
    .join("\n");

  const srcReport = Object.entries(byLeadSource)
    .map(([src, s]) => {
      const rate = s.total > 0 ? Math.round(s.approved / s.total * 100) : 0;
      return `  ${src}: ${s.total}件 / 承認率${rate}%`;
    })
    .join("\n");

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 求職者スプシ分析レポート — ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
総登録数: ${analysis.totalRecords}名
アクティブ: ${analysis.activeRecords}名
承認率: ${Math.round(analysis.approvalRate * 100)}%
離脱率: ${Math.round(analysis.dropoutRate * 100)}%
平均面談設定日数: ${analysis.avgDaysToInterview}日

🌡️ 温度感 (緊急度ベース)
  Hot (今すぐ/1〜2ヶ月): ${analysis.hotLeads.length}名
  現在Hot比率: ${Math.round(analysis.hotLeads.length / analysis.activeRecords * 100)}%
  目標: 50%

👥 CA別実績
${caReport}

📡 リード元別
${srcReport}

💡 インサイト
${analysis.insights.map((i) => `  ${i}`).join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
