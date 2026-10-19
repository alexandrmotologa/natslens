import React, { useState } from 'react';
import { SendHorizontal, RotateCcw } from 'lucide-react';
import { StreamSummary } from '../../lib/types';
import { MessagePublisher } from './MessagePublisher';
import { StreamReplay } from './StreamReplay';

interface MessageStudioProps {
  streams: StreamSummary[];
}

export const MessageStudio: React.FC<MessageStudioProps> = ({ streams }) => {
  const [activeTab, setActiveTab] = useState<'publish' | 'replay'>('publish');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('publish')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'publish'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <SendHorizontal className="w-4 h-4 text-teal-400" />
          Message Publisher Studio
        </button>

        <button
          onClick={() => setActiveTab('replay')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'replay'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-indigo-400" />
          Stream Replay Engine
        </button>
      </div>

      {activeTab === 'publish' ? (
        <MessagePublisher />
      ) : (
        <StreamReplay streams={streams} />
      )}
    </div>
  );
};
