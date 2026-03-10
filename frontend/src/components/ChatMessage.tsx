import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMsg } from '../api/chatClient';

interface Props {
  message: ChatMsg;
}

export default function ChatMessage({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3 text-sm text-gray-100">
        {message.content ? (
          <div className="prose prose-invert prose-sm max-w-none
            prose-table:text-xs prose-th:border prose-th:border-gray-600 prose-th:px-2 prose-th:py-1
            prose-td:border prose-td:border-gray-700 prose-td:px-2 prose-td:py-1
            prose-headings:text-gray-100 prose-a:text-emerald-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="inline-block h-4 w-1 animate-pulse bg-emerald-400" />
        )}
      </div>
    </div>
  );
}
