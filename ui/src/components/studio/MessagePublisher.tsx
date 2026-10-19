import React, { useState } from 'react';
import {
  SendHorizontal,
  Plus,
  Trash2,
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
} from 'lucide-react';
import { PublishMessageRequest, PublishMessageResponse } from '../../lib/types';
import { publishMessage } from '../../lib/api';

export const MessagePublisher: React.FC = () => {
  const [subject, setSubject] = useState('orders.created');
  const [payload, setPayload] = useState(`{\n  "orderId": "ORD-9021",\n  "customerId": "CUST-42",\n  "amount": 149.99,\n  "currency": "USD"\n}`);
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([
    { key: 'Nats-Msg-Id', value: `msg-dedup-${Date.now()}` },
    { key: 'Correlation-Id', value: `corr-${Date.now()}` },
  ]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<PublishMessageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddHeader = (key = '', value = '') => {
    setHeaders([...headers, { key, value }]);
  };

  const handleRemoveHeader = (idx: number) => {
    setHeaders(headers.filter((_, i) => i !== idx));
  };

  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[idx][field] = val;
    setHeaders(updated);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(payload);
      setPayload(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      setError('Payload is not valid JSON');
    }
  };

  const handleLoadTemplate = (type: 'order' | 'telemetry' | 'user') => {
    if (type === 'order') {
      setSubject('orders.created');
      setPayload(JSON.stringify({
        orderId: `ORD-${Math.floor(Math.random() * 9000 + 1000)}`,
        customerId: `CUST-${Math.floor(Math.random() * 900 + 100)}`,
        amount: parseFloat((Math.random() * 200 + 15).toFixed(2)),
        currency: 'USD',
        status: 'created',
        timestamp: new Date().toISOString(),
      }, null, 2));
    } else if (type === 'telemetry') {
      setSubject('telemetry.system.metrics');
      setPayload(JSON.stringify({
        node: 'edge-cluster-01',
        cpuUsage: parseFloat((Math.random() * 40 + 10).toFixed(1)),
        memoryMb: Math.floor(Math.random() * 512 + 1024),
        activeConnections: Math.floor(Math.random() * 100 + 5),
        timestamp: new Date().toISOString(),
      }, null, 2));
    } else {
      setSubject('users.signup');
      setPayload(JSON.stringify({
        userId: `usr_${Math.floor(Math.random() * 90000 + 10000)}`,
        email: `dev_${Math.floor(Math.random() * 1000)}@example.com`,
        plan: 'enterprise',
        tier: 1,
        verified: true,
      }, null, 2));
    }

    // Refresh msg id
    const newHeaders = headers.map((h) =>
      h.key === 'Nats-Msg-Id' ? { ...h, value: `msg-${Date.now()}` } : h
    );
    setHeaders(newHeaders);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    const headerMap: Record<string, string[]> = {};
    let msgId = '';

    headers.forEach((h) => {
      if (h.key.trim() && h.value.trim()) {
        if (h.key.trim().toLowerCase() === 'nats-msg-id') {
          msgId = h.value.trim();
        } else {
          if (!headerMap[h.key.trim()]) {
            headerMap[h.key.trim()] = [];
          }
          headerMap[h.key.trim()].push(h.value.trim());
        }
      }
    });

    try {
      const res = await publishMessage({
        subject: subject.trim(),
        payload: payload,
        headers: headerMap,
        msgId: msgId,
      });
      setResponse(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to publish message');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handlePublish} className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        {/* Template Generators */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <SendHorizontal className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">Message Publisher Studio</h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] mr-1">Load Template:</span>
            <button
              type="button"
              onClick={() => handleLoadTemplate('order')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono text-[11px] transition-colors"
            >
              Order Event
            </button>
            <button
              type="button"
              onClick={() => handleLoadTemplate('telemetry')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[11px] transition-colors"
            >
              Telemetry
            </button>
            <button
              type="button"
              onClick={() => handleLoadTemplate('user')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[11px] transition-colors"
            >
              User Signup
            </button>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Target Subject *</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. orders.created, telemetry.system"
            className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Headers Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Message Headers</label>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleAddHeader('Nats-Msg-Id', `msg-${Date.now()}`)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 font-mono text-[10px]"
                title="Add deduplication header"
              >
                + Nats-Msg-Id
              </button>
              <button
                type="button"
                onClick={() => handleAddHeader()}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
              >
                + Custom Header
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {headers.map((h, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Header Name"
                  value={h.key}
                  onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                  className="w-1/3 px-2.5 py-1 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <input
                  type="text"
                  placeholder="Header Value"
                  value={h.value}
                  onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                  className="flex-1 px-2.5 py-1 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveHeader(idx)}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payload Body */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-300">Payload (JSON / Text)</label>
            <button
              type="button"
              onClick={handleFormatJson}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] flex items-center gap-1 transition-colors"
            >
              <FileCode className="w-3 h-3" />
              Format JSON
            </button>
          </div>

          <textarea
            rows={8}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full p-3 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
            placeholder="Enter message body..."
          />
        </div>

        {/* Publish Action & Feedback */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex-1">
            {error && (
              <div className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizontal className="w-3.5 h-3.5" />}
            <span>Publish Message</span>
          </button>
        </div>
      </form>

      {/* Response Confirmation Box */}
      {response && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Message Published Successfully!</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs pt-1">
            <div className="p-2 bg-[#090D16] rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Stream</span>
              <span className="text-white font-bold">{response.stream}</span>
            </div>
            <div className="p-2 bg-[#090D16] rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Sequence</span>
              <span className="text-teal-400 font-bold">#{response.sequence}</span>
            </div>
            <div className="p-2 bg-[#090D16] rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Duplicate</span>
              <span className={response.duplicate ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                {response.duplicate ? 'TRUE (Deduplicated)' : 'FALSE'}
              </span>
            </div>
            <div className="p-2 bg-[#090D16] rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Ack Timestamp</span>
              <span className="text-slate-300">{response.timestamp}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
