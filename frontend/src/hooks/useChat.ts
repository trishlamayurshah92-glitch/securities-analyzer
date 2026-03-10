import { useState } from 'react';
import { streamChat, type ChatMessage } from '../api/chatClient';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(text: string) {
    if (streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const historySnapshot = [...messages, userMsg];

    setMessages(historySnapshot);
    setStreaming(true);
    setError(null);

    let assistantContent = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    await streamChat(text, [...messages, userMsg], {
      onToken: (token) => {
        assistantContent += token;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: assistantContent },
        ]);
      },
      onToolStart: (name) => setActiveTools((prev) => [...prev, name]),
      onToolDone: (name) => setActiveTools((prev) => prev.filter((t) => t !== name)),
      onDone: () => {
        setStreaming(false);
        setActiveTools([]);
      },
      onError: (msg) => {
        setError(msg);
        setStreaming(false);
        setActiveTools([]);
        // Remove the empty assistant message if nothing was received
        if (!assistantContent) {
          setMessages((prev) => prev.slice(0, -1));
        }
      },
    });
  }

  function clearMessages() {
    setMessages([]);
    setError(null);
  }

  return { messages, streaming, activeTools, error, sendMessage, clearMessages };
}
