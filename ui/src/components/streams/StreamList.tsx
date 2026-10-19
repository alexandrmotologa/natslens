import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  HardDrive,
  Users,
  Tag,
  ArrowRight,
  Database,
} from 'lucide-react';
import { StreamSummary } from '../../lib/types';
import { formatBytes, formatNumber } from '../../lib/utils';

interface StreamListProps {
  streams: StreamSummary[];
  onSelectStream: (streamName: string) => void;
  onOpenCreateModal: () => void;
}

export const StreamList: React.FC<StreamListProps> = ({
  streams,
  onSelectStream,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');

  const filteredStreams = streams.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.subjects.some((sub) => sub.toLowerCase().includes(search.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Filter and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search streams or subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
          />
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors shadow-sm shadow-teal-500/20 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Stream</span>
        </button>
      </div>

      {/* Streams Cards Grid */}
      {filteredStreams.length === 0 ? (
        <div className="p-12 text-center bg-[#111827] border border-slate-800 rounded-xl">
          <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Streams Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            {search ? 'No streams match your filter query.' : 'There are no active JetStream streams in this cluster.'}
          </p>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded-lg text-xs font-medium"
          >
            Create Stream
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStreams.map((s) => (
            <div
              key={s.name}
              onClick={() => onSelectStream(s.name)}
              className="p-5 bg-[#111827] border border-slate-800 hover:border-teal-500/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-white text-base group-hover:text-teal-300 transition-colors">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-teal-400 border border-slate-700">
                          {s.storage}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                          {s.retention}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                </div>

                {s.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 my-2">{s.description}</p>
                )}

                {/* Subjects Badges */}
                <div className="flex flex-wrap gap-1.5 my-3">
                  {s.subjects.slice(0, 3).map((sub, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5 text-teal-400" />
                      {sub}
                    </span>
                  ))}
                  {s.subjects.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-400">
                      +{s.subjects.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Quick Metrics */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Messages</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formatNumber(s.messagesCount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bytes</span>
                  <span className="font-mono font-semibold text-teal-400">
                    {formatBytes(s.bytesCount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Consumers</span>
                  <span className="font-mono font-semibold text-amber-400">
                    {s.consumerCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
