/**
 * リード温度感スコアリングエンジン
 * 求職者の行動・属性からコンバージョン確率を算出
 */

export interface JobSeekerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: Date;
  source: LeadSource;
  attributes: SeekerAttributes;
  behaviors: BehaviorEvent[];
  surveyResponses?: SurveyResponse[];
  chatbotInteractions?: ChatbotInteraction[];
}

export type LeadSource =
  | "referral"
  | "ca_media"
  | "chatbot"
  | "niche_landing"
  | "organic"
  | "paid";

export interface SeekerAttributes {
  age?: number;
  currentStatus: "employed" | "unemployed" | "student" | "other";
  education?: "junior_high" | "high_school" | "vocational" | "college" | "university" | "graduate";
  targetJobCategory?: string;
  targetRegion?: string;
  urgency?: "immediate" | "within_month" | "within_3months" | "exploratory";
  incomeExpectation?: number;
  yearsOfExperience?: number;
  hasDisability?: boolean;
  foreignNational?: boolean;
}

export interface BehaviorEvent {
  type:
    | "page_view"
    | "article_read"
    | "survey_complete"
    | "chatbot_session"
    | "ca_profile_view"
    | "job_apply"
    | "interview_booked"
    | "referral_sent"
    | "email_open"
    | "email_click";
  timestamp: Date;
  metadata?: Record<string, unknown>;
  durationSeconds?: number;
}

export interface SurveyResponse {
  surveyId: string;
  completedAt: Date;
  answers: Record<string, string | number | boolean>;
  satisfactionScore?: number;
  urgencyScore?: number;
  clarityScore?: number;
}

export interface ChatbotInteraction {
  sessionId: string;
  startedAt: Date;
  messageCount: number;
  resolvedIssue: boolean;
  escalatedToCA: boolean;
  topics: string[];
}

export interface LeadScore {
  seekerId: string;
  totalScore: number;
  temperature: "hot" | "warm" | "cold";
  conversionProbability: number;
  breakdown: ScoreBreakdown;
  recommendedAction: RecommendedAction;
  calculatedAt: Date;
}

export interface ScoreBreakdown {
  behaviorScore: number;
  attributeScore: number;
  engagementScore: number;
  urgencyScore: number;
  sourceScore: number;
  recencyScore: number;
}

export interface RecommendedAction {
  priority: "immediate" | "today" | "this_week" | "nurture";
  action: string;
  assignedCA?: string;
  channel: "phone" | "email" | "chatbot" | "in_app";
  message?: string;
}

export class LeadScorer {
  private readonly HOT_THRESHOLD = 70;
  private readonly WARM_THRESHOLD = 40;

  score(profile: JobSeekerProfile): LeadScore {
    const breakdown: ScoreBreakdown = {
      behaviorScore: this.scoreBehaviors(profile.behaviors),
      attributeScore: this.scoreAttributes(profile.attributes),
      engagementScore: this.scoreEngagement(profile),
      urgencyScore: this.scoreUrgency(profile),
      sourceScore: this.scoreSource(profile.source),
      recencyScore: this.scoreRecency(profile.behaviors),
    };

    const totalScore = Math.min(
      100,
      breakdown.behaviorScore +
        breakdown.attributeScore +
        breakdown.engagementScore +
        breakdown.urgencyScore +
        breakdown.sourceScore +
        breakdown.recencyScore
    );

    const temperature = this.classify(totalScore);
    const conversionProbability = this.estimateConversionProbability(totalScore, profile);

    return {
      seekerId: profile.id,
      totalScore,
      temperature,
      conversionProbability,
      breakdown,
      recommendedAction: this.recommend(temperature, profile),
      calculatedAt: new Date(),
    };
  }

  private scoreBehaviors(events: BehaviorEvent[]): number {
    const weights: Record<BehaviorEvent["type"], number> = {
      interview_booked: 25,
      job_apply: 20,
      survey_complete: 12,
      chatbot_session: 8,
      ca_profile_view: 6,
      article_read: 4,
      email_click: 3,
      email_open: 2,
      page_view: 1,
      referral_sent: 15,
    };

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let score = 0;

    for (const event of events) {
      const weight = weights[event.type] ?? 1;
      const recencyBoost = event.timestamp > recentCutoff ? 1.5 : 1.0;
      score += weight * recencyBoost;
    }

    return Math.min(35, score);
  }

  private scoreAttributes(attrs: SeekerAttributes): number {
    let score = 0;

    const urgencyPoints: Record<string, number> = {
      immediate: 20,
      within_month: 15,
      within_3months: 8,
      exploratory: 2,
    };
    if (attrs.urgency) score += urgencyPoints[attrs.urgency] ?? 0;

    if (attrs.currentStatus === "unemployed") score += 8;
    if (attrs.targetJobCategory) score += 4;
    if (attrs.targetRegion) score += 3;
    if (attrs.yearsOfExperience !== undefined) score += 3;

    return Math.min(25, score);
  }

  private scoreEngagement(profile: JobSeekerProfile): number {
    let score = 0;

    if (profile.surveyResponses?.length) {
      const avgSatisfaction =
        profile.surveyResponses.reduce((s, r) => s + (r.satisfactionScore ?? 0), 0) /
        profile.surveyResponses.length;
      score += Math.round(avgSatisfaction * 2);
    }

    if (profile.chatbotInteractions?.length) {
      const escalated = profile.chatbotInteractions.filter((i) => i.escalatedToCA).length;
      score += escalated * 5;
      score += Math.min(10, profile.chatbotInteractions.length * 2);
    }

    return Math.min(20, score);
  }

  private scoreUrgency(profile: JobSeekerProfile): number {
    const surveyUrgency = profile.surveyResponses?.reduce(
      (max, r) => Math.max(max, r.urgencyScore ?? 0),
      0
    ) ?? 0;
    return Math.min(10, surveyUrgency);
  }

  private scoreSource(source: LeadSource): number {
    const sourcePoints: Record<LeadSource, number> = {
      referral: 10,
      chatbot: 7,
      ca_media: 6,
      niche_landing: 5,
      organic: 3,
      paid: 2,
    };
    return sourcePoints[source];
  }

  private scoreRecency(events: BehaviorEvent[]): number {
    if (!events.length) return 0;
    const latest = Math.max(...events.map((e) => e.timestamp.getTime()));
    const hoursSince = (Date.now() - latest) / (1000 * 60 * 60);
    if (hoursSince < 24) return 10;
    if (hoursSince < 72) return 7;
    if (hoursSince < 168) return 4;
    return 1;
  }

  private classify(score: number): "hot" | "warm" | "cold" {
    if (score >= this.HOT_THRESHOLD) return "hot";
    if (score >= this.WARM_THRESHOLD) return "warm";
    return "cold";
  }

  private estimateConversionProbability(score: number, _profile: JobSeekerProfile): number {
    const base = score / 100;
    return Math.round(base * base * 100) / 100;
  }

  private recommend(temperature: "hot" | "warm" | "cold", profile: JobSeekerProfile): RecommendedAction {
    if (temperature === "hot") {
      return {
        priority: "immediate",
        action: "即座にCA電話フォロー — 面談日程を当日中に確定",
        channel: "phone",
        message: `${profile.name}様、本日中にご連絡させてください`,
      };
    }
    if (temperature === "warm") {
      return {
        priority: "today",
        action: "パーソナライズドメール送信 + チャットボット誘導",
        channel: "email",
        message: `${profile.name}様のご状況に合わせた求人情報をお届けします`,
      };
    }
    return {
      priority: "nurture",
      action: "ニッチメディア記事配信 + ウィークリーニュースレター登録",
      channel: "email",
    };
  }

  batchScore(profiles: JobSeekerProfile[]): LeadScore[] {
    return profiles
      .map((p) => this.score(p))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  getHotLeads(profiles: JobSeekerProfile[]): LeadScore[] {
    return this.batchScore(profiles).filter((s) => s.temperature === "hot");
  }
}

export const scorer = new LeadScorer();
