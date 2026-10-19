import React, { useState, useEffect } from 'react';
import { X, History, Trash2, Tag, Loader2, ArrowRight } from 'lucide-react';
import { KVEntry } from '../../lib/types';
import { fetchKVHistory } from '../../lib/api';
import { formatDate } from '../../lib/utils';

interface KVRevisionHistoryProps {
  bucket: string;
  keyName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const KVRevisionHistory: React.FC<KVRevisionHistoryProps> = ({
  bucket,
  keyName,
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<KVEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRev, setSelectedRev] = useState<KVEntry | null>(null);

  useEffect(() => {
    if (isOpen && bucket && keyName) {
      loadHistory();
    }
  }, [isOpen, bucket, keyName]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const entries = await fetchKVHistory(bucket, keyName);
      // Newest revisions first
      const sorted = entries.sort((a, b) => b.revision - a.revision);
      setHistory(sorted);
      if (sorted.length > 0) {
        setSelectedRev(sorted[0]);
      }
    } catch (err) {
      console.error('Failed to load key revision history', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-slate-700/80 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold font-mono text-white">{keyName}</h2>
                <span className="text-xs text-slate-400 font-mono">({bucket})</span>
              </div>
              <p className="text-xs text-slate-400">Audit trail of historical key mutations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden min-h-[400px]">
          {/* Revision List (Left) */}
          <div className="md:col-span-5 border-r border-slate-800 flex flex-col overflow-y-auto">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Revisions ({history.length})</span>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />}
            </div>

            <div className="divide-y divide-slate-800/80 flex-1 overflow-y-auto">
              {history.map((rev) => {
                const isSelected = selectedRev?.revision === rev.revision;
                return (
                  <div
                    key={rev.revision}
                    onClick={() => setSelectedRev(rev)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-500/10 border-l-2 border-teal-500'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-white">
                        Rev #{rev.revision}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold uppercase ${
                          rev.isDeleted || rev.operation === 'DEL' || rev.operation === 'PURGE'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-teal-500/20 text-teal-300'
                        }`}
                      >
                        {rev.operation || (rev.isDeleted ? 'DEL' : 'PUT')}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block">
                      {formatDate(rev.created as unknown as string)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revision Payload (Right) */}
          <div className="md:col-span-7 p-4 flex flex-col overflow-hidden bg-[#090D16]">
            {selectedRev ? (
              <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-teal-300">
                      Revision #{selectedRev.revision} Payload
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Delta: {selectedRev.delta}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {formatDate(selectedRev.created as unknown as string)}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#111827] p-3 rounded-lg border border-slate-800 font-mono text-xs">
                  <pre className="text-slate-200 whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedRev.value), null, 2);
                      } catch {
                        return selectedRev.value || '(deleted / empty)';
                      }
                    })()}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Select a revision to view contents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
