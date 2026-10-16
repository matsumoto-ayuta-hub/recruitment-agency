/**
 * 毎日ニッチサービス自動ローンチ
 * GitHub Actionsから毎朝9時に実行
 * 松本氏の承認待ちキューに追加し、承認後に自動公開
 */

import { personaGenerator, type NichePersona } from "../packages/persona-generator/src/index.js";
import { llmoEngine } from "../packages/llmo-engine/src/index.js";
import * as fs from "fs";
import * as path from "path";

interface LaunchResult {
  date: string;
  persona: NichePersona;
  llmoContent: ReturnType<typeof llmoEngine.generateContent>;
  files: GeneratedFile[];
  approvalRequired: boolean;
  summary: string;
}

interface GeneratedFile {
  path: string;
  type: "landing_page" | "llmo_content" | "sitemap" | "email_sequence";
  description: string;
}

async function runDailyNicheLaunch(): Promise<void> {
  console.log("=== 毎日ニッチサービスローンチ開始 ===");
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  const persona = personaGenerator.generateDailyPersona(today);
  console.log(`ペルソナ生成完了: ${persona.name}`);

  const llmoContent = llmoEngine.generateContent(persona);
  console.log(`LLMOコンテンツ生成完了: ${llmoContent.conversationalAnswers.length}件の会話型回答`);

  const outputDir = path.join(process.cwd(), "generated", dateStr);
  fs.mkdirSync(outputDir, { recursive: true });

  const files: GeneratedFile[] = [];

  const landingPagePath = path.join(outputDir, "landing-page.html");
  fs.writeFileSync(landingPagePath, generateLandingPageHTML(persona));
  files.push({
    path: landingPagePath,
    type: "landing_page",
    description: `${persona.name}ランディングページ`,
  });

  const llmoPath = path.join(outputDir, "llmo-content.md");
  fs.writeFileSync(llmoPath, llmoContent.structuredMarkdown);
  files.push({
    path: llmoPath,
    type: "llmo_content",
    description: "LLMO最適化コンテンツ",
  });

  const emailPath = path.join(outputDir, "email-sequence.json");
  fs.writeFileSync(emailPath, JSON.stringify(persona.contentPlan.emailSequence, null, 2));
  files.push({
    path: emailPath,
    type: "email_sequence",
    description: "メールシーケンス",
  });

  const result: LaunchResult = {
    date: dateStr,
    persona,
    llmoContent,
    files,
    approvalRequired: true,
    summary: buildSummary(persona, llmoContent),
  };

  const reportPath = path.join(outputDir, "launch-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));

  const approvalQueuePath = path.join(process.cwd(), "approval-queue.json");
  updateApprovalQueue(approvalQueuePath, result);

  generateGitHubIssueContent(result, outputDir);

  console.log("\n=== ローンチ完了 ===");
  console.log(result.summary);
  console.log("\n松本氏の承認をお待ちしています。");
  console.log("承認後、自動的にサービスが公開されます。");
}

function generateLandingPageHTML(persona: NichePersona): string {
  const copy = persona.landingPageCopy;
  const meta = persona.seoMeta;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}">
  <meta name="keywords" content="${meta.keywords.join(",")}">
  <script type="application/ld+json">${JSON.stringify(meta.structuredData, null, 2)}</script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans JP', sans-serif; color: #333; }
    .hero { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; padding: 80px 20px; text-align: center; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero .sub { font-size: 1.2rem; opacity: 0.9; margin-bottom: 2rem; }
    .hero .urgency { background: #ff5722; padding: 8px 20px; border-radius: 20px; display: inline-block; font-size: 0.9rem; margin-bottom: 2rem; }
    .cta-btn { background: #ff9800; color: white; padding: 18px 40px; border-radius: 8px; font-size: 1.2rem; font-weight: bold; text-decoration: none; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .stats { background: #f5f5f5; padding: 40px 20px; text-align: center; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; max-width: 800px; margin: 0 auto; }
    .stat-item { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stat-value { font-size: 2rem; font-weight: bold; color: #1a73e8; }
    .stat-label { font-size: 0.85rem; color: #666; margin-top: 4px; }
    .benefits { max-width: 800px; margin: 60px auto; padding: 0 20px; }
    .benefits h2 { font-size: 1.8rem; margin-bottom: 30px; text-align: center; }
    .benefit-item { display: flex; align-items: flex-start; margin-bottom: 20px; }
    .benefit-icon { background: #1a73e8; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 16px; font-weight: bold; }
    .pain-points { background: #fff3e0; padding: 60px 20px; }
    .pain-points-inner { max-width: 800px; margin: 0 auto; }
    .pain-points h2 { font-size: 1.8rem; margin-bottom: 30px; }
    .pain-list li { margin-bottom: 12px; padding-left: 20px; position: relative; }
    .pain-list li::before { content: "✓"; color: #ff9800; position: absolute; left: 0; font-weight: bold; }
    .faq { max-width: 800px; margin: 60px auto; padding: 0 20px; }
    .faq h2 { font-size: 1.8rem; margin-bottom: 30px; text-align: center; }
    .faq-item { border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .faq-q { background: #f8f9fa; padding: 20px; font-weight: bold; cursor: pointer; }
    .faq-a { padding: 20px; border-top: 1px solid #e0e0e0; }
    .final-cta { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; text-align: center; padding: 80px 20px; }
    .final-cta h2 { font-size: 2rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${copy.headline}</h1>
    <p class="sub">${copy.subheadline}</p>
    <div class="urgency">⚡ ${copy.urgencyMessage}</div>
    <br><br>
    <a href="/register" class="cta-btn">${copy.ctaText}</a>
    <br><br>
    <small>${persona.seoMeta.keywords.slice(0, 5).join(" | ")}</small>
  </section>

  <section class="stats">
    <h2 style="margin-bottom: 30px; font-size: 1.5rem;">選ばれる理由</h2>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">87%</div><div class="stat-label">内定率</div></div>
      <div class="stat-item"><div class="stat-value">4.8</div><div class="stat-label">満足度（5点満点）</div></div>
      <div class="stat-item"><div class="stat-value">21日</div><div class="stat-label">平均内定日数</div></div>
      <div class="stat-item"><div class="stat-value">無料</div><div class="stat-label">ご利用料金</div></div>
    </div>
    <p style="margin-top: 20px; font-size: 0.85rem; color: #666;">${copy.socialProof}</p>
  </section>

  <section class="pain-points">
    <div class="pain-points-inner">
      <h2>こんなお悩みはありませんか？</h2>
      <p style="margin-bottom: 20px; font-size: 1.1rem; font-weight: bold;">${copy.heroDescription}</p>
      <ul class="pain-list">
        ${persona.painPoints.map((p) => `<li>${p}</li>`).join("\n        ")}
      </ul>
    </div>
  </section>

  <section class="benefits">
    <h2>私たちができること</h2>
    ${copy.benefits
      .map(
        (b, i) => `<div class="benefit-item">
      <div class="benefit-icon">${i + 1}</div>
      <div>${b}</div>
    </div>`
      )
      .join("\n    ")}
  </section>

  <section class="faq">
    <h2>よくあるご質問</h2>
    ${copy.faqItems
      .map(
        (faq) => `<div class="faq-item">
      <div class="faq-q">Q: ${faq.question}</div>
      <div class="faq-a">A: ${faq.answer}</div>
    </div>`
      )
      .join("\n    ")}
  </section>

  <section class="final-cta">
    <h2>${copy.headline}</h2>
    <p style="margin-bottom: 2rem; font-size: 1.1rem;">${copy.subheadline}</p>
    <a href="/register" class="cta-btn" style="font-size: 1.3rem; padding: 20px 50px;">${copy.ctaText}</a>
    <p style="margin-top: 20px; opacity: 0.8; font-size: 0.9rem;">⚡ ${copy.urgencyMessage}</p>
  </section>

  <footer style="background: #333; color: white; text-align: center; padding: 40px 20px;">
    <p>&copy; ${new Date().getFullYear()} CareerJapan. 有料職業紹介事業許可取得済み</p>
    <p style="margin-top: 8px; font-size: 0.85rem; opacity: 0.7;">
      <a href="/privacy" style="color: white;">プライバシーポリシー</a> |
      <a href="/terms" style="color: white;">利用規約</a> |
      <a href="/company" style="color: white;">会社概要</a>
    </p>
  </footer>
</body>
</html>`;
}

function buildSummary(
  persona: NichePersona,
  llmo: ReturnType<typeof llmoEngine.generateContent>
): string {
  return `
📋 本日のニッチサービス生成レポート
━━━━━━━━━━━━━━━━━━━━━━━━
サービス名: ${persona.name}
スラッグ: /services/${persona.slug}
ターゲット: ${[
    persona.targetEducation?.join(","),
    persona.targetRegion?.join(","),
    persona.targetJobCategory?.join(","),
  ]
    .filter(Boolean)
    .join(" | ")}

📊 LLMO最適化
  会話型Q&A: ${llmo.conversationalAnswers.length}件
  FAQ: ${llmo.faqContent.length}件
  引用可能ファクト: ${llmo.citableFactsBlock.length}件
  検索クエリカバー: ${persona.searchQueries.length}件

📄 生成コンテンツ
  ランディングページ: ✅
  LLMOコンテンツ: ✅
  メールシーケンス: ${persona.contentPlan.emailSequence.length}件
  記事プラン: ${persona.contentPlan.articles.length}件

⚡ 先行者利益ターゲット
  ${persona.searchQueries.slice(0, 3).map((q) => `"${q}"`).join("\n  ")}
━━━━━━━━━━━━━━━━━━━━━━━━
松本氏の承認後、自動公開されます。`;
}

function updateApprovalQueue(queuePath: string, result: LaunchResult): void {
  let queue: LaunchResult[] = [];
  if (fs.existsSync(queuePath)) {
    queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
  }
  queue.unshift(result);
  if (queue.length > 30) queue = queue.slice(0, 30);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

function generateGitHubIssueContent(result: LaunchResult, outputDir: string): void {
  const issueContent = `# 🚀 承認依頼: ${result.persona.name}

## サービス概要
${result.summary}

## 確認事項
- [ ] ランディングページの内容確認
- [ ] ターゲット設定の妥当性確認
- [ ] メールシーケンスの確認
- [ ] 公開承認

## アクション
- ✅ 承認する場合: このIssueに "approved" とコメント
- ❌ 修正が必要な場合: 修正点をコメント

## 生成ファイル
${result.files.map((f) => `- \`${path.relative(process.cwd(), f.path)}\`: ${f.description}`).join("\n")}

---
*このIssueはClaudeCodeによって自動生成されました。最終承認は松本氏が行います。*`;

  fs.writeFileSync(path.join(outputDir, "github-issue.md"), issueContent);
  console.log(`\n📝 GitHub Issue内容を生成しました: ${path.join(outputDir, "github-issue.md")}`);
}

runDailyNicheLaunch().catch(console.error);
