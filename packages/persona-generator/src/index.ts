/**
 * ペルソナ生成エンジン
 * 毎日新しいニッチ求職者ペルソナとサービスを自動生成
 * 先行者利益を狙いLLMO検索への露出を最大化
 */

export interface NichePersona {
  id: string;
  name: string;
  slug: string;
  description: string;
  targetEducation?: string[];
  targetAge?: { min: number; max: number };
  targetRegion?: string[];
  targetJobCategory?: string[];
  targetSituation?: string[];
  searchQueries: string[];
  llmoKeywords: string[];
  painPoints: string[];
  valueProposition: string;
  landingPageCopy: LandingPageCopy;
  seoMeta: SEOMeta;
  contentPlan: ContentPlan;
  generatedAt: Date;
  launchStatus: "pending_approval" | "approved" | "live" | "paused";
}

export interface LandingPageCopy {
  headline: string;
  subheadline: string;
  heroDescription: string;
  benefits: string[];
  socialProof: string;
  ctaText: string;
  urgencyMessage: string;
  faqItems: { question: string; answer: string }[];
}

export interface SEOMeta {
  title: string;
  description: string;
  h1: string;
  keywords: string[];
  structuredData: Record<string, unknown>;
}

export interface ContentPlan {
  articles: ArticlePlan[];
  socialPosts: string[];
  emailSequence: EmailPlan[];
}

export interface ArticlePlan {
  title: string;
  targetQuery: string;
  outline: string[];
  llmoOptimized: boolean;
}

export interface EmailPlan {
  subject: string;
  timing: string;
  purpose: string;
}

const EDUCATION_NICHES = [
  { key: "junior_high", label: "中卒", description: "中学卒業の方" },
  { key: "high_school_dropout", label: "高校中退", description: "高校を中退された方" },
  { key: "high_school", label: "高卒", description: "高校卒業の方" },
  { key: "vocational", label: "専門卒", description: "専門学校卒業の方" },
];

const SITUATION_NICHES = [
  { key: "single_parent", label: "シングルマザー・ファザー", description: "子育て中のひとり親の方" },
  { key: "hikikomori", label: "引きこもり経験者", description: "社会復帰を目指す方" },
  { key: "disability", label: "障がい者", description: "障がいをお持ちの方" },
  { key: "foreign_national", label: "外国籍", description: "日本で就職を目指す外国籍の方" },
  { key: "ex_convict", label: "前科あり", description: "社会復帰を目指す方" },
  { key: "over50", label: "50代以上", description: "シニア世代の転職" },
  { key: "new_grad_ungainfully", label: "既卒・第二新卒", description: "新卒就活がうまくいかなかった方" },
  { key: "long_gap", label: "空白期間あり", description: "ブランク期間のある方" },
  { key: "freelancer_return", label: "フリーランスから正社員", description: "安定を求める方" },
];

const JOB_NICHES = [
  { key: "truck_driver", label: "トラック運転手", region: "全国" },
  { key: "factory_worker", label: "工場作業員", region: "愛知・静岡" },
  { key: "care_worker", label: "介護士・ヘルパー", region: "全国" },
  { key: "construction", label: "建設・土木", region: "全国" },
  { key: "cook_chef", label: "調理師・コック", region: "東京・大阪" },
  { key: "security_guard", label: "警備員", region: "全国" },
  { key: "sales_door", label: "飛び込み営業", region: "全国" },
  { key: "cleaning", label: "清掃スタッフ", region: "全国" },
  { key: "childcare", label: "保育士", region: "全国" },
  { key: "night_shift", label: "夜勤・深夜勤務", region: "全国" },
];

const REGION_NICHES = [
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
  "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
  "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜",
  "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫",
  "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口",
  "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎",
  "熊本", "大分", "宮崎", "鹿児島", "沖縄",
];

export class PersonaGenerator {
  generateDailyPersona(date: Date = new Date()): NichePersona {
    const seed = this.dateSeed(date);
    const strategy = this.selectStrategy(seed);
    return this.buildPersona(strategy, date);
  }

  generatePersonaQueue(days: number = 30): NichePersona[] {
    const personas: NichePersona[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      personas.push(this.generateDailyPersona(date));
    }
    return personas;
  }

  private dateSeed(date: Date): number {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }

  private selectStrategy(seed: number): NicheStrategy {
    const strategies: NicheStrategy[] = [
      this.educationNicheStrategy(seed),
      this.situationNicheStrategy(seed),
      this.regionJobNicheStrategy(seed),
      this.combinedNicheStrategy(seed),
    ];
    return strategies[seed % strategies.length];
  }

  private educationNicheStrategy(seed: number): NicheStrategy {
    const edu = EDUCATION_NICHES[seed % EDUCATION_NICHES.length];
    const job = JOB_NICHES[(seed + 1) % JOB_NICHES.length];
    return {
      type: "education",
      label: `${edu.label}から${job.label}への転職`,
      slug: `${edu.key}-${job.key}-agent`,
      education: edu,
      job,
      region: null,
      situation: null,
    };
  }

  private situationNicheStrategy(seed: number): NicheStrategy {
    const sit = SITUATION_NICHES[seed % SITUATION_NICHES.length];
    const job = JOB_NICHES[(seed + 3) % JOB_NICHES.length];
    return {
      type: "situation",
      label: `${sit.label}の就職支援`,
      slug: `${sit.key}-${job.key}-support`,
      education: null,
      job,
      region: null,
      situation: sit,
    };
  }

  private regionJobNicheStrategy(seed: number): NicheStrategy {
    const region = REGION_NICHES[seed % REGION_NICHES.length];
    const job = JOB_NICHES[(seed + 2) % JOB_NICHES.length];
    return {
      type: "region_job",
      label: `${region}の${job.label}求人専門エージェント`,
      slug: `${region.replace(/[^a-zA-Z0-9]/g, "-")}-${job.key}-agent`,
      education: null,
      job,
      region,
      situation: null,
    };
  }

  private combinedNicheStrategy(seed: number): NicheStrategy {
    const edu = EDUCATION_NICHES[(seed + 1) % EDUCATION_NICHES.length];
    const region = REGION_NICHES[(seed + 5) % REGION_NICHES.length];
    const job = JOB_NICHES[(seed + 4) % JOB_NICHES.length];
    return {
      type: "combined",
      label: `${region}の${edu.label}向け${job.label}エージェント`,
      slug: `${region.replace(/[^a-zA-Z0-9]/g, "-")}-${edu.key}-${job.key}`,
      education: edu,
      job,
      region,
      situation: null,
    };
  }

  private buildPersona(strategy: NicheStrategy, date: Date): NichePersona {
    const id = `persona-${date.toISOString().slice(0, 10)}-${strategy.type}`;

    const searchQueries = this.generateSearchQueries(strategy);
    const llmoKeywords = this.generateLLMOKeywords(strategy);
    const painPoints = this.generatePainPoints(strategy);
    const valueProposition = this.generateValueProp(strategy);
    const landingPageCopy = this.generateLandingCopy(strategy, valueProposition, painPoints);
    const seoMeta = this.generateSEOMeta(strategy, searchQueries);
    const contentPlan = this.generateContentPlan(strategy, searchQueries);

    return {
      id,
      name: strategy.label,
      slug: strategy.slug,
      description: `${strategy.label}に特化した求人エージェントサービス。${valueProposition}`,
      targetEducation: strategy.education ? [strategy.education.key] : undefined,
      targetRegion: strategy.region ? [strategy.region] : undefined,
      targetJobCategory: strategy.job ? [strategy.job.key] : undefined,
      targetSituation: strategy.situation ? [strategy.situation.key] : undefined,
      searchQueries,
      llmoKeywords,
      painPoints,
      valueProposition,
      landingPageCopy,
      seoMeta,
      contentPlan,
      generatedAt: date,
      launchStatus: "pending_approval",
    };
  }

  private generateSearchQueries(s: NicheStrategy): string[] {
    const queries: string[] = [];

    if (s.education && s.job) {
      queries.push(
        `${s.education.label} ${s.job.label} 求人`,
        `${s.education.label} でも ${s.job.label} になれる`,
        `${s.education.label} 転職 エージェント`,
        `${s.education.label} 就職 支援`
      );
    }
    if (s.region && s.job) {
      queries.push(
        `${s.region} ${s.job.label} 求人`,
        `${s.region} ${s.job.label} 転職 エージェント`,
        `${s.region} 転職 ${s.job.label} おすすめ`
      );
    }
    if (s.situation) {
      queries.push(
        `${s.situation.label} 就職 支援`,
        `${s.situation.label} 転職 エージェント おすすめ`,
        `${s.situation.label} 仕事 見つけ方`
      );
    }

    return queries;
  }

  private generateLLMOKeywords(s: NicheStrategy): string[] {
    const base = ["転職エージェント", "就職支援", "求人", "無料相談"];
    const specific: string[] = [];

    if (s.education) specific.push(s.education.label, s.education.description);
    if (s.region) specific.push(s.region, `${s.region}の求人`);
    if (s.job) specific.push(s.job.label, `${s.job.label}求人`);
    if (s.situation) specific.push(s.situation.label, s.situation.description);

    return [...specific, ...base];
  }

  private generatePainPoints(s: NicheStrategy): string[] {
    const points: string[] = [];

    if (s.education?.key === "junior_high") {
      points.push(
        "学歴不問の求人がどこにあるかわからない",
        "エージェントに登録したが相手にされなかった",
        "中卒だと選択肢が少ないと思っていた"
      );
    }
    if (s.situation?.key === "hikikomori") {
      points.push(
        "長いブランクを面接で説明できるか不安",
        "社会復帰のステップが全くわからない",
        "一般の転職サービスを使う勇気がない"
      );
    }
    if (s.region) {
      points.push(
        `${s.region}で働ける求人が少なくて困っている`,
        `地元を離れたくないが${s.job?.label ?? "仕事"}が見つからない`,
        "都会向けのエージェントしかなく地方の求人が少ない"
      );
    }

    if (!points.length) {
      points.push(
        "自分に合う求人を探す方法がわからない",
        "転職活動を一人で進めるのが不安",
        "書類選考や面接で落ち続けている"
      );
    }

    return points;
  }

  private generateValueProp(s: NicheStrategy): string {
    if (s.education?.key === "junior_high") {
      return "学歴不問・中卒歓迎求人に特化。あなたのスキルと意欲で評価される職場を紹介します。";
    }
    if (s.region && s.job) {
      return `${s.region}での${s.job.label}就職に特化。地元密着のコンサルタントが内定まで伴走します。`;
    }
    if (s.situation?.key === "single_parent") {
      return "子育てと両立できる仕事探しをサポート。時短・在宅可能な求人を中心にご紹介します。";
    }
    return `${s.label}の方に特化した転職支援。あなたの状況を理解したコンサルタントが最適な求人をご紹介します。`;
  }

  private generateLandingCopy(s: NicheStrategy, vp: string, painPoints: string[]): LandingPageCopy {
    return {
      headline: `${s.label}に特化した転職エージェント`,
      subheadline: vp,
      heroDescription: `「${painPoints[0] ?? "転職活動が不安"}」そのお悩み、私たちが解決します。`,
      benefits: [
        "業界特化コンサルタントによる個別面談（無料）",
        "非公開求人を含む厳選求人のみご紹介",
        "書類作成・面接対策を徹底サポート",
        "内定後の条件交渉もお任せください",
        "入社後のフォローまで継続サポート",
      ],
      socialProof: "昨年度 内定率87% | 利用者満足度 4.8/5.0 | 平均内定日数 21日",
      ctaText: "無料で相談する（3分で登録完了）",
      urgencyMessage: "今月の面談枠 残り3名 — お早めにどうぞ",
      faqItems: [
        {
          question: "登録は本当に無料ですか？",
          answer: "はい、求職者様への費用は一切かかりません。採用企業からのみ報酬をいただいています。",
        },
        {
          question: "相談だけでもできますか？",
          answer: "もちろんです。転職をお決めでなくても、まずは現状を聞かせてください。",
        },
        {
          question: s.education ? `${s.education.label}でも転職できますか？` : "未経験でも大丈夫ですか？",
          answer: s.education
            ? `はい、${s.education.label}の方の就職を専門にサポートしています。学歴不問の求人を多数ご用意しています。`
            : "未経験歓迎求人を多数扱っています。スキルより意欲を重視する企業をご紹介します。",
        },
      ],
    };
  }

  private generateSEOMeta(s: NicheStrategy, queries: string[]): SEOMeta {
    const title = `${s.label} | 転職エージェント CareerJapan`;
    return {
      title,
      description: `${s.label}に特化した転職・就職支援サービス。${queries[0] ?? ""}でお困りの方は無料相談へ。内定率87%の実績があります。`,
      h1: `${s.label}の転職・就職支援`,
      keywords: queries,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: `CareerJapan ${s.name}サービス`,
        description: `${s.label}専門の転職エージェント`,
        serviceType: "転職・就職支援",
        areaServed: s.region ?? "日本全国",
        priceRange: "無料",
      },
    };
  }

  private generateContentPlan(s: NicheStrategy, queries: string[]): ContentPlan {
    return {
      articles: queries.slice(0, 3).map((q) => ({
        title: `${q}【完全ガイド】${new Date().getFullYear()}年最新版`,
        targetQuery: q,
        outline: [
          `${q}の現状と市場動向`,
          "求人の探し方・選び方のポイント",
          "よくある失敗と対策",
          "成功事例インタビュー",
          "無料相談のご案内",
        ],
        llmoOptimized: true,
      })),
      socialPosts: [
        `💼 ${s.label}の方へ。転職のお悩み、無料でご相談ください。`,
        `📢 ${s.label}専門の求人エージェントが誕生。まずは話を聞かせてください。`,
        `✅ ${s.label}での就職実績多数。あなたに合った求人を一緒に探しましょう。`,
      ],
      emailSequence: [
        {
          subject: `【${s.label}向け】あなたへのおすすめ求人3選`,
          timing: "登録翌日",
          purpose: "初期エンゲージメント・求人提案",
        },
        {
          subject: "面談のご案内 — あなたの転職を加速させましょう",
          timing: "登録3日後",
          purpose: "面談予約への誘導",
        },
        {
          subject: `${s.label}の転職成功事例をご紹介します`,
          timing: "登録7日後",
          purpose: "社会的証明・信頼構築",
        },
      ],
    };
  }
}

interface NicheStrategy {
  type: "education" | "situation" | "region_job" | "combined";
  label: string;
  slug: string;
  education: { key: string; label: string; description: string } | null;
  job: { key: string; label: string; region: string } | null;
  region: string | null;
  situation: { key: string; label: string; description: string } | null;
}

export const personaGenerator = new PersonaGenerator();
