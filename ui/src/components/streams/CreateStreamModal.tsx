import React, { useState } from 'react';
import { X, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { CreateStreamRequest } from '../../lib/types';

interface CreateStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (req: CreateStreamRequest) => Promise<void>;
}

export const CreateStreamModal: React.FC<CreateStreamModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectsStr, setSubjectsStr] = useState('');
  const [storage, setStorage] = useState<'file' | 'memory'>('file');
  const [retention, setRetention] = useState<'limits' | 'interest' | 'workqueue'>('limits');
  const [discard, setDiscard] = useState<'old' | 'new'>('old');
  const [maxMsgs, setMaxMsgs] = useState<number | ''>('');
  const [maxBytes, setMaxBytes] = useState<number | ''>('');
  const [maxAgeSeconds, setMaxAgeSeconds] = useState<number | ''>('');
  const [dupWindow, setDupWindow] = useState<number | ''>(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Stream name is required');
      return;
    }

    setLoading(true);
    setError(null);

    const subjects = subjectsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (subjects.length === 0) {
      subjects.push(`${name.trim()}.>`);
    }

    try {
      await onSubmit({
        name: name.trim().toUpperCase(),
        description: description.trim(),
        subjects,
        storage,
        retention,
        discard,
        maxMsgs: maxMsgs === '' ? 0 : Number(maxMsgs),
        maxBytes: maxBytes === '' ? 0 : Number(maxBytes),
        maxAgeSeconds: maxAgeSeconds === '' ? 0 : Number(maxAgeSeconds),
        duplicateWindowSeconds: dupWindow === '' ? 0 : Number(dupWindow),
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create stream');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-slate-700/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create JetStream Stream</h2>
              <p className="text-xs text-slate-400">Define message retention and subject mappings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Stream Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ORDERS, EVENTS, TELEMETRY"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Customer order lifecycle events"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Subjects (comma separated)
            </label>
            <input
              type="text"
              value={subjectsStr}
              onChange={(e) => setSubjectsStr(e.target.value)}
              placeholder="e.g. orders.*, orders.>, telemetry.metrics"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Leave empty to default to {name ? `${name}.>` : '{STREAM_NAME}.>'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Storage Backend</label>
              <select
                value={storage}
                onChange={(e) => setStorage(e.target.value as 'file' | 'memory')}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="file">File (Persistent Disk)</option>
                <option value="memory">Memory (Ultra High Throughput)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Retention Policy</label>
              <select
                value={retention}
                onChange={(e) => setRetention(e.target.value as 'limits' | 'interest' | 'workqueue')}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="limits">Limits (Keep until max age/bytes)</option>
                <option value="interest">Interest (Keep until all consumers read)</option>
                <option value="workqueue">WorkQueue (Drop once 1 consumer acks)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Max Messages</label>
              <input
                type="number"
                min="0"
                value={maxMsgs}
                onChange={(e) => setMaxMsgs(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Unlimited (0)"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              >
              </input>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Max Age (Seconds)</label>
              <input
                type="number"
                min="0"
                value={maxAgeSeconds}
                onChange={(e) => setMaxAgeSeconds(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 86400 (24h)"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              >
              </input>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Discard Policy</label>
              <select
                value={discard}
                onChange={(e) => setDiscard(e.target.value as 'old' | 'new')}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="old">Discard Old (FIFO)</option>
                <option value="new">Discard New (Reject when full)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Dedup Window (Seconds)</label>
              <input
                type="number"
                min="0"
                value={dupWindow}
                onChange={(e) => setDupWindow(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="120"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              >
              </input>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Creating...' : 'Create Stream'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
