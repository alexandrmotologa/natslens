import React, { useState } from 'react';
import { X, Database, AlertCircle, Loader2 } from 'lucide-react';
import { CreateKVBucketRequest } from '../../lib/types';

interface CreateKVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (req: CreateKVBucketRequest) => Promise<void>;
}

export const CreateKVModal: React.FC<CreateKVModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [bucket, setBucket] = useState('');
  const [description, setDescription] = useState('');
  const [storage, setStorage] = useState<'file' | 'memory'>('file');
  const [history, setHistory] = useState(10);
  const [ttlSeconds, setTtlSeconds] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucket.trim()) {
      setError('Bucket name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        bucket: bucket.trim(),
        description: description.trim(),
        storage,
        history: Number(history),
        ttlSeconds: ttlSeconds === '' ? 0 : Number(ttlSeconds),
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create KV bucket');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-slate-700/80 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create Key-Value Store</h2>
              <p className="text-xs text-slate-400">Backing JetStream KV bucket configuration</p>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Bucket Name *</label>
            <input
              type="text"
              required
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              placeholder="e.g. app-config, user-sessions"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dynamic configuration and feature flags"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Storage Backend</label>
              <select
                value={storage}
                onChange={(e) => setStorage(e.target.value as 'file' | 'memory')}
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="file">File (Persistent)</option>
                <option value="memory">Memory (RAM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">History Depth</label>
              <input
                type="number"
                min="1"
                max="64"
                value={history}
                onChange={(e) => setHistory(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">TTL (Seconds)</label>
            <input
              type="number"
              min="0"
              value={ttlSeconds}
              onChange={(e) => setTtlSeconds(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0 (Unlimited)"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
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
              <span>{loading ? 'Creating...' : 'Create KV Store'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
