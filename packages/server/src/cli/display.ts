import { writeFileSync } from 'fs';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import type { AnalysisResult } from '@stockwatch/shared';

marked.use(markedTerminal());

export function displayReport(
  result: AnalysisResult,
  format: string = 'terminal',
  outputPath?: string,
): void {
  switch (format) {
    case 'terminal':
      displayTerminal(result);
      break;
    case 'markdown':
      displayMarkdown(result, outputPath);
      break;
    case 'json':
      displayJson(result, outputPath);
      break;
  }
}

function displayTerminal(result: AnalysisResult): void {
  const rendered = marked(result.report);
  console.log(rendered);
  console.log(
    chalk.dim(
      `Analyzed ${result.stocks_analyzed.length} stocks ` +
      `using ${result.model} in ${result.duration_seconds}s`,
    ),
  );
}

function displayMarkdown(result: AnalysisResult, outputPath?: string): void {
  if (outputPath) {
    writeFileSync(outputPath, result.report);
    console.log(`Report written to ${outputPath}`);
  } else {
    console.log(result.report);
  }
}

function displayJson(result: AnalysisResult, outputPath?: string): void {
  const jsonStr = JSON.stringify(result, null, 2);
  if (outputPath) {
    writeFileSync(outputPath, jsonStr);
    console.log(`Report written to ${outputPath}`);
  } else {
    console.log(jsonStr);
  }
}
