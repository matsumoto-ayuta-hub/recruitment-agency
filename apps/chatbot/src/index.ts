/**
 * AIカウンセリングチャットボット
 * Claude APIを使用した求職者向け悩み相談・CS向上システム
 * - 24時間対応の初期カウンセリング
 * - 温度感スコアリングのためのデータ収集
 * - 高温度感ユーザーをCAへ自動エスカレーション
 */

import Anthropic from "@anthropic-ai/sdk";
import { scorer, type JobSeekerProfile } from "../../packages/lead-scorer/src/index.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `あなたはCareerJapanのキャリアカウンセラーAIアシスタント「ジョブちゃん」です。
求職者の転職・就職に関する悩みを親身に聞き、解決に導くことが使命です。

## あなたの役割
- 求職者の現状・不安・希望を丁寧にヒアリング
- 転職・就職に関する一般的なアドバイスを提供
- 具体的な求人紹介や詳細な個別サポートが必要な場合は、人間のCAへ引き継ぐ
- ユーザーの温度感・緊急度を会話から判断し記録

## 会話スタイル
- 敬語を使いつつも、親しみやすいトーンで
- 相手の感情に共感しながら、前向きな方向へ誘導
- 専門用語は避け、分かりやすい言葉で説明
- 1メッセージは200字以内に収める（長すぎると読みにくい）

## 引き継ぎ判断基準
以下の場合は必ず「人間のCAへの引き継ぎ」を提案してください：
- 「今すぐ転職したい」「来月には転職したい」など緊急性が高い
- 給与・条件の具体的な交渉が必要
- 書類作成・面接練習の個別サポートが必要
- 3回以上の往復でも解決しない複雑な悩み

## 収集すべき情報（自然な会話の中で）
- 現在の状況（在職中/離職中）
- 希望職種・業種
- 希望勤務地
- 転職の緊急度
- 現在の悩み・不安

必ず日本語で回答してください。`;

export interface ChatSession {
  sessionId: string;
  seekerId: string;
  startedAt: Date;
  messages: ChatMessage[];
  extractedProfile: Partial<JobSeekerProfile["attributes"]>;
  urgencySignals: string[];
  escalationRequested: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export class ChatbotService {
  private sessions: Map<string, ChatSession> = new Map();

  createSession(seekerId: string): ChatSession {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const session: ChatSession = {
      sessionId,
      seekerId,
      startedAt: new Date(),
      messages: [],
      extractedProfile: {},
      urgencySignals: [],
      escalationRequested: false,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  async chat(sessionId: string, userMessage: string): Promise<ChatResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`セッションが見つかりません: ${sessionId}`);

    session.messages.push({
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    this.extractSignals(session, userMessage);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const assistantMessage = response.content[0].type === "text" ? response.content[0].text : "";

    session.messages.push({
      role: "assistant",
      content: assistantMessage,
      timestamp: new Date(),
    });

    const shouldEscalate = this.shouldEscalate(session);
    if (shouldEscalate && !session.escalationRequested) {
      session.escalationRequested = true;
    }

    return {
      sessionId,
      message: assistantMessage,
      shouldEscalate,
      escalationReason: shouldEscalate ? this.getEscalationReason(session) : undefined,
      urgencyLevel: this.calculateUrgencyLevel(session),
      messageCount: session.messages.filter((m) => m.role === "user").length,
    };
  }

  private extractSignals(session: ChatSession, message: string): void {
    const urgencyKeywords = [
      "今すぐ",
      "来月",
      "今月",
      "急いで",
      "早めに",
      "すぐにでも",
      "即",
      "早急",
    ];
    const unemployedKeywords = ["離職", "退職", "無職", "仕事がない", "辞めた", "失業"];
    const jobTypePatterns = [
      { pattern: /エンジニア|プログラマー|SE|システム/, category: "IT・エンジニア" },
      { pattern: /営業|セールス/, category: "営業" },
      { pattern: /介護|ヘルパー|福祉/, category: "介護・福祉" },
      { pattern: /ドライバー|運転|配送/, category: "ドライバー" },
      { pattern: /事務|オフィス|バックオフィス/, category: "事務" },
    ];

    for (const kw of urgencyKeywords) {
      if (message.includes(kw) && !session.urgencySignals.includes(kw)) {
        session.urgencySignals.push(kw);
      }
    }

    for (const kw of unemployedKeywords) {
      if (message.includes(kw)) {
        session.extractedProfile.currentStatus = "unemployed";
        break;
      }
    }

    for (const { pattern, category } of jobTypePatterns) {
      if (pattern.test(message) && !session.extractedProfile.targetJobCategory) {
        session.extractedProfile.targetJobCategory = category;
      }
    }

    if (session.urgencySignals.length > 0) {
      session.extractedProfile.urgency = "immediate";
    }
  }

  private shouldEscalate(session: ChatSession): boolean {
    const userMessages = session.messages.filter((m) => m.role === "user").length;
    return (
      session.urgencySignals.length >= 2 ||
      userMessages >= 4 ||
      session.extractedProfile.currentStatus === "unemployed"
    );
  }

  private getEscalationReason(session: ChatSession): string {
    if (session.urgencySignals.length >= 2) {
      return `緊急度が高いシグナルを検出: ${session.urgencySignals.join(", ")}`;
    }
    if (session.extractedProfile.currentStatus === "unemployed") {
      return "離職中のため、優先的な個別サポートが必要";
    }
    return "複数回の対話で詳細なサポートが必要と判断";
  }

  private calculateUrgencyLevel(session: ChatSession): 1 | 2 | 3 | 4 | 5 {
    const signals = session.urgencySignals.length;
    const isUnemployed = session.extractedProfile.currentStatus === "unemployed";
    const messageCount = session.messages.filter((m) => m.role === "user").length;

    let level = 1;
    if (signals >= 1) level = 3;
    if (signals >= 2) level = 4;
    if (isUnemployed) level = Math.max(level, 4) as 1 | 2 | 3 | 4 | 5;
    if (messageCount >= 3 && level >= 3) level = 5;

    return Math.min(5, level) as 1 | 2 | 3 | 4 | 5;
  }

  getSessionSummary(sessionId: string): SessionSummary | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      seekerId: session.seekerId,
      duration: Math.round((Date.now() - session.startedAt.getTime()) / 1000 / 60),
      messageCount: session.messages.filter((m) => m.role === "user").length,
      extractedProfile: session.extractedProfile,
      urgencySignals: session.urgencySignals,
      escalated: session.escalationRequested,
      recommendedAction: session.escalationRequested
        ? "CA即時連絡 — 高温度感ユーザー"
        : "メールフォローアップ",
    };
  }
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  shouldEscalate: boolean;
  escalationReason?: string;
  urgencyLevel: 1 | 2 | 3 | 4 | 5;
  messageCount: number;
}

export interface SessionSummary {
  sessionId: string;
  seekerId: string;
  duration: number;
  messageCount: number;
  extractedProfile: Partial<JobSeekerProfile["attributes"]>;
  urgencySignals: string[];
  escalated: boolean;
  recommendedAction: string;
}

export const chatbot = new ChatbotService();
