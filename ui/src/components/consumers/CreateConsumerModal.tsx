import React, { useState } from 'react';
import { X, Gauge, AlertCircle, Loader2 } from 'lucide-react';
import { CreateConsumerRequest, StreamSummary } from '../../lib/types';

interface CreateConsumerModalProps {
  isOpen: boolean;
  onClose: () => void;
  streams: StreamSummary[];
  defaultStream?: string;
  onSubmit: (req: CreateConsumerRequest) => Promise<void>;
}

export const CreateConsumerModal: React.FC<CreateConsumerModalProps> = ({
  isOpen,
  onClose,
  streams,
  defaultStream,
  onSubmit,
}) => {
  const [streamName, setStreamName] = useState(defaultStream || (streams[0]?.name || ''));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [isPull, setIsPull] = useState(true);
  const [deliverSubject, setDeliverSubject] = useState('');
  const [ackPolicy, setAckPolicy] = useState<'explicit' | 'all' | 'none'>('explicit');
  const [deliverPolicy, setDeliverPolicy] = useState<'all' | 'last' | 'new'>('all');
  const [ackWaitSeconds, setAckWaitSeconds] = useState(30);
  const [maxDeliver, setMaxDeliver] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Consumer name is required');
      return;
    }
    if (!streamName) {
      setError('Target stream is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        streamName,
        name: name.trim(),
        description: description.trim(),
        filterSubject: filterSubject.trim(),
        deliverSubject: isPull ? '' : deliverSubject.trim(),
        ackPolicy,
        deliverPolicy,
        ackWaitSeconds: Number(ackWaitSeconds),
        maxDeliver: Number(maxDeliver),
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create consumer');
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
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create JetStream Consumer</h2>
              <p className="text-xs text-slate-400">Configure durable consumer, ack policy, and timeouts</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Stream *</label>
              <select
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              >
                {streams.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Durable Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. order-processor-v1"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Worker pulling unacknowledged orders"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Filter Subject (optional)</label>
            <input
              type="text"
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              placeholder="e.g. orders.created (leave blank for all)"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Consumer Delivery Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPull(true)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                  isPull
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-semibold block">Pull Consumer (Recommended)</span>
                <span className="text-[10px] text-slate-400">Worker batches fetch on demand</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPull(false)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                  !isPull
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-semibold block">Push Consumer</span>
                <span className="text-[10px] text-slate-400">NATS pushes to deliver subject</span>
              </button>
            </div>
          </div>

          {!isPull && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Deliver Subject</label>
              <input
                type="text"
                value={deliverSubject}
                onChange={(e) => setDeliverSubject(e.target.value)}
                placeholder="e.g. workers.order.dispatch"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ack Policy</label>
              <select
                value={ackPolicy}
                onChange={(e) => setAckPolicy(e.target.value as 'explicit' | 'all' | 'none')}
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="explicit">Explicit</option>
                <option value="all">All</option>
                <option value="none">None</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">AckWait (Sec)</label>
              <input
                type="number"
                min="1"
                value={ackWaitSeconds}
                onChange={(e) => setAckWaitSeconds(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Max Deliver</label>
              <input
                type="number"
                min="1"
                value={maxDeliver}
                onChange={(e) => setMaxDeliver(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              />
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
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Creating...' : 'Create Consumer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
