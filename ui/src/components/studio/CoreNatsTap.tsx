import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Play,
  Pause,
  Trash2,
  Send,
  Zap,
  Clock,
  Code,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { TapMessage, RequestReplyResponse } from '../../lib/types';
import { sendRequestReply } from '../../lib/api';
import { formatDate } from '../../lib/utils';

export const CoreNatsTap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tap' | 'probe'>('tap');

  // Tap State
  const [tapSubject, setTapSubject] = useState('>');
  const [isTapping, setIsTapping] = useState(true);
  const [tapMessages, setTapMessages] = useState<TapMessage[]>([]);
  const [selectedTapMsg, setSelectedTapMsg] = useState<TapMessage | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Probe State
  const [probeSubject, setProbeSubject] = useState('service.orders.quote');
  const [probePayload, setProbePayload] = useState('{\n  "sku": "PRO-DEVICE-01",\n  "qty": 2\n}');
  const [probeTimeout, setProbeTimeout] = useState(1500);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResponse, setProbeResponse] = useState<RequestReplyResponse | null>(null);

  useEffect(() => {
    if (activeTab !== 'tap' || !isTapping) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const es = new EventSource(`/api/tap?subject=${encodeURIComponent(tapSubject)}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg: TapMessage = JSON.parse(e.data);
        setTapMessages((prev) => [msg, ...prev.slice(0, 200)]);
      } catch (err) {
        console.error('Failed to parse tap message', err);
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [activeTab, isTapping, tapSubject]);

  const handleSendProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeSubject.trim()) return;
    setProbeLoading(true);
    setProbeResponse(null);

    try {
      const res = await sendRequestReply({
        subject: probeSubject.trim(),
        payload: probePayload,
        timeoutMs: Number(probeTimeout),
      });
      setProbeResponse(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProbeResponse({
          subject: probeSubject,
          payload: '',
          latencyMs: 0,
          error: err.message,
        });
      }
    } finally {
      setProbeLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Navigation Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('tap')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'tap'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Radio className="w-4 h-4 text-teal-400" />
          Live Subject Tap (WireSniffer)
        </button>

        <button
          onClick={() => setActiveTab('probe')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'probe'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-indigo-400" />
          Request-Reply Latency Probe
        </button>
      </div>

      {activeTab === 'tap' ? (
        <div className="space-y-4">
          {/* Tap Controls */}
          <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-xs text-slate-400 whitespace-nowrap">Tap Subject:</span>
              <input
                type="text"
                value={tapSubject}
                onChange={(e) => setTapSubject(e.target.value)}
                placeholder="> (or orders.*, telemetry.>)"
                className="w-full px-3 py-1.5 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTapping(!isTapping)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isTapping
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isTapping ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isTapping ? 'Pause Tap' : 'Start Tap'}</span>
              </button>

              <button
                onClick={() => {
                  setTapMessages([]);
                  setSelectedTapMsg(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Clear Tap"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Split Tap Stream View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Messages Feed */}
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[550px]">
              <div className="p-3 bg-slate-900/60 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isTapping ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  Captured Messages ({tapMessages.length})
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 flex-1 overflow-y-auto">
                {tapMessages.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    Listening for incoming messages on subject "{tapSubject}"...
                  </div>
                ) : (
                  tapMessages.map((m) => {
                    const isSelected = selectedTapMsg?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedTapMsg(m)}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-teal-500/10 border-l-2 border-teal-500'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-teal-300 truncate">
                            {m.subject}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDate(m.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-mono truncate">
                          {m.payload.slice(0, 60)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Tap Inspector (Right) */}
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col max-h-[550px]">
              {selectedTapMsg ? (
                <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                  <div className="border-b border-slate-800 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-teal-400">
                        Subject: {selectedTapMsg.subject}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        Size: {selectedTapMsg.size} B
                      </span>
                    </div>
                    {selectedTapMsg.reply && (
                      <span className="text-[11px] font-mono text-indigo-400 block mt-1">
                        Reply-To: {selectedTapMsg.reply}
                      </span>
                    )}
                  </div>

                  {/* Headers */}
                  {selectedTapMsg.headers && Object.keys(selectedTapMsg.headers).length > 0 && (
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                        Headers
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        {Object.entries(selectedTapMsg.headers).map(([k, vals]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-teal-400">{k}:</span>
                            <span className="text-slate-300">{vals.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payload */}
                  <div className="flex-1 overflow-y-auto bg-[#090D16] p-3 rounded-lg border border-slate-800 font-mono text-xs">
                    <pre className="text-slate-200 whitespace-pre-wrap break-all">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedTapMsg.payload), null, 2);
                        } catch {
                          return selectedTapMsg.payload;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-400 p-8">
                  <Radio className="w-8 h-8 text-slate-400 mb-2" />
                  <p>Click a message from the live stream on the left to inspect.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Request-Reply Probe */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleSendProbe} className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Zap className="w-4 h-4 text-indigo-400" />
              Request-Reply Latency Probe
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Subject *</label>
              <input
                type="text"
                required
                value={probeSubject}
                onChange={(e) => setProbeSubject(e.target.value)}
                placeholder="e.g. service.orders.quote"
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Timeout (Milliseconds)</label>
              <input
                type="number"
                min="50"
                max="30000"
                value={probeTimeout}
                onChange={(e) => setProbeTimeout(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Request Payload</label>
              <textarea
                rows={6}
                value={probePayload}
                onChange={(e) => setProbePayload(e.target.value)}
                className="w-full p-3 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={probeLoading}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-teal-500 hover:from-indigo-400 hover:to-teal-400 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {probeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send Synchronous Request</span>
            </button>
          </form>

          {/* Response Box */}
          <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 mb-4">
              Response & Latency Result
            </h3>

            {probeResponse ? (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span className="text-xs text-slate-300">Round-Trip Latency:</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-teal-300">
                    {probeResponse.latencyMs.toFixed(3)} ms
                  </span>
                </div>

                {probeResponse.error ? (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                    <span className="font-semibold block mb-0.5">Request Failed:</span>
                    <span className="font-mono">{probeResponse.error}</span>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-1">
                    <span className="text-[11px] font-medium text-slate-400">Reply Payload:</span>
                    <div className="flex-1 overflow-y-auto bg-[#090D16] p-3 rounded-lg border border-slate-800 font-mono text-xs">
                      <pre className="text-slate-200 whitespace-pre-wrap break-all">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(probeResponse.payload), null, 2);
                          } catch {
                            return probeResponse.payload || '(empty reply)';
                          }
                        })()}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8 text-xs">
                <Zap className="w-8 h-8 text-slate-400 mb-2" />
                <p>Send a request from the left to test latency and inspect synchronous response.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
