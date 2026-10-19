import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  FastForward,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { StreamSummary, ReplayProgress } from '../../lib/types';
import { startReplay, fetchReplayProgress, stopReplay } from '../../lib/api';
import { formatNumber } from '../../lib/utils';

interface StreamReplayProps {
  streams: StreamSummary[];
}

export const StreamReplay: React.FC<StreamReplayProps> = ({ streams }) => {
  const [sourceStream, setSourceStream] = useState(streams[0]?.name || '');
  const [filterSubject, setFilterSubject] = useState('');
  const [startSeq, setStartSeq] = useState<number | ''>(1);
  const [targetSubject, setTargetSubject] = useState('');
  const [speed, setSpeed] = useState<number>(0); // 0 = instant

  const [activeReplay, setActiveReplay] = useState<ReplayProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeReplay && (activeReplay.status === 'running' || activeReplay.status === 'paused')) {
      interval = setInterval(async () => {
        try {
          const prog = await fetchReplayProgress(activeReplay.replayId);
          setActiveReplay(prog);
        } catch {
          // Replay may have concluded
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [activeReplay]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceStream) {
      setError('Source stream is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const prog = await startReplay({
        sourceStream,
        filterSubject: filterSubject.trim(),
        startSequence: startSeq === '' ? 1 : Number(startSeq),
        targetSubject: targetSubject.trim() || `${sourceStream.toLowerCase()}.replay`,
        speed: Number(speed),
      });
      setActiveReplay(prog);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to start stream replay');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeReplay) return;
    try {
      await stopReplay(activeReplay.replayId);
      setActiveReplay((prev) => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      alert('Failed to stop replay: ' + err);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-teal-400" />
              Historical Stream Replay Engine
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Re-publish stream messages from sequence or time to test downstream services
            </p>
          </div>
        </div>

        <form onSubmit={handleStart} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source Stream *</label>
              <select
                value={sourceStream}
                onChange={(e) => setSourceStream(e.target.value)}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              >
                {streams.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({formatNumber(s.messagesCount)} msgs)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Filter Subject (Optional)</label>
              <input
                type="text"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                placeholder="e.g. orders.created (leave empty for all)"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Sequence #</label>
              <input
                type="number"
                min="1"
                value={startSeq}
                onChange={(e) => setStartSeq(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Destination Target Subject</label>
              <input
                type="text"
                value={targetSubject}
                onChange={(e) => setTargetSubject(e.target.value)}
                placeholder={`e.g. ${sourceStream ? sourceStream.toLowerCase() : 'stream'}.replay (or original)`}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Replay Rate & Pacing</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 0, label: 'Instant', desc: 'As fast as possible' },
                { val: 1, label: '1x Real-Time', desc: 'Preserve timing' },
                { val: 2, label: '2x Speed', desc: 'Double throughput' },
                { val: 5, label: '5x Speed', desc: 'Fast replay' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSpeed(opt.val)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                    speed === opt.val
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                      : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-semibold block">{opt.label}</span>
                  <span className="text-[10px] text-slate-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || activeReplay?.status === 'running'}
              className="px-5 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Start Replay</span>
            </button>
          </div>
        </form>
      </div>

      {/* Replay Progress Panel */}
      {activeReplay && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-white">Replay #{activeReplay.replayId}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                  activeReplay.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : activeReplay.status === 'running'
                    ? 'bg-teal-500/20 text-teal-300 animate-pulse'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {activeReplay.status}
              </span>
            </div>

            {activeReplay.status === 'running' && (
              <button
                onClick={handleStop}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded flex items-center gap-1 transition-colors"
              >
                <Square className="w-3 h-3" />
                <span>Stop Replay</span>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>
                Replayed: {formatNumber(activeReplay.replayedCount)} / {formatNumber(activeReplay.totalMessages)} msgs
              </span>
              <span>{Math.round(activeReplay.percentage)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${activeReplay.percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
