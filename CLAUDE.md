# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
npm install

# Build everything (shared + server) — required before running dev or CLI
npm run build

# Run web backend (port 8001)
npm run dev

# Run frontend dev server (port 5173, proxies /api to 8001)
cd frontend && npm run dev

# Build frontend
cd frontend && npm run build

# Run CLI
npm run cli -- --help
npm run cli -- --symbols AAPL NVDA --format terminal
npm run cli -- --watchlist watchlist.json --format markdown --output report.md

# Run tests
npm test

# Run a single test file
npx vitest run packages/server/tests/orchestrator.test.ts

# Run tests matching a pattern
npx vitest run --reporter=verbose -t "pattern"
```

## Architecture

TypeScript/Node.js monorepo using npm workspaces. An LLM orchestrator calls MCP servers as tools to gather data, then produces a synthesized report.

### Monorepo structure

```
packages/shared/    — @stockwatch/shared: Zod schemas + inferred types
packages/server/    — @stockwatch/server: Express API + MCP servers + orchestrator + CLI
frontend/           — React + TypeScript + Tailwind CSS + Vite
```

### Data flow

```
CLI (cli/) or Web API (web/) → AnalysisService (services/) → StockAnalysisOrchestrator (agent/)
    → MCPClientManager connects to 3 MCP servers via stdio:
        1. news-server.ts (Finnhub REST API) — company/market news
        2. fundamentals-server.ts (yahoo-finance2) — price, fundamentals, analyst recs
        3. history-server.ts (Pinecone) — RAG over past analyses
    → LLM agentic loop (Anthropic or OpenAI) calls tools iteratively until done
    → Final report returned as markdown string
```

**Important**: MCP servers are launched as compiled JS child processes (`dist/servers/*.js`). You must run `npm run build` before `npm run dev` or `npm run cli`.

### Dual-provider LLM support

The orchestrator (`packages/server/src/agent/orchestrator.ts`) supports both Anthropic and OpenAI-compatible APIs. Model name determines the provider: `claude-*` uses Anthropic SDK, `gemini-*` auto-configures to Google's OpenAI-compatible endpoint, everything else uses OpenAI SDK (works with Groq, etc. via `OPENAI_BASE_URL`). When `GCP_PROJECT` env var is set, Anthropic calls go through Vertex AI (via `@anthropic-ai/vertex-sdk`). Default model is `gemini-2.5-flash`, configurable via `MODEL` env var.

### MCP servers

All three servers use `McpServer` + `StdioServerTransport` from `@modelcontextprotocol/sdk`. They are compiled to JS and launched as child processes by `MCPClientManager`. Each server exposes tools that the LLM calls during its agentic loop:
- **news**: `get_company_news`, `get_market_news`
- **fundamentals**: `get_stock_fundamentals`, `get_price_history`, `get_analyst_recommendations`
- **history**: `search_history`, `store_analysis`, `get_sentiment_trend`

### Web layer

Express app (`packages/server/src/web/app.ts`) with three routers under `/api/`: `watchlist` (CRUD on `watchlist.json`), `analyze` (runs the orchestrator), `history` (queries Pinecone via shared lib). Serves the React frontend's built assets from `frontend/dist/` in production. Dev mode: Vite on port 5173 proxies `/api` to backend on port 8001.

### Frontend

React + TypeScript + Tailwind CSS + Vite. Pages: WatchlistPage, AnalysisPage, HistoryPage. Imports shared types from `@stockwatch/shared`. Uses react-router-dom for routing, recharts for charts, react-markdown for rendering reports.

### Testing

Uses Vitest. Run with `npm test` from root or `npx vitest run` from `packages/server/`. Test files are in `packages/server/tests/`.

## Key files

- `watchlist.json` — default stock watchlist (array of `{"symbol": "..."}` objects)
- `packages/shared/src/schemas.ts` — Zod schemas: `NewsArticle`, `StockFundamentals`, `StockAnalysis`, `AnalysisResult`, `Sentiment`, etc.
- `packages/server/src/agent/prompts.ts` — system prompt defining the LLM's analysis workflow and report format
- `packages/server/src/agent/orchestrator.ts` — dual-provider agentic loop
- `packages/server/src/lib/pinecone.ts` — shared Pinecone helpers (used by MCP history server and Express routes)
- `.env` — API keys: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `FINNHUB_API_KEY`, `PINECONE_API_KEY`, `MODEL`, `PORT` (optional, default 8001)
