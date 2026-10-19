import React, { useState } from 'react';
import {
  Gauge,
  Plus,
  Search,
  Pause,
  Play,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { ConsumerSummary, StreamSummary } from '../../lib/types';
import { pauseConsumer, resumeConsumer, deleteConsumer } from '../../lib/api';
import { formatNumber } from '../../lib/utils';
import { ConsumerLagHeatmap } from './ConsumerLagHeatmap';

interface ConsumerListProps {
  consumers: ConsumerSummary[];
  streams: StreamSummary[];
  onRefresh: () => void;
  onOpenCreateModal: () => void;
}

export const ConsumerList: React.FC<ConsumerListProps> = ({
  consumers,
  streams,
  onRefresh,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState(false);

  const filteredConsumers = consumers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.streamName.toLowerCase().includes(search.toLowerCase()) ||
      (c.filterSubject && c.filterSubject.toLowerCase().includes(search.toLowerCase()));
    const matchesStream = selectedStream === 'all' || c.streamName === selectedStream;
    return matchesSearch && matchesStream;
  });

  const handlePause = async (c: ConsumerSummary) => {
    setActionLoading(true);
    try {
      if (c.paused) {
        await resumeConsumer(c.streamName, c.name);
      } else {
        await pauseConsumer(c.streamName, c.name);
      }
      onRefresh();
    } catch (err) {
      alert('Failed to toggle pause status: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (c: ConsumerSummary) => {
    if (!window.confirm(`Delete consumer ${c.name} on stream ${c.streamName}?`)) return;
    setActionLoading(true);
    try {
      await deleteConsumer(c.streamName, c.name);
      onRefresh();
    } catch (err) {
      alert('Failed to delete consumer: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Heatmap View */}
      <ConsumerLagHeatmap
        consumers={consumers}
        onSelectConsumer={(c) => {
          setSearch(c.name);
        }}
      />

      {/* Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search consumers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 font-mono"
            />
          </div>

          <select
            value={selectedStream}
            onChange={(e) => setSelectedStream(e.target.value)}
            className="px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Streams ({streams.length})</option>
            {streams.map((s) => (
              <option key={s.name} value={s.name}>
                Stream: {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors shadow-sm shadow-amber-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Consumer</span>
        </button>
      </div>

      {/* Detailed Consumers Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Stream & Consumer</th>
                <th className="p-3.5">Type & Filter</th>
                <th className="p-3.5">Pending Lag</th>
                <th className="p-3.5">Ack Pending</th>
                <th className="p-3.5">Redelivered</th>
                <th className="p-3.5">AckWait</th>
                <th className="p-3.5">Health State</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredConsumers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No active consumers match your criteria.
                  </td>
                </tr>
              ) : (
                filteredConsumers.map((c) => (
                  <tr key={`${c.streamName}-${c.name}`} className="hover:bg-slate-800/40 transition-colors">
                    {/* Stream & Consumer Name */}
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-white text-xs">{c.name}</div>
                      <span className="text-[10px] text-teal-400 font-mono">Stream: {c.streamName}</span>
                    </td>

                    {/* Mode & Filter */}
                    <td className="p-3.5 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300">
                          {c.isPull ? 'PULL' : 'PUSH'}
                        </span>
                        <span className="text-slate-400">{c.ackPolicy}</span>
                      </div>
                      <span className="text-slate-400 text-[10px]">{c.filterSubject || '>'}</span>
                    </td>

                    {/* Pending Lag */}
                    <td className="p-3.5 font-mono">
                      <div className="font-semibold text-slate-200">{formatNumber(c.numPending)}</div>
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-teal-400 rounded-full"
                          style={{ width: `${Math.min((c.numPending / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* Ack Pending (In Flight) */}
                    <td className="p-3.5 font-mono text-slate-300">
                      <span className="font-medium text-slate-200">{formatNumber(c.numAckPending)}</span>
                    </td>

                    {/* Redelivered & Ratio */}
                    <td className="p-3.5 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold ${
                            c.numRedelivered > 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {formatNumber(c.numRedelivered)}
                        </span>
                        {c.redeliveryRatio > 0 && (
                          <span className="text-[10px] text-rose-400/80">
                            ({Math.round(c.redeliveryRatio * 100)}%)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* AckWait */}
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {c.ackWaitSeconds}s
                      </span>
                    </td>

                    {/* Health Status */}
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          c.healthStatus === 'healthy'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.healthStatus === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {c.healthStatus === 'healthy' && <CheckCircle2 className="w-3 h-3" />}
                        {c.healthStatus === 'warning' && <AlertTriangle className="w-3 h-3" />}
                        {c.healthStatus === 'critical' && <ShieldAlert className="w-3 h-3" />}
                        {c.healthStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handlePause(c)}
                        disabled={actionLoading}
                        title={c.paused ? 'Resume consumer' : 'Pause consumer'}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                      >
                        {c.paused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDelete(c)}
                        disabled={actionLoading}
                        title="Delete consumer"
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
