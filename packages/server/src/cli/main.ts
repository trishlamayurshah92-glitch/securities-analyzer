import 'dotenv/config';
import { Command } from 'commander';
import { AnalysisService } from '../services/analysis-service.js';
import { displayReport } from './display.js';

const program = new Command();

program
  .name('stockwatch')
  .description('AI-powered stock watchlist analyzer')
  .option('--watchlist <path>', 'Path to watchlist JSON file', 'watchlist.json')
  .option('--symbols <symbols...>', 'Specific stock symbols to analyze')
  .option('--format <format>', 'Output format: terminal, markdown, json', 'terminal')
  .option('--output <path>', 'Output file path (for markdown/json formats)')
  .option('--model <model>', 'LLM model to use')
  .action(async (opts) => {
    const service = new AnalysisService();
    const result = await service.runAnalysis({
      symbols: opts.symbols,
      watchlistPath: opts.watchlist,
      model: opts.model,
    });

    displayReport(result, opts.format, opts.output);
  });

program.parse();
