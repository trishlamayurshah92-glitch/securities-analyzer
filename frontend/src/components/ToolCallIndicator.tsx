const TOOL_LABELS: Record<string, string> = {
  get_stock_fundamentals: 'Checking fundamentals',
  get_price_history: 'Loading price history',
  get_analyst_recommendations: 'Fetching analyst ratings',
  get_company_news: 'Fetching latest news',
  get_market_news: 'Checking market news',
  search_history: 'Searching analysis history',
  get_sentiment_trend: 'Loading sentiment trend',
  store_analysis: 'Saving analysis',
};

interface Props {
  tools: string[];
}

export default function ToolCallIndicator({ tools }: Props) {
  if (tools.length === 0) return null;

  return (
    <div className="flex justify-start">
      <div className="flex flex-col gap-1 rounded-2xl rounded-tl-sm bg-[#F0F2F5] px-4 py-2.5">
        {tools.map((name) => (
          <span key={name} className="flex items-center gap-2 text-xs text-[#5E6C84]">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#0052CC] border-t-transparent" />
            {TOOL_LABELS[name] ?? name}
            <span className="animate-pulse">...</span>
          </span>
        ))}
      </div>
    </div>
  );
}
