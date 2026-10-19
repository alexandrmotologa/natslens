import React, { useState, useEffect } from 'react';
import {
  Flame,
  Play,
  Square,
  RefreshCw,
  Zap,
  Clock,
  Gauge,
  Sliders,
  AlertTriangle,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { TrafficGeneratorConfig, TrafficGeneratorStatus } from '../../lib/types';
import { startTraffic, stopTraffic, fetchTrafficSessions } from '../../lib/api';

export const TrafficStudio: React.FC = () => {
  const [sessions, setSessions] = useState<TrafficGeneratorStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [targetSubject, setTargetSubject] = useState('orders.simulated');
  const [ratePerSec, setRatePerSec] = useState<number>(20);
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [payloadTemplate, setPayloadTemplate] = useState(
    '{\n  "orderId": "ord_{{uuid}}",\n  "timestamp": "{{now}}",\n  "amount": {{random_int}},\n  "unitPrice": {{random_float}},\n  "status": "CREATED"\n}'
  );

  // Chaos Knobs
  const [enableChaos, setEnableChaos] = useState(false);
  const [malformedRatio, setMalformedRatio] = useState<number>(0.05); // 5%
  const [jitterMs, setJitterMs] = useState<number>(50);
  const [injectHeaderError, setInjectHeaderError] = useState(false);

  const loadSessions = async () => {
    try {
      const list = await fetchTrafficSessions();
      setSessions(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const cfg: TrafficGeneratorConfig = {
        name: `load-${targetSubject}`,
        targetSubject,
        ratePerSec,
        durationSeconds,
        totalMessages,
        payloadTemplate,
        chaos: enableChaos
          ? {
              malformedPayloadRatio: malformedRatio,
              latencyJitterMs: jitterMs,
              injectHeaderError,
            }
          : undefined,
      };

      const res = await startTraffic(cfg);
      setNotification({
        type: 'success',
        text: `Traffic session ${res.sessionId} started at ${ratePerSec} msg/sec.`,
      });
      await loadSessions();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to start traffic generator' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopTraffic(id);
      setNotification({ type: 'success', text: `Session ${id} stopped.` });
      await loadSessions();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to stop session' });
    }
  };

  const insertVariable = (variable: string) => {
    setPayloadTemplate((prev) => prev + variable);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">
              Traffic Generator & Chaos Studio
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulate realistic message volume, evaluate consumer backpressure, benchmark stream storage throughput, and inject chaos anomalies.
          </p>
        </div>

        <button
          onClick={loadSessions}
          className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg text-xs self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-teal-950/40 border-teal-800/80 text-teal-300'
              : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
          }`}
        >
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Configuration */}
        <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-teal-400" />
            <span>Traffic Generator Setup</span>
          </h3>

          <form onSubmit={handleStart} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Target Subject</label>
                <input
                  type="text"
                  required
                  value={targetSubject}
                  onChange={(e) => setTargetSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Throughput Rate</label>
                  <span className="font-mono text-xs text-amber-400 font-bold">{ratePerSec} msg/s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  step="1"
                  value={ratePerSec}
                  onChange={(e) => setRatePerSec(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Duration (seconds)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 = unlimited"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Max Messages</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 = unlimited"
                  value={totalMessages}
                  onChange={(e) => setTotalMessages(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Template Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-teal-400" />
                  <span>Payload Template</span>
                </label>
                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => insertVariable('{{uuid}}')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700"
                  >
                    +uuid
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{{now}}')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700"
                  >
                    +now
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{{random_int}}')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700"
                  >
                    +random_int
                  </button>
                </div>
              </div>
              <textarea
                rows={6}
                value={payloadTemplate}
                onChange={(e) => setPayloadTemplate(e.target.value)}
                className="w-full p-3 bg-[#0A0F1D] border border-slate-800 rounded-xl text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500 resize-y"
              />
            </div>

            {/* Chaos Testing Knobs */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-amber-400 cursor-pointer">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Enable Chaos Engineering Fault Injection</span>
                </label>
                <input
                  type="checkbox"
                  checked={enableChaos}
                  onChange={(e) => setEnableChaos(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500"
                />
              </div>

              {enableChaos && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Corrupt Payload Ratio</span>
                      <span className="font-mono text-rose-400">{(malformedRatio * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.5"
                      step="0.01"
                      value={malformedRatio}
                      onChange={(e) => setMalformedRatio(Number(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Latency Jitter</span>
                      <span className="font-mono text-amber-400">{jitterMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={jitterMs}
                      onChange={(e) => setJitterMs(Number(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-amber-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Synthetic Traffic Session</span>
            </button>
          </form>
        </div>

        {/* Live Active Sessions */}
        <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span>Active Load Sessions ({sessions.filter((s) => s.active).length})</span>
          </h3>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active traffic runs. Launch a session on the left to start streaming synthetic load.
              </div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="p-4 bg-[#0A0F1D] border border-slate-800 rounded-xl space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-white block">
                        {sess.targetSubject}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {sess.id}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        sess.active
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {sess.active ? 'Streaming' : 'Finished'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sent</span>
                      <span className="text-xs font-bold text-white">
                        {sess.sentMessages.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Target Rate</span>
                      <span className="text-xs font-bold text-amber-400">{sess.targetRate} /s</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Elapsed</span>
                      <span className="text-xs font-bold text-slate-300">
                        {sess.elapsedSec.toFixed(0)}s
                      </span>
                    </div>
                  </div>

                  {sess.active && (
                    <button
                      onClick={() => handleStop(sess.id)}
                      className="w-full py-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop Session</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
