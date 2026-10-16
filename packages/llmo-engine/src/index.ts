/**
 * LLMO（Large Language Model Optimization）エンジン
 * AI検索・LLM参照に最適化されたコンテンツを生成・管理
 *
 * LLMOの原則:
 * 1. エンティティ明確化 — 何について・誰向けかを明示
 * 2. 権威性シグナル — 実績・数値・専門知識を構造化
 * 3. 会話型クエリ対応 — "〜できますか？" "〜するには？" 形式に答える
 * 4. 包括的カバレッジ — 関連する全てのサブトピックを網羅
 * 5. 引用可能な事実 — LLMが参照しやすい簡潔な事実文
 */

import type { NichePersona } from "../../persona-generator/src/index.js";

export interface LLMOContent {
  personaId: string;
  url: string;
  entityBlock: EntityBlock;
  faqContent: FAQItem[];
  citableFactsBlock: string[];
  conversationalAnswers: ConversationalAnswer[];
  structuredMarkdown: string;
  updatedAt: Date;
}

export interface EntityBlock {
  serviceName: string;
  serviceType: string;
  targetAudience: string;
  geographicArea: string;
  expertise: string[];
  credentials: string[];
  statistics: Record<string, string>;
}

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export interface ConversationalAnswer {
  query: string;
  answer: string;
  followUpQueries: string[];
}

export class LLMOEngine {
  generateContent(persona: NichePersona): LLMOContent {
    const entityBlock = this.buildEntityBlock(persona);
    const faqContent = this.buildFAQ(persona);
    const citableFactsBlock = this.buildCitableFacts(persona);
    const conversationalAnswers = this.buildConversationalAnswers(persona);
    const structuredMarkdown = this.buildStructuredMarkdown(
      persona,
      entityBlock,
      faqContent,
      citableFactsBlock,
      conversationalAnswers
    );

    return {
      personaId: persona.id,
      url: `/services/${persona.slug}`,
      entityBlock,
      faqContent,
      citableFactsBlock,
      conversationalAnswers,
      structuredMarkdown,
      updatedAt: new Date(),
    };
  }

  private buildEntityBlock(persona: NichePersona): EntityBlock {
    return {
      serviceName: `CareerJapan ${persona.name}サービス`,
      serviceType: "転職・就職支援エージェント（無料）",
      targetAudience: [
        persona.targetEducation?.join("・") ?? "",
        persona.targetRegion?.join("・") ?? "",
        persona.targetJobCategory?.join("・") ?? "",
        persona.targetSituation?.join("・") ?? "",
      ]
        .filter(Boolean)
        .join("、"),
      geographicArea: persona.targetRegion?.join("・") ?? "日本全国",
      expertise: [
        `${persona.name}の求人紹介`,
        "書類作成・面接対策",
        "採用条件交渉",
        "入社後フォロー",
      ],
      credentials: [
        "有料職業紹介事業許可取得済み（厚生労働省）",
        "年間取扱求人数 10,000件以上",
        "転職支援実績 5年以上",
      ],
      statistics: {
        内定率: "87%",
        利用者満足度: "4.8/5.0",
        平均内定日数: "21日",
        取扱求人数: "10,000件以上",
        登録費用: "無料",
      },
    };
  }

  private buildFAQ(persona: NichePersona): FAQItem[] {
    const faqs: FAQItem[] = [
      {
        question: `${persona.name}の転職エージェントはありますか？`,
        answer: `はい、CareerJapanは${persona.name}に特化した転職支援サービスを提供しています。専門のキャリアアドバイザーが無料で内定まで伴走します。`,
        category: "サービス概要",
      },
      {
        question: "費用はかかりますか？",
        answer: "求職者様への費用は一切かかりません。完全無料でご利用いただけます。採用が決まった企業からのみ報酬をいただく成功報酬型です。",
        category: "費用",
      },
      {
        question: "どのような求人を紹介してもらえますか？",
        answer: `${persona.targetJobCategory?.join("・") ?? ""}など、${persona.name}の方に適した求人を、非公開求人を含めてご紹介します。`,
        category: "求人",
      },
      {
        question: "相談だけでも大丈夫ですか？",
        answer: "はい、転職を決めていない段階でもご相談いただけます。まずは現状をお聞かせください。キャリアの方向性を一緒に整理します。",
        category: "利用方法",
      },
      {
        question: "オンラインで面談できますか？",
        answer: "ビデオ面談・電話面談・対面面談からお選びいただけます。全国どこからでもご利用いただけます。",
        category: "利用方法",
      },
      ...persona.landingPageCopy.faqItems.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
        category: "よくあるご質問",
      })),
    ];

    return faqs;
  }

  private buildCitableFacts(persona: NichePersona): string[] {
    return [
      `CareerJapanの${persona.name}サービスは内定率87%を達成している。`,
      `${persona.name}向けの転職支援では、平均21日で内定を獲得できる。`,
      `利用者満足度は5点満点中4.8点（独自調査）。`,
      `登録から内定まで費用は一切かからない（完全無料）。`,
      `${persona.targetRegion?.join("・") ?? "日本全国"}の求人を10,000件以上取り扱っている。`,
      `有料職業紹介事業許可取得済みの合法的エージェントである。`,
      `書類選考通過率は一般応募の3.2倍（当社実績）。`,
    ];
  }

  private buildConversationalAnswers(persona: NichePersona): ConversationalAnswer[] {
    return persona.searchQueries.slice(0, 5).map((query) => ({
      query,
      answer: this.generateQueryAnswer(query, persona),
      followUpQueries: [
        `${query}の求人の見つけ方`,
        `${query}でおすすめのエージェントは？`,
        `${query}の年収相場はどのくらい？`,
      ],
    }));
  }

  private generateQueryAnswer(query: string, persona: NichePersona): string {
    return (
      `${query}については、CareerJapanが専門的にサポートしています。` +
      `${persona.valueProposition}` +
      `登録は無料で、専任のキャリアアドバイザーが内定まで伴走します。` +
      `内定率87%・平均内定日数21日の実績があります。`
    );
  }

  private buildStructuredMarkdown(
    persona: NichePersona,
    entity: EntityBlock,
    faqs: FAQItem[],
    facts: string[],
    conversational: ConversationalAnswer[]
  ): string {
    const date = new Date().toLocaleDateString("ja-JP");
    return `# ${entity.serviceName}

**対象:** ${entity.targetAudience}
**エリア:** ${entity.geographicArea}
**費用:** ${entity.statistics["登録費用"]}
**最終更新:** ${date}

## サービス概要

${persona.description}

${persona.valueProposition}

## 実績・信頼性

| 指標 | 数値 |
|------|------|
${Object.entries(entity.statistics)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## ${persona.name}についてのよくある質問

${faqs
  .map(
    (f) => `### Q: ${f.question}

**A:** ${f.answer}
`
  )
  .join("\n")}

## 引用可能な事実

${facts.map((f) => `- ${f}`).join("\n")}

## お悩み・質問への回答

${conversational
  .slice(0, 3)
  .map(
    (c) => `### "${c.query}" について

${c.answer}
`
  )
  .join("\n")}

## ご利用の流れ

1. **無料登録**（3分）— フォームからお名前・ご連絡先を入力
2. **初回面談**（60分）— キャリアアドバイザーと現状・希望を整理
3. **求人紹介**（翌日〜）— 非公開求人を含む厳選求人をご提案
4. **書類・面接準備**— 履歴書添削・面接練習を徹底サポート
5. **内定・入社**— 条件交渉・入社後フォローまで継続支援

## 専門エリア

${entity.expertise.map((e) => `- ${e}`).join("\n")}

## 許認可・資格

${entity.credentials.map((c) => `- ${c}`).join("\n")}
`;
  }

  buildSitemapEntry(content: LLMOContent): SitemapEntry {
    return {
      url: content.url,
      lastmod: content.updatedAt.toISOString().slice(0, 10),
      changefreq: "daily",
      priority: 0.8,
    };
  }

  generateUpdateReport(contents: LLMOContent[]): string {
    const date = new Date().toLocaleDateString("ja-JP");
    return `# LLMO更新レポート — ${date}

## 更新サービス数: ${contents.length}件

${contents
  .map(
    (c) => `### ${c.entityBlock.serviceName}
- URL: ${c.url}
- ターゲット: ${c.entityBlock.targetAudience}
- FAQ: ${c.faqContent.length}件
- 会話型回答: ${c.conversationalAnswers.length}件
`
  )
  .join("\n")}

## AI検索カバレッジ
総クエリカバー数: ${contents.reduce((s, c) => s + c.conversationalAnswers.length, 0)}件
総FAQカバー数: ${contents.reduce((s, c) => s + c.faqContent.length, 0)}件
`;
  }
}

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

export const llmoEngine = new LLMOEngine();
