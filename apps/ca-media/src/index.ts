/**
 * CA個人メディアプラットフォーム
 * 各キャリアアドバイザーの個人ブランド構築を支援
 * 記事・アンケート・面談実績の数値化でリファラル流入を強化
 */

export interface CAProfile {
  id: string;
  name: string;
  email: string;
  specialty: string[];
  region: string[];
  bio: string;
  profileImageUrl?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  stats: CAStats;
  createdAt: Date;
}

export interface CAStats {
  totalPlacements: number;
  successRate: number;
  avgTimeToPlacement: number;
  satisfactionScore: number;
  articleCount: number;
  totalArticleViews: number;
  referralCount: number;
  referralConversionRate: number;
}

export interface Article {
  id: string;
  caId: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string[];
  targetPersona: string[];
  llmoOptimized: boolean;
  publishedAt?: Date;
  status: "draft" | "review" | "published";
  metrics: ArticleMetrics;
}

export interface ArticleMetrics {
  views: number;
  avgReadTime: number;
  conversionRate: number;
  referrals: number;
  shares: number;
  comments: number;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  targetStage: "pre_interview" | "post_interview" | "post_placement" | "nurturing";
  questions: SurveyQuestion[];
  scoringWeights: Record<string, number>;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: "scale" | "multiple_choice" | "text" | "yes_no";
  options?: string[];
  scalesFrom?: number;
  scalesTo?: number;
  scoresUrgency?: boolean;
  scoresSatisfaction?: boolean;
}

export interface SurveyResponse {
  id: string;
  templateId: string;
  seekerId: string;
  caId: string;
  completedAt: Date;
  answers: Record<string, string | number | boolean>;
  computedScores: {
    urgency: number;
    satisfaction: number;
    clarity: number;
    overall: number;
  };
  insights: string[];
}

export class CAMediaService {
  computeSurveyScores(
    response: Omit<SurveyResponse, "computedScores" | "insights">,
    template: SurveyTemplate
  ): SurveyResponse {
    let urgencyScore = 0;
    let satisfactionScore = 0;
    let clarityScore = 0;
    let urgencyCount = 0;
    let satisfactionCount = 0;
    let clarityCount = 0;

    for (const question of template.questions) {
      const answer = response.answers[question.id];
      if (answer === undefined) continue;

      const numericValue = typeof answer === "number" ? answer : 0;

      if (question.scoresUrgency) {
        urgencyScore += numericValue;
        urgencyCount++;
      }
      if (question.scoresSatisfaction) {
        satisfactionScore += numericValue;
        satisfactionCount++;
      }
      if (!question.scoresUrgency && !question.scoresSatisfaction && typeof answer === "number") {
        clarityScore += numericValue;
        clarityCount++;
      }
    }

    const normalize = (sum: number, count: number, max: number) =>
      count > 0 ? Math.round((sum / (count * max)) * 10) : 5;

    const computed = {
      urgency: normalize(urgencyScore, urgencyCount, 10),
      satisfaction: normalize(satisfactionScore, satisfactionCount, 10),
      clarity: normalize(clarityScore, clarityCount, 10),
      overall: 0,
    };
    computed.overall = Math.round((computed.urgency + computed.satisfaction + computed.clarity) / 3);

    const insights = this.generateInsights(computed, response.answers, template);

    return { ...response, computedScores: computed, insights };
  }

  private generateInsights(
    scores: SurveyResponse["computedScores"],
    answers: Record<string, string | number | boolean>,
    _template: SurveyTemplate
  ): string[] {
    const insights: string[] = [];

    if (scores.urgency >= 8) {
      insights.push("🔴 緊急度高: 24時間以内にCA連絡を推奨");
    } else if (scores.urgency >= 5) {
      insights.push("🟡 緊急度中: 3日以内のフォローを推奨");
    }

    if (scores.satisfaction <= 4) {
      insights.push("⚠️ 満足度低: チャットボット or CAによる追加ヒアリングが必要");
    }

    if (scores.clarity <= 4) {
      insights.push("💭 方向性不明: キャリア棚卸しワークシートを送付推奨");
    }

    if (scores.urgency >= 7 && scores.clarity >= 7) {
      insights.push("✅ Hot判定: 即面談設定 → 求人紹介フローを起動");
    }

    return insights;
  }

  calculateCAMetrics(ca: CAProfile, articles: Article[], surveys: SurveyResponse[]): CAStats {
    const totalViews = articles
      .filter((a) => a.caId === ca.id)
      .reduce((s, a) => s + a.metrics.views, 0);
    const avgSatisfaction =
      surveys
        .filter((s) => s.caId === ca.id)
        .reduce((s, r) => s + r.computedScores.satisfaction, 0) /
      Math.max(surveys.filter((s) => s.caId === ca.id).length, 1);

    return {
      ...ca.stats,
      articleCount: articles.filter((a) => a.caId === ca.id).length,
      totalArticleViews: totalViews,
      satisfactionScore: Math.round(avgSatisfaction * 10) / 10,
    };
  }

  generateWeeklyCAReport(ca: CAProfile, articles: Article[], surveys: SurveyResponse[]): string {
    const weekSurveys = surveys.filter(
      (s) =>
        s.caId === ca.id &&
        s.completedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const hotLeadsFromSurvey = weekSurveys.filter((s) => s.computedScores.urgency >= 7);
    const weekArticles = articles.filter(
      (a) => a.caId === ca.id && a.status === "published"
    );

    const date = new Date().toLocaleDateString("ja-JP");
    return `# ${ca.name} 様 週次レポート — ${date}

## 今週のハイライト
- 面談アンケート回答数: ${weekSurveys.length}件
- Hot判定求職者: ${hotLeadsFromSurvey.length}名 ← 即対応推奨
- 公開記事数: ${weekArticles.length}本
- 記事総閲覧数: ${weekArticles.reduce((s, a) => s + a.metrics.views, 0)}PV

## Hot判定求職者（即対応を）
${
  hotLeadsFromSurvey.length === 0
    ? "今週はHot判定なし"
    : hotLeadsFromSurvey
        .map(
          (s) =>
            `- 求職者ID: ${s.seekerId} | 緊急度: ${s.computedScores.urgency}/10 | ${s.insights[0] ?? ""}`
        )
        .join("\n")
}

## アンケートインサイト
${weekSurveys
  .flatMap((s) => s.insights)
  .filter((v, i, arr) => arr.indexOf(v) === i)
  .slice(0, 5)
  .map((i) => `- ${i}`)
  .join("\n") || "インサイトなし"}

## 記事パフォーマンス
${
  weekArticles.length === 0
    ? "今週は公開記事なし"
    : weekArticles
        .map(
          (a) =>
            `- 「${a.title}」: ${a.metrics.views}PV | 転換率: ${(a.metrics.conversionRate * 100).toFixed(1)}%`
        )
        .join("\n")
}

## 推奨アクション
1. Hot判定の${hotLeadsFromSurvey.length}名に本日中に連絡
2. 先週最もPVが多かった記事のフォローアップ記事を執筆
3. 来週の新規面談に向けてアンケート送付を${weekSurveys.length < 5 ? "増やす（今週は少なめ）" : "継続"}
`;
  }
}

export const defaultSurveyTemplate: SurveyTemplate = {
  id: "initial-consultation",
  name: "初回面談前アンケート",
  targetStage: "pre_interview",
  questions: [
    {
      id: "current_status",
      text: "現在の就業状況を教えてください",
      type: "multiple_choice",
      options: ["在職中（転職活動中）", "離職中（求職中）", "在学中", "その他"],
    },
    {
      id: "urgency",
      text: "転職・就職の緊急度（1: じっくり検討 〜 10: 今すぐ動きたい）",
      type: "scale",
      scalesFrom: 1,
      scalesTo: 10,
      scoresUrgency: true,
    },
    {
      id: "target_job",
      text: "希望職種・業種を教えてください",
      type: "text",
    },
    {
      id: "region",
      text: "希望勤務地はありますか？",
      type: "text",
    },
    {
      id: "income_change",
      text: "年収アップを希望していますか？",
      type: "yes_no",
    },
    {
      id: "worry",
      text: "転職・就職で最も不安なことは何ですか？",
      type: "multiple_choice",
      options: ["書類選考", "面接対策", "職種選び", "収入", "職場環境", "その他"],
    },
    {
      id: "satisfaction",
      text: "このサービスへの期待度（1〜10）",
      type: "scale",
      scalesFrom: 1,
      scalesTo: 10,
      scoresSatisfaction: true,
    },
  ],
  scoringWeights: {
    urgency: 0.4,
    satisfaction: 0.3,
    clarity: 0.3,
  },
};

export const caMediaService = new CAMediaService();
