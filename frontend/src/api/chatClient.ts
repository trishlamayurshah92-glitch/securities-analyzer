import { supabase } from '../lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatSSEEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_done'; name: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function streamChat(
  message: string,
  history: ChatMessage[],
  callbacks: {
    onToken: (text: string) => void;
    onToolStart: (name: string) => void;
    onToolDone: (name: string) => void;
    onDone: () => void;
    onError: (msg: string) => void;
  },
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.body) {
    callbacks.onError('No response body');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      try {
        const event: ChatSSEEvent = JSON.parse(part.slice(6));
        if (event.type === 'token') callbacks.onToken(event.content);
        else if (event.type === 'tool_start') callbacks.onToolStart(event.name);
        else if (event.type === 'tool_done') callbacks.onToolDone(event.name);
        else if (event.type === 'done') callbacks.onDone();
        else if (event.type === 'error') callbacks.onError(event.message);
      } catch {
        // skip malformed events
      }
    }
  }
}
