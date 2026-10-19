import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Eraser,
  Layers,
  HardDrive,
  Clock,
  Gauge,
  Search,
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  Tag,
  AlertTriangle,
  Loader2,
  Download,
} from 'lucide-react';
import { StreamDetail as IStreamDetail, StreamMessage, ConsumerSummary } from '../../lib/types';
import { browseMessages, purgeStream, deleteStream, deleteMessage, fetchConsumers, exportStream } from '../../lib/api';
import { formatBytes, formatNumber, formatDate } from '../../lib/utils';
import { SubjectHierarchy } from './SubjectHierarchy';

interface StreamDetailProps {
  stream: IStreamDetail;
  onBack: () => void;
  onRefresh: () => void;
  onSelectConsumer?: (consumerName: string) => void;
}

export const StreamDetail: React.FC<StreamDetailProps> = ({
  stream,
  onBack,
  onRefresh,
  onSelectConsumer,
}) => {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'messages' | 'consumers'>('hierarchy');
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [consumers, setConsumers] = useState<ConsumerSummary[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<StreamMessage | null>(null);
  const [startSeq, setStartSeq] = useState<number>(stream.firstSeq || 1);
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'messages') {
      loadMessages();
    } else if (activeTab === 'consumers') {
      loadConsumers();
    }
  }, [activeTab, stream.name]);

  const loadMessages = async (seq = startSeq) => {
    setLoadingMessages(true);
    try {
      const msgs = await browseMessages(stream.name, seq, 30, filterSubject);
      setMessages(msgs);
      if (msgs.length > 0 && !selectedMessage) {
        setSelectedMessage(msgs[0]);
      }
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadConsumers = async () => {
    try {
      const cons = await fetchConsumers(stream.name);
      setConsumers(cons);
    } catch (err) {
      console.error('Failed to load consumers', err);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm(`Are you sure you want to purge all messages in stream ${stream.name}?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await purgeStream(stream.name);
      onRefresh();
      if (activeTab === 'messages') loadMessages();
    } catch (err) {
      alert('Failed to purge stream: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStream = async () => {
    if (!window.confirm(`Are you sure you want to completely delete stream ${stream.name}? This action cannot be undone.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteStream(stream.name);
      onBack();
    } catch (err) {
      alert('Failed to delete stream: ' + err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMsg = async (seq: number) => {
    if (!window.confirm(`Delete message at sequence ${seq}?`)) return;
    try {
      await deleteMessage(stream.name, seq);
      setMessages((prev) => prev.filter((m) => m.sequence !== seq));
      if (selectedMessage?.sequence === seq) {
        setSelectedMessage(null);
      }
    } catch (err) {
      alert('Failed to delete message: ' + err);
    }
  };

  const [exportLoading, setExportLoading] = useState(false);

  const handleExportStream = async () => {
    setExportLoading(true);
    try {
      const data = await exportStream(stream.name, 500);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `natslens-stream-${stream.name}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Stream export failed: ' + (err.message || err));
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white font-mono tracking-tight">{stream.name}</h2>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 uppercase font-mono">
                {stream.storage}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                {stream.retention}
              </span>
            </div>
            {stream.description && <p className="text-xs text-slate-400 mt-0.5">{stream.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Stream Slice */}
          <button
            onClick={handleExportStream}
            disabled={exportLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Export up to 500 stream messages to JSON"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>{exportLoading ? 'Exporting...' : 'Export Slice'}</span>
          </button>

          <button
            onClick={handlePurge}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Purge All
          </button>
          <button
            onClick={handleDeleteStream}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Stream
          </button>
        </div>
      </div>

      {/* Stream Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 block">Total Messages</span>
          <span className="font-mono text-base font-bold text-white mt-1 block">
            {formatNumber(stream.messagesCount)}
          </span>
        </div>

        <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 block">Storage Size</span>
          <span className="font-mono text-base font-bold text-teal-400 mt-1 block">
            {formatBytes(stream.bytesCount)}
          </span>
        </div>

        <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 block">Active Consumers</span>
          <span className="font-mono text-base font-bold text-amber-400 mt-1 block">
            {stream.consumerCount}
          </span>
        </div>

        <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 block">Sequence Range</span>
          <span className="font-mono text-xs font-semibold text-slate-200 mt-1 block">
            #{stream.firstSeq} → #{stream.lastSeq}
          </span>
        </div>

        <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 block">Max Age TTL</span>
          <span className="font-mono text-xs font-semibold text-slate-200 mt-1 block">
            {stream.maxAgeSeconds > 0 ? `${stream.maxAgeSeconds}s` : 'Unlimited'}
          </span>
        </div>

        <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
          <span className="text-[11px] text-slate-400 block">Dedup Window</span>
          <span className="font-mono text-xs font-semibold text-slate-200 mt-1 block">
            {stream.duplicateWindowSeconds > 0 ? `${stream.duplicateWindowSeconds}s` : 'None'}
          </span>
        </div>
      </div>

      {/* Stream Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'hierarchy'
              ? 'border-teal-500 text-teal-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Subject Hierarchy & Subjects
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'messages'
              ? 'border-teal-500 text-teal-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code className="w-4 h-4" />
          Message Browser & Inspector
        </button>

        <button
          onClick={() => setActiveTab('consumers')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'consumers'
              ? 'border-teal-500 text-teal-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gauge className="w-4 h-4" />
          Consumers ({stream.consumerCount})
        </button>
      </div>

      {/* Tab 1: Subject Hierarchy */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          <SubjectHierarchy root={stream.subjectHierarchy} />

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Configured Subject Mappings
            </h4>
            <div className="flex flex-wrap gap-2">
              {stream.subjects.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-md font-mono text-xs text-teal-300 flex items-center gap-1.5"
                >
                  <Tag className="w-3 h-3 text-teal-400" />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Message Browser */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Start Sequence:</span>
              <input
                type="number"
                min={stream.firstSeq || 1}
                max={stream.lastSeq}
                value={startSeq}
                onChange={(e) => setStartSeq(Number(e.target.value))}
                className="w-24 px-2 py-1 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={() => loadMessages(startSeq)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
              >
                Jump
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter subject (e.g. orders.paid)"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadMessages()}
                  className="pl-8 pr-3 py-1 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 w-48 sm:w-64"
                />
              </div>

              <button
                onClick={() => {
                  const prev = Math.max(Number(stream.firstSeq || 1), startSeq - 30);
                  setStartSeq(prev);
                  loadMessages(prev);
                }}
                disabled={startSeq <= (stream.firstSeq || 1)}
                className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const next = startSeq + 30;
                  setStartSeq(next);
                  loadMessages(next);
                }}
                disabled={startSeq >= stream.lastSeq}
                className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Browser Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Messages List (Left) */}
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden max-h-[550px] flex flex-col">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 bg-slate-900/50">
                <span>Message List</span>
                {loadingMessages && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No messages found matching sequence or filter.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSelected = selectedMessage?.sequence === m.sequence;
                    return (
                      <div
                        key={m.sequence}
                        onClick={() => setSelectedMessage(m)}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-teal-500/10 border-l-2 border-teal-500'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-semibold text-teal-300">
                            #{m.sequence}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDate(m.timestamp)}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-slate-300 truncate mb-1">
                          {m.subject}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate font-mono">
                          {m.payload.slice(0, 70)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Message Detail Inspector (Right) */}
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col max-h-[550px]">
              {selectedMessage ? (
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">
                          Sequence #{selectedMessage.sequence}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-teal-400 border border-slate-700">
                          {selectedMessage.payloadType}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        Subject: <span className="text-teal-300">{selectedMessage.subject}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteMsg(selectedMessage.sequence)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete this message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Headers if present */}
                  {selectedMessage.headers && Object.keys(selectedMessage.headers).length > 0 && (
                    <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-xs">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                        Headers
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        {Object.entries(selectedMessage.headers).map(([k, vals]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-teal-400 shrink-0">{k}:</span>
                            <span className="text-slate-300">{vals.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payload Body */}
                  <div className="flex-1 overflow-y-auto bg-[#090D16] p-3 rounded-lg border border-slate-800 font-mono text-xs">
                    <pre className="text-slate-200 whitespace-pre-wrap break-all">
                      {selectedMessage.payloadType === 'json'
                        ? JSON.stringify(JSON.parse(selectedMessage.payload), null, 2)
                        : selectedMessage.payload}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8">
                  <FileText className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs">Select a message on the left to inspect payload and headers.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Consumers on this Stream */}
      {activeTab === 'consumers' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Consumer Name</th>
                <th className="p-3.5">Mode</th>
                <th className="p-3.5">Filter Subject</th>
                <th className="p-3.5">Pending Lag</th>
                <th className="p-3.5">In-Flight (Ack Pending)</th>
                <th className="p-3.5">Redelivered</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {consumers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No consumers configured for stream {stream.name}.
                  </td>
                </tr>
              ) : (
                consumers.map((c) => (
                  <tr
                    key={c.name}
                    onClick={() => onSelectConsumer && onSelectConsumer(c.name)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-mono font-medium text-white">{c.name}</td>
                    <td className="p-3.5 font-mono">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {c.isPull ? 'PULL' : 'PUSH'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">{c.filterSubject || '>'}</td>
                    <td className="p-3.5 font-mono text-slate-200">{formatNumber(c.numPending)}</td>
                    <td className="p-3.5 font-mono text-slate-200">{formatNumber(c.numAckPending)}</td>
                    <td className="p-3.5 font-mono">
                      <span
                        className={`font-semibold ${
                          c.numRedelivered > 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {formatNumber(c.numRedelivered)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          c.healthStatus === 'healthy'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.healthStatus === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {c.healthStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
