import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Trash2, Tag, Loader2 } from 'lucide-react';
import { KVEntry } from '../../lib/types';
import { formatDate } from '../../lib/utils';

interface KVWatchFeedProps {
  bucket: string;
}

export const KVWatchFeed: React.FC<KVWatchFeedProps> = ({ bucket }) => {
  const [events, setEvents] = useState<KVEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!bucket) return;

    const es = new EventSource(`/api/kv/${encodeURIComponent(bucket)}/watch`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (e) => {
      if (isPaused) return;
      try {
        const entry: KVEntry = JSON.parse(e.data);
        setEvents((prev) => [entry, ...prev.slice(0, 150)]);
      } catch (err) {
        console.error('Error parsing KV watch message', err);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [bucket, isPaused]);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[480px]">
      {/* Header */}
      <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="font-semibold text-white">Live Mutation Watcher ({bucket})</span>
          <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
            SSE Stream /api/kv/{bucket}/watch
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={() => setEvents([])}
            className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Clear feed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Events Stream List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 font-mono text-xs p-2">
        {events.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Radio className="w-8 h-8 text-slate-400 mb-2 animate-pulse" />
            <p className="text-xs">Listening for real-time key modifications on bucket {bucket}...</p>
          </div>
        ) : (
          events.map((ev, idx) => (
            <div key={`${ev.key}-${ev.revision}-${idx}`} className="p-2.5 hover:bg-slate-800/40 rounded transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                      ev.operation === 'DEL' || ev.isDeleted
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-teal-500/20 text-teal-300'
                    }`}
                  >
                    {ev.operation || (ev.isDeleted ? 'DEL' : 'PUT')}
                  </span>
                  <span className="font-bold text-white text-xs">{ev.key}</span>
                  <span className="text-slate-400 text-[10px]">rev #{ev.revision}</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatDate(ev.created as unknown as string)}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate bg-[#090D16] p-1.5 rounded border border-slate-800/80">
                {ev.value || '(tombstone)'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
