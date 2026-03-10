# StockWatch — Design Document

## 1. Project Overview

**StockWatch** is an AI-powered stock analysis platform. Its core function is to orchestrate a multi-provider Large Language Model (LLM) through a set of MCP (Model Context Protocol) tool servers to gather real-time market data, compare it against historical analyses stored in a vector database, and produce structured, opinionated markdown reports.

**Key capabilities:**
- LLM-driven agentic analysis with tool calling (news, fundamentals, price history)
- Semantic search over past analyses using pgvector (Supabase)
- Thesis drift detection between snapshots
- Conversational (chat) interface with streaming SSE
- Multi-tenant authentication via Supabase JWT
- Multi-provider LLM support (Anthropic, OpenAI, Google Gemini, Vertex AI)
- CLI and Web interfaces

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Language | TypeScript (Node.js) | Full-stack type safety; shared schemas |
| Monorepo | npm workspaces | Single lock file, cross-package imports |
| LLM Orchestration | Custom agentic loop | Supports Anthropic + OpenAI SDK interfaces |
| Tool Protocol | MCP (`@modelcontextprotocol/sdk`) | Standardized tool calling over stdio |
| Database | Supabase (PostgreSQL + pgvector) | Managed Postgres with vector search built-in |
| ORM | Prisma | Type-safe DB access, migration management |
| Embeddings | Google `gemini-embedding-001` (768 dim) | Free under Gemini quota; matches default LLM |
| Market Data | Finnhub REST API | News; free tier available |
| Stock Fundamentals | `yahoo-finance2` SDK | Open-source; covers price, fundamentals, analysts |
| Auth | Supabase Auth + Google OAuth | Managed, stateless JWT; Google SSO |
| Web Server | Express.js | Lightweight, minimal boilerplate |
| Frontend | React 19 + Vite + Tailwind CSS | Fast builds, component-first UI |
| Charts | Recharts | React-native charting |
| Streaming | Server-Sent Events (SSE) | Native browser support, unidirectional streaming |
| Testing | Vitest | Fast, ESM-native, compatible with Vite |

---

## 3. Monorepo Structure

```
stocks-main/
├── package.json                     ← Root workspace manager
├── watchlist.json                   ← Default CLI watchlist (deprecated for web)
├── .env                             ← All secrets + config
│
├── packages/
│   ├── shared/                      ← @stockwatch/shared
│   │   └── src/
│   │       ├── schemas.ts           ← All Zod schemas + inferred TS types
│   │       └── index.ts             ← Re-exports everything
│   │
│   └── server/                      ← @stockwatch/server
│       ├── prisma/
│       │   └── schema.prisma        ← DB models: WatchlistItem, AnalysisSnapshot, AnalysisEmbedding
│       └── src/
│           ├── config.ts            ← Path constants
│           ├── agent/
│           │   ├── orchestrator.ts  ← Multi-provider LLM agentic loop
│           │   ├── mcp-client.ts    ← MCPClientManager (tool dispatch)
│           │   ├── mcp-singleton.ts ← Global + per-user MCP managers
│           │   ├── prompts.ts       ← Analysis system prompt
│           │   └── chat-prompts.ts  ← Chat system prompt
│           ├── servers/             ← MCP stdio servers (compiled → dist/servers/)
│           │   ├── news-server.ts
│           │   ├── fundamentals-server.ts
│           │   └── history-server.ts
│           ├── services/
│           │   └── analysis-service.ts ← High-level orchestration + parse + store
│           ├── lib/
│           │   ├── db.ts            ← Prisma singleton
│           │   ├── vector-store.ts  ← embed, storeAnalysis, searchHistory, getSentimentTrend
│           │   ├── parse-snapshot.ts← Regex parser for LLM markdown reports
│           │   ├── compute-diff.ts  ← Thesis drift detection between snapshots
│           │   ├── errors.ts        ← AppError hierarchy with HTTP codes
│           │   └── logger.ts        ← Structured JSON logger
│           ├── web/
│           │   ├── app.ts           ← Express app + routes + static serving
│           │   ├── middleware/
│           │   │   └── auth.ts      ← Supabase JWT validation middleware
│           │   └── routes/
│           │       ├── watchlist.ts
│           │       ├── analyze.ts
│           │       ├── history.ts
│           │       ├── news.ts
│           │       └── chat.ts
│           └── cli/
│               └── main.ts          ← Commander CLI
│
└── frontend/                        ← React SPA
    └── src/
        ├── App.tsx                  ← Router + protected routes
        ├── contexts/
        │   └── AuthContext.tsx
        ├── api/
        │   ├── client.ts            ← REST API calls (auth-aware)
        │   └── chatClient.ts        ← SSE streaming client
        ├── pages/
        │   ├── StockDashboardPage.tsx
        │   ├── HistoryPage.tsx
        │   ├── ChatPage.tsx
        │   └── NewsPage.tsx
        ├── hooks/
        │   ├── useDashboard.ts
        │   ├── useHistory.ts
        │   ├── useChat.ts
        │   └── useNews.ts
        └── components/
            ├── StockTable, SentimentBadge, SentimentTrend
            ├── ChatMessage, ToolCallIndicator
            └── NewsCard, Layout, Disclaimer, ...
```

---

## 4. Data Models

### 4.1 Prisma Schema (PostgreSQL + pgvector)

**WatchlistItem**
```
id        Int       PK autoincrement
userId    String    (Supabase user UUID)
symbol    String    (e.g., "AAPL")
addedAt   DateTime  default(now())
UNIQUE(userId, symbol)
INDEX(userId)
```

**AnalysisSnapshot**
```
id            Int       PK autoincrement
userId        String
symbol        String
createdAt     DateTime  default(now())
sentiment     String    ("Bullish" | "Bearish" | "Neutral" | "Mixed")
reportText    String    (full LLM markdown)
modelUsed     String    (e.g., "gemini-2.5-flash")
price         Float?
peRatio       Float?
marketCap     Float?
beta          Float?
week52High    Float?
week52Low     Float?
dividendYield Float?
companyName   String?
INDEX(userId, symbol, createdAt DESC)
→ one-to-many: AnalysisEmbedding
```

**AnalysisEmbedding**
```
id         Int       PK autoincrement
userId     String
snapshotId Int       FK → AnalysisSnapshot (CASCADE DELETE)
symbol     String
section    String?   ("summary" | "bull_case" | "bear_case" | "risks" | "catalysts" | "valuation" | "conclusion")
text       String    (first 1000 chars of section)
embedding  vector(768) (pgvector type, Gemini embedding-001)
INDEX(userId, symbol)
INDEX(userId, symbol, section)
```

### 4.2 Shared Zod Schemas (packages/shared)

| Schema | Key Fields |
|---|---|
| `Sentiment` | `"Bullish" \| "Bearish" \| "Neutral" \| "Mixed"` |
| `NewsArticle` | headline, summary, source, datetime, url |
| `StockFundamentals` | symbol, name, sector, market_cap, pe_ratio, eps, price, 52w high/low, beta, dividend_yield, revenue, profit_margin, debt_to_equity |
| `AnalysisResult` | report (markdown), stocks_analyzed, model, duration_seconds |
| `AnalysisSnapshot` | all AnalysisSnapshot DB fields |
| `SnapshotDiff` | previousSnapshotId, currentSnapshotId, sentimentChanged, driftLevel, priceDeltaPct, peRatioDelta, marketCapDeltaPct |
| `WatchlistItem` | id, symbol, addedAt |
| `ChatMessage` | role ("user"\|"assistant"), content |

---

## 5. Architecture Diagrams

### Diagram 1: High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │   Browser    │    │   CLI Tool   │    │  API Client  │  │
│   │ (React SPA)  │    │ (commander)  │    │  (external)  │  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
└──────────┼───────────────────┼───────────────────┼──────────┘
           │  HTTP/SSE         │  IPC (spawn)       │  HTTP
           ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                       Express Server (port 8001)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │/watchlist│ │/analyze  │ │/history  │ │  /chat (SSE) │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
│       │            │            │               │            │
│  ┌────▼────────────▼────────────▼───────────────▼────────┐  │
│  │              AnalysisService                           │  │
│  └──────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │
           ┌──────────────────▼──────────────────┐
           │       StockAnalysisOrchestrator       │
           │  (Anthropic SDK / OpenAI SDK / Both)  │
           └────────────────┬────────────────────┘
                            │ Tool calls
           ┌────────────────▼────────────────────┐
           │         MCPClientManager              │
           │  (stdio connections to 3 servers)     │
           └──┬──────────────┬──────────────┬─────┘
              │              │              │
    ┌─────────▼──┐  ┌────────▼────┐  ┌─────▼──────────┐
    │ news-server │  │fundamentals-│  │ history-server  │
    │ (Finnhub)   │  │ server      │  │ (vector-store)  │
    │             │  │ (yahoo-fin) │  │                 │
    └─────────────┘  └─────────────┘  └────────┬────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Supabase PostgreSQL  │
                                    │  + pgvector           │
                                    │  (WatchlistItem,      │
                                    │  AnalysisSnapshot,    │
                                    │  AnalysisEmbedding)   │
                                    └─────────────────────┘
```

---

### Diagram 2: Analysis Workflow (Step-by-Step)

```
[POST /api/analyze] or [CLI --symbols]
        │
        ▼
AnalysisService.runAnalysis(options)
        │
        ├─ Resolve watchlist:
        │   ├─ options.symbols? → use directly
        │   ├─ options.watchlistPath? → read file (CLI)
        │   └─ else → prisma.watchlistItem.findMany(userId)
        │
        ▼
StockAnalysisOrchestrator.setup()
        │
        ├─ Detect provider (model name prefix)
        ├─ Create Anthropic/OpenAI/Google client
        └─ MCPClientManager.connectServer() × 3
               ├─ spawn: node dist/servers/news-server.js
               ├─ spawn: node dist/servers/fundamentals-server.js
               └─ spawn: node dist/servers/history-server.js
                         (env: ANALYSIS_USER_ID=userId)
        │
        ▼
orchestrator.analyzeWatchlist(watchlist)
        │
        ├─ Build messages: [{ role: "user", content: "Analyze: AAPL, NVDA..." }]
        ├─ Inject SYSTEM_PROMPT (workflow + report format)
        │
        └─ TOOL LOOP (max 20 iterations):
               │
               ├─ LLM decides which tool to call next
               │
               ├─ Per stock (LLM-driven order):
               │   ├─ search_history(symbol, query) ─────→ vector search in pgvector
               │   ├─ get_sentiment_trend(symbol, days) ──→ historical sentiment
               │   ├─ get_company_news(symbol) ────────────→ Finnhub REST API
               │   ├─ get_stock_fundamentals(symbol) ──────→ yahoo-finance2
               │   ├─ get_price_history(symbol) ───────────→ yahoo-finance2
               │   └─ get_analyst_recommendations(symbol) ─→ yahoo-finance2
               │
               ├─ [optional] get_market_news() once for macro context
               │
               └─ stop_reason === "end_turn" → extract final TextBlock
        │
        ▼
report (markdown string)
        │
        ▼
parseSnapshotsFromReport(report, symbols)
        │  Regex extracts per-stock sections:
        │  - Sentiment label
        │  - Fundamentals table (price, PE, market cap, 52w range, dividend yield)
        │  - Company name
        │
        ▼
Promise.allSettled(symbols.map(storeAnalysis))
        │
        ├─ prisma.analysisSnapshot.create() [critical path]
        │
        └─ Best-effort embeddings:
               ├─ chunkReport(reportText) → [{ section, text }, ...]
               ├─ embed(text) via Gemini embedding-001 (768 dim)
               └─ prisma.analysisEmbedding.createMany()
        │
        ▼
Return AnalysisResult { report, stocks_analyzed, model, duration_seconds }
```

---

### Diagram 3: Chat Streaming Workflow (SSE)

```
[POST /api/chat] { message, history? }
        │
        ▼
chat.ts router
        │
        ├─ Set headers: Content-Type: text/event-stream
        ├─ Load user watchlist from Prisma
        ├─ buildChatSystemPrompt(symbols)
        └─ createUserMCPManager(userId)
               └─ connects fresh manager with ANALYSIS_USER_ID=userId
        │
        ▼
runAnthropicStreamingLoop() OR runOpenAIStreamingLoop()
        │
        ├─ LLM streams tokens → SSE: { type: "token", content: "..." }
        │
        ├─ LLM calls tool → SSE: { type: "tool_start", name: "get_company_news" }
        │   └─ mcpManager.callTool(name, args) → result
        │   └─ SSE: { type: "tool_done", name: "get_company_news" }
        │
        └─ LLM finishes → SSE: { type: "done" }
        │
        ▼
Frontend ChatPage receives SSE events
        │
        ├─ onToken → append to assistant message (typing effect)
        ├─ onToolStart → show ToolCallIndicator (active tools)
        ├─ onToolDone → remove from active tools
        └─ onDone → unlock input
```

---

### Diagram 4: History / Semantic Search Workflow

```
[GET /api/history/:symbol?query=risks&top_k=10]
        │
        ▼
vector-store.searchHistory(userId, symbol, query, topK, section?)
        │
        ├─ embed(query) → Gemini API → float[] (768 dim)
        │
        └─ Postgres raw query (pgvector cosine distance):
               SELECT
                 ae.text, ae.section, ae.embedding <=> $vector AS distance,
                 s.sentiment, s.createdAt, s.price, s.peRatio, ...
               FROM "AnalysisEmbedding" ae
               JOIN "AnalysisSnapshot" s ON ae.snapshotId = s.id
               WHERE ae.userId = $userId AND ae.symbol = $symbol
               [AND ae.section = $section]
               ORDER BY distance ASC
               LIMIT $topK
        │
        ▼
Return HistoryMatch[] { score, date, sentiment, price, text, companyName, peRatio, marketCap }
```

---

### Diagram 5: Thesis Drift Detection Workflow

```
[GET /api/history/:symbol/diff]
        │
        ▼
Prisma: find 2 most recent AnalysisSnapshots (userId, symbol, ORDER BY createdAt DESC)
        │
        ├─ < 2 snapshots → 404
        │
        └─ computeDiff(previous, current)
               │
               ├─ sentimentChanged = prev.sentiment !== curr.sentiment
               │
               ├─ driftLevel:
               │   ├─ sentimentChanged AND (Bullish↔Bearish flip) → "significant"
               │   ├─ sentimentChanged AND (other change) → "minor"
               │   └─ not changed → "none"
               │
               ├─ priceDeltaPct = (curr.price - prev.price) / |prev.price| × 100
               ├─ peRatioDelta = curr.peRatio - prev.peRatio
               └─ marketCapDeltaPct = (curr.marketCap - prev.marketCap) / |prev.marketCap| × 100
        │
        ▼
Return SnapshotDiff { previousSnapshotId, currentSnapshotId, previousDate, currentDate,
                      previousSentiment, currentSentiment, sentimentChanged, driftLevel,
                      priceDeltaPct, peRatioDelta, marketCapDeltaPct }
```

---

### Diagram 6: Auth Flow

```
Browser → Supabase Auth → Google OAuth → Session (JWT)
        │
        ▼
Frontend API calls: Authorization: Bearer <jwt>
        │
        ▼
Express auth.ts middleware (requireAuth)
        │
        ├─ Extract token from Authorization header
        ├─ supabase.auth.getUser(token) → { user, error }
        │   ├─ error → 401 "Invalid or expired token"
        │   └─ success → req.userId = user.id
        │
        ▼
Route handler receives userId on req.userId
All Prisma queries scoped: WHERE userId = req.userId
```

---

### Diagram 7: LLM Provider Selection

```
MODEL env var (or options.model)
        │
        ▼
Does model start with "claude-"?
        │
        ├─ YES → Anthropic SDK
        │         └─ GCP_PROJECT set? → AnthropicVertex SDK (Vertex AI)
        │
        └─ NO → OpenAI SDK interface
                  └─ Does model start with "gemini-"?
                       ├─ YES → baseURL = Google's OpenAI-compatible endpoint
                       │         OPENAI_API_KEY = GEMINI_API_KEY
                       └─ NO → standard OpenAI (or Groq via OPENAI_BASE_URL)
```

---

## 6. MCP Server Interface

All three servers expose tools via the MCP protocol over stdio. They are spawned as child processes by `MCPClientManager`.

| Server | Binary | Tools | External Service |
|---|---|---|---|
| `news-server` | `dist/servers/news-server.js` | `get_company_news`, `get_market_news` | Finnhub REST API |
| `fundamentals-server` | `dist/servers/fundamentals-server.js` | `get_stock_fundamentals`, `get_price_history`, `get_analyst_recommendations` | yahoo-finance2 |
| `history-server` | `dist/servers/history-server.js` | `search_history`, `store_analysis`, `get_sentiment_trend` | Supabase (via vector-store.ts) |

**Tool calling flow within orchestrator:**
```
LLM → [tool_use block: { name, input }]
    → MCPClientManager.callToolWithTimeout(name, input, 30_000)
        → toolToServer map lookup → target client session
        → client.callTool(name, args) via MCP stdio
        → extract text from result.content[]
    → [tool_result block: { content }]
    → back to LLM
```

**Timeouts:**
- Per-tool: 30 seconds (`TOOL_TIMEOUT_MS`)
- Overall loop: 10 minutes (`OVERALL_TIMEOUT_MS`)
- Max iterations: 20 (`MAX_TOOL_ITERATIONS`)

**Retry logic:** 1 retry with 500ms delay on transient network errors only.

---

## 7. Report Format Contract

The LLM is instructed to produce this exact markdown format per stock (enforced by system prompt, parsed by `parse-snapshot.ts`):

```markdown
### AAPL - Apple Inc.

**Sentiment:** Bullish

**News Summary:**
- ...

**Fundamentals Snapshot:**
| Metric         | Value     |
|----------------|-----------|
| Price          | $170.50   |
| P/E Ratio      | 28.5      |
| Market Cap     | $2.8T     |
| 52-Week Range  | $125 - $199 |
| Dividend Yield | 0.45%     |

**Price Action:**
- 1-Day: +1.2%
- 5-Day: -2.5%
- 1-Month: +5.3%

**Why It Moved:** [...]

**Analyst Consensus:** [...]

**Sentiment Trend:** [...]

**Summary:** [2-3 sentences]

**Bull Case:** [...]

**Bear Case:** [...]

**Risks:** [...]

**Catalysts:** [...]

**Valuation:** [...]

**Conclusion:** [Hold/Add/Reduce/Avoid + reasoning]
```

The regex parser in `parse-snapshot.ts` extracts: symbol, company name, sentiment, price, P/E ratio, market cap (handles T/B/M suffixes), 52-week high/low, dividend yield. These are stored as structured columns on `AnalysisSnapshot` for dashboard display.

**Report sections are also used as embedding chunk keys:** `summary`, `bull_case`, `bear_case`, `risks`, `catalysts`, `valuation`, `conclusion`.

---

## 8. Design Decisions & Trade-offs

### 8.1 MCP as Tool Protocol
**Decision:** Use MCP stdio servers for all data access, not direct library calls.

**Rationale:** The LLM drives tool selection and sequencing autonomously. MCP gives a clean, model-agnostic interface — the same tool schema works for Anthropic, OpenAI, and Gemini.

**Trade-off:** Each analysis run spawns 3 child processes. Startup latency (~1-2s) is amortized by warming up at Express boot via `getMCPManager()`. Per-analysis runs (CLI) absorb this cold start.

---

### 8.2 Supabase / pgvector instead of Pinecone
**Decision:** Replace Pinecone with pgvector in Supabase.

**Rationale:** Single database for relational data (watchlist, snapshot metadata) and vector search eliminates a dependency. Supabase pgvector supports IVFFlat indexing for production-scale cosine search.

**Trade-off:** Supabase pgvector is less tunable than a dedicated vector DB (Pinecone, Weaviate). For tens of thousands of embeddings it is fine; for millions, dedicated vector DBs scale better.

**Assumption:** Analyses are stored per-user-per-symbol. At typical usage (dozens of users, 10-50 stocks each, weekly analyses), the dataset is small (<100k vectors). IVFFlat index is optional at this scale.

---

### 8.3 Gemini as Default LLM + Embedding Model
**Decision:** Default to `gemini-2.5-flash`, embed with `gemini-embedding-001`.

**Rationale:** At time of implementation the user's `OPENAI_API_KEY` was actually a Google API key. Gemini models are cost-effective and the embedding model is free under Google's quota.

**Trade-off:** Embedding dimension is 768 (not OpenAI's 1536). The pgvector schema is hardcoded to `vector(768)` — switching embedding models requires a migration and re-embedding all stored analyses.

**Assumption:** Gemini API key is provided. If `GEMINI_API_KEY` is missing, embedding silently fails and history search returns no results (best-effort design).

---

### 8.4 Section-Level Chunking for Embeddings
**Decision:** Chunk reports by markdown headers before embedding, not as a single document.

**Rationale:** Enables targeted semantic search. A query like "what are the risks for AAPL?" should retrieve the `risks` section, not a whole-document embedding that dilutes signal.

**Trade-off:** Multiple DB rows per analysis (~7 sections). For a 10-stock watchlist analyzed weekly, this is ~70 embeddings/week — negligible.

**Fallback:** If a report lacks section headers (old format or model non-compliance), the first 1000 chars are embedded as a single `null` section.

---

### 8.5 Best-Effort Vector Storage
**Decision:** Snapshot creation is on the critical path; embedding is not.

**Rationale:** The report and structured fundamentals must be stored so the dashboard works immediately after analysis. If embedding fails (API quota, network error), the snapshot is still useful for display — just not searchable by semantic query.

**Trade-off:** Silent embedding failures may confuse users who expect search to work. Errors are logged but not surfaced to the frontend.

---

### 8.6 Parsed Fundamentals from LLM Markdown
**Decision:** Extract price, PE, market cap, etc. from the LLM's own report via regex rather than storing raw API responses.

**Rationale:** The LLM already formats this data into a table. Parsing avoids storing duplicate raw API data in the DB.

**Trade-off:** Parser fragility. If the LLM changes table format, parsing silently returns null values (no crash, but missing dashboard data). Mitigated by explicit format instructions in the system prompt.

**Assumption:** The LLM will comply with the format contract reliably enough for structured extraction. In practice, `gemini-2.5-flash` follows it well.

---

### 8.7 Background Analysis on Watchlist Add
**Decision:** `POST /api/watchlist` triggers analysis via `setImmediate` (fire-and-forget).

**Rationale:** Users should not wait for a full LLM analysis (30-120 seconds) before getting HTTP 201. The background job populates the dashboard asynchronously.

**Trade-off:** No way for the frontend to track completion. The dashboard must poll/refresh manually. If the background job fails, the watchlist item exists but has no analysis snapshot — the dashboard shows empty data until the user manually triggers analysis.

---

### 8.8 Multi-Tenant by Supabase User ID
**Decision:** All DB records (watchlist, snapshots, embeddings) are scoped by `userId` (Supabase UUID). No data is shared across users.

**Rationale:** Clean isolation, no cross-user data leaks. Simple to implement with Prisma `WHERE userId = ...`.

**Trade-off:** No shared analysis cache. If 100 users all add AAPL to their watchlist, each gets their own analysis run and their own snapshot. For a shared-analysis architecture, a separate public cache layer would be needed.

---

### 8.9 SSE for Chat Streaming (not WebSocket)
**Decision:** Use Server-Sent Events (SSE) for the chat endpoint.

**Rationale:** SSE is simpler than WebSocket for unidirectional streaming (server → client). Native browser support, works through HTTP proxies, easier to implement on Express.

**Trade-off:** Unidirectional only. The client cannot push new data mid-stream. For chat this is fine since each message is request-response. For collaborative or multi-user features, WebSocket would be needed.

---

### 8.10 Singleton vs. Per-User MCP Manager
**Decision:** Global singleton `getMCPManager()` for warming up at boot; per-user `createUserMCPManager(userId)` for chat and analysis.

**Rationale:** The history-server needs `ANALYSIS_USER_ID` in its environment to scope queries. The singleton is used for health checking and pre-warming the connection. Per-user managers are created fresh with the correct `userId` in env.

**Trade-off:** Per-user managers add process startup overhead per request. This is ~1-2 seconds. Acceptable for infrequent, latency-tolerant analysis and chat requests.

---

## 9. API Reference

### Authentication
All `/api/*` routes require: `Authorization: Bearer <supabase-jwt>`

### Endpoints

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/api/watchlist` | — | `WatchlistItem[]` |
| POST | `/api/watchlist` | `{ symbol }` | `{ id, symbol, addedAt }` (201) |
| DELETE | `/api/watchlist/:symbol` | — | `{ symbol, message }` |
| POST | `/api/analyze` | `{ symbols?, model? }` | `AnalysisResult` |
| GET | `/api/history/:symbol` | `?query&top_k` | `HistoryMatch[]` |
| GET | `/api/history/:symbol/trend` | `?days` | `TrendPoint[]` |
| GET | `/api/history/:symbol/diff` | — | `SnapshotDiff` (404 if <2 snapshots) |
| GET | `/api/history/:symbol/latest` | — | `RichHistoryMatch \| null` |
| GET | `/api/news/:symbol` | `?days_back` | `NewsArticle[]` |
| POST | `/api/chat` | `{ message, history? }` | SSE stream |

### SSE Event Types (POST /api/chat)
```typescript
{ type: "token",      content: string }
{ type: "tool_start", name: string }
{ type: "tool_done",  name: string }
{ type: "done" }
{ type: "error",      message: string }
```

---

## 10. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase Postgres connection string |
| `GEMINI_API_KEY` | Yes (default model) | Gemini LLM + embeddings |
| `FINNHUB_API_KEY` | Yes | News data |
| `VITE_SUPABASE_URL` | Yes (frontend) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (frontend) | Supabase public anon key |
| `MODEL` | No | Default: `gemini-2.5-flash` |
| `PORT` | No | Default: `8001` |
| `ANTHROPIC_API_KEY` | No | For `claude-*` models |
| `OPENAI_API_KEY` | No | For `gpt-*` models |
| `OPENAI_BASE_URL` | No | Override base URL (Groq etc.) |
| `GCP_PROJECT` | No | Enables Vertex AI for Claude |
| `GCP_REGION` | No | Vertex AI region (default `us-central1`) |

---

## 11. Known Issues & Assumptions

| Issue | Impact | Status |
|---|---|---|
| `callTool` vs `callToolWithTimeout` mock mismatch in tests | 3 orchestrator tests fail | Pre-existing, not introduced by Pillar 2 |
| Parser fragility for LLM report format | Dashboard fundamentals silently null if format changes | Mitigated by strict system prompt |
| pgvector dimension locked to 768 | Switching embedding model requires migration | By design; Gemini is default |
| Background analysis on watchlist add has no progress tracking | Dashboard shows empty until manual refresh | UX limitation; fire-and-forget pattern |
| No shared analysis cache across users | Each user runs their own LLM calls for same symbol | By design; multi-tenant isolation |
| IVFFlat index requires minimum data before creation | Index must be created manually after initial data load | One-time setup SQL documented |
| MCP servers must be compiled before running | Cold `npm run dev` without `npm run build` first will fail | Documented in CLAUDE.md |

---

## 12. Build & Run Reference

```bash
# One-time database setup (Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS vector;

# Install dependencies
npm install

# Build (always required before running)
npm run build                          # shared + server (Prisma + tsc)
cd frontend && npm run build           # React SPA → frontend/dist/

# Development
npm run dev                            # Express on :8001
cd frontend && npm run dev             # Vite on :5173 (proxies /api to :8001)

# CLI
npm run cli -- --symbols AAPL NVDA --format terminal
npm run cli -- --watchlist watchlist.json --format markdown --output report.md
npm run cli -- --model claude-sonnet-4-20250514 --format json

# Tests
npm test
npx vitest run packages/server/tests/orchestrator.test.ts
npx vitest run --reporter=verbose -t "pattern"

# After first data is populated — create vector index
CREATE INDEX ON "AnalysisEmbedding" USING ivfflat (embedding vector_cosine_ops);
```
