/**
 * LLMO定期更新スクリプト
 * 毎週全サービスのLLMO最適化コンテンツを更新
 * AI検索エンジン（Perplexity, ChatGPT, Gemini等）への露出を最大化
 */

import { personaGenerator } from "../packages/persona-generator/src/index.js";
import { llmoEngine } from "../packages/llmo-engine/src/index.js";
import * as fs from "fs";

interface LLMOUpdateReport {
  updatedAt: Date;
  totalServices: number;
  updatedPages: number;
  newKeywords: string[];
  sitemapEntries: ReturnType<typeof llmoEngine.buildSitemapEntry>[];
  coverageMetrics: CoverageMetrics;
}

interface CoverageMetrics {
  totalQueries: number;
  educationNiches: number;
  regionNiches: number;
  situationNiches: number;
  combinedNiches: number;
  estimatedMonthlySearchVolume: number;
}

async function runLLMOUpdater(): Promise<void> {
  console.log("=== LLMO一括更新開始 ===");

  const personas = personaGenerator.generatePersonaQueue(30);
  console.log(`対象ペルソナ数: ${personas.length}`);

  const llmoContents = personas.map((persona) => {
    const content = llmoEngine.generateContent(persona);
    console.log(`  ✅ ${persona.name} — ${content.conversationalAnswers.length}件のQ&A生成`);
    return content;
  });

  const outputDir = "./llmo-content";
  fs.mkdirSync(outputDir, { recursive: true });

  for (const content of llmoContents) {
    const serviceDir = `${outputDir}/${content.url.replace("/services/", "")}`;
    fs.mkdirSync(serviceDir, { recursive: true });
    fs.writeFileSync(`${serviceDir}/index.md`, content.structuredMarkdown);
    fs.writeFileSync(`${serviceDir}/faq.json`, JSON.stringify(content.faqContent, null, 2));
    fs.writeFileSync(
      `${serviceDir}/citable-facts.json`,
      JSON.stringify(content.citableFactsBlock, null, 2)
    );
    fs.writeFileSync(
      `${serviceDir}/conversational-answers.json`,
      JSON.stringify(content.conversationalAnswers, null, 2)
    );
  }

  const sitemapEntries = llmoContents.map((c) => llmoEngine.buildSitemapEntry(c));
  const sitemapXml = buildSitemapXML(sitemapEntries);
  fs.writeFileSync(`${outputDir}/sitemap.xml`, sitemapXml);

  const allKeywords = [...new Set(personas.flatMap((p) => p.llmoKeywords))];
  const coverageMetrics: CoverageMetrics = {
    totalQueries: personas.reduce((s, p) => s + p.searchQueries.length, 0),
    educationNiches: personas.filter((p) => p.targetEducation?.length).length,
    regionNiches: personas.filter((p) => p.targetRegion?.length).length,
    situationNiches: personas.filter((p) => p.targetSituation?.length).length,
    combinedNiches: personas.filter(
      (p) => p.targetEducation?.length && p.targetRegion?.length
    ).length,
    estimatedMonthlySearchVolume: personas.reduce(
      (s, p) => s + p.searchQueries.length * 150,
      0
    ),
  };

  const report: LLMOUpdateReport = {
    updatedAt: new Date(),
    totalServices: personas.length,
    updatedPages: llmoContents.length,
    newKeywords: allKeywords.slice(0, 20),
    sitemapEntries,
    coverageMetrics,
  };

  const reportPath = `./reports/llmo-update-${new Date().toISOString().slice(0, 10)}.json`;
  fs.mkdirSync("./reports", { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  printReport(report);
  console.log(`\nLLMO更新レポート: ${reportPath}`);
}

function buildSitemapXML(entries: ReturnType<typeof llmoEngine.buildSitemapEntry>[]): string {
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>https://careerjapan.co${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function printReport(report: LLMOUpdateReport): void {
  const m = report.coverageMetrics;
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 LLMO更新レポート
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
更新日時: ${report.updatedAt.toLocaleString("ja-JP")}
更新サービス数: ${report.updatedPages}件
新規キーワード: ${report.newKeywords.length}件

📊 AI検索カバレッジ
  総クエリカバー数: ${m.totalQueries}件
  学歴ニッチ: ${m.educationNiches}件
  地域ニッチ: ${m.regionNiches}件
  状況ニッチ: ${m.situationNiches}件
  複合ニッチ: ${m.combinedNiches}件
  推定月間検索ボリューム: ${m.estimatedMonthlySearchVolume.toLocaleString()}回

🎯 対象キーワード（上位20）
  ${report.newKeywords.slice(0, 10).join(", ")}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

runLLMOUpdater().catch(console.error);
