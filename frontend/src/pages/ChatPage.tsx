import { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import ChatMessage from '../components/ChatMessage';
import ToolCallIndicator from '../components/ToolCallIndicator';

const STARTER_PROMPTS = [
  'How are my watchlist stocks doing today?',
  'Any news on NVDA?',
  'How has AAPL sentiment trended?',
  'Compare the P/E ratios in my watchlist',
];

export default function ChatPage() {
  const { messages, streaming, activeTools, error, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTools]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStarterClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const showStarters = messages.length === 0 && !streaming;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <h1 className="mb-4 text-2xl font-bold">Chat with your watchlist</h1>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-[#DFE1E6] bg-white p-4">
        {showStarters && (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <p className="text-sm text-[#8993A4]">Ask anything about your stocks</p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleStarterClick(prompt)}
                  className="rounded-full border border-[#C1C7D0] bg-[#F0F2F5] px-4 py-2 text-sm text-[#344563] transition hover:border-[#0052CC] hover:text-[#0052CC]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {activeTools.length > 0 && <ToolCallIndicator tools={activeTools} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          rows={1}
          placeholder={streaming ? 'Thinking...' : 'Ask about your stocks... (Enter to send)'}
          className="flex-1 resize-none rounded-xl border border-[#C1C7D0] bg-white px-4 py-3 text-sm text-[#172B4D] placeholder-[#8993A4] outline-none transition focus:border-[#0052CC] disabled:opacity-50"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={streaming || !input.trim()}
          className="rounded-xl bg-[#0052CC] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#0065FF] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
