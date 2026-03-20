export interface RagContextBlock {
  symbol: string;
  section: string | null;
  date: string;
  sentiment: string;
  price: number | null;
  text: string;
}

function formatRagContext(blocks: RagContextBlock[]): string {
  const lines = [
    '## Relevant context from your analysis history',
    '',
    'The following passages were retrieved from past analyses. Ground your response in them and cite [SYMBOL | date] when referencing.',
    '',
  ];
  for (const b of blocks) {
    const dateShort = b.date.slice(0, 10);
    const priceStr = b.price != null ? `$${b.price.toFixed(2)}` : 'N/A';
    lines.push('---');
    lines.push(`[${b.symbol} | ${b.section ?? 'general'} | ${dateShort} | ${b.sentiment} | ${priceStr}]`);
    lines.push(b.text.slice(0, 600));
    lines.push('');
  }
  return lines.join('\n');
}

export function buildChatSystemPrompt(watchlistSymbols: string[], ragContext?: RagContextBlock[]): string {
  const watchlist = watchlistSymbols.length > 0
    ? watchlistSymbols.join(', ')
    : 'no symbols added yet';

  const ragSection = ragContext && ragContext.length > 0
    ? '\n\n' + formatRagContext(ragContext)
    : '';

  return `You are a stock analysis assistant with access to both past analyses and real-time market data.

Current watchlist: ${watchlist}
${ragSection}
## How to answer

**Step 1 — Use the context above first.**
The passages retrieved above are from past analyses and are your primary source. If they answer the question, respond directly from them — do not call any tool.

**Step 2 — Dig deeper into history if needed.**
If the question is about past analysis, sentiment, risks, or trends but the context above is insufficient, call search_history (semantic search) or get_sentiment_trend.

**Step 3 — Use live tools only when explicitly asked.**
Only call get_company_news, get_market_news, get_stock_fundamentals, get_price_history, or get_analyst_recommendations when the user explicitly asks for current, real-time, or live data (e.g. "what's the price now?", "any news today?", "latest earnings?").

## Rules
- Never call a live tool to "verify" or "supplement" historical context — trust the stored analyses.
- Always cite the source: use [SYMBOL | date] for stored analyses, or "live data from Yahoo Finance / Finnhub" for tool calls.
- Be concise. Use markdown tables for comparisons, bullet points for news/summaries.
- Maintain conversational context — if the user says "what about its risks?" after discussing NVDA, infer the ticker.`;
}
