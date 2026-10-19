import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  RefreshCw,
  Search,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Code,
  Tag,
  ArrowRight,
  ShieldAlert,
  Send,
} from 'lucide-react';
import { DLQMessage, RepublishDLQRequest } from '../../lib/types';
import { fetchDLQMessages, republishDLQMessage, purgeDLQMessage, scanDLQ } from '../../lib/api';
import { formatDate } from '../../lib/utils';

export const DLQWorkbench: React.FC = () => {
  const [messages, setMessages] = useState<DLQMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<DLQMessage | null>(null);
  const [editedPayload, setEditedPayload] = useState<string>('');
  const [targetSubject, setTargetSubject] = useState<string>('');
  const [ackOriginal, setAckOriginal] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await fetchDLQMessages();
      setMessages(res);
      if (res.length > 0 && !selectedMessage) {
        selectMessage(res[0]);
      } else if (selectedMessage) {
        const found = res.find((m) => m.id === selectedMessage.id);
        if (found) selectMessage(found);
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to fetch DLQ messages' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const selectMessage = (msg: DLQMessage) => {
    setSelectedMessage(msg);
    setEditedPayload(msg.payload);
    setTargetSubject(msg.subject);
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await scanDLQ();
      setNotification({
        type: 'success',
        text: `Scan complete: discovered ${res.discovered} potential poison pills across active streams.`,
      });
      await loadMessages();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Scan failed' });
    } finally {
      setScanning(false);
    }
  };

  const handleRepublish = async () => {
    if (!selectedMessage) return;
    setActionLoading(true);
    try {
      const req: RepublishDLQRequest = {
        originalStream: selectedMessage.stream,
        targetSubject: targetSubject || selectedMessage.subject,
        payload: editedPayload,
        headers: selectedMessage.headers,
        acknowledgeOriginal: ackOriginal,
      };

      await republishDLQMessage(selectedMessage.id, req);
      setNotification({
        type: 'success',
        text: `Message ${selectedMessage.id} re-injected into subject ${req.targetSubject} successfully.`,
      });
      await loadMessages();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to republish message' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!selectedMessage) return;
    setActionLoading(true);
    try {
      await purgeDLQMessage(selectedMessage.id);
      setNotification({ type: 'success', text: `Quarantined message ${selectedMessage.id} purged.` });
      setSelectedMessage(null);
      await loadMessages();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to purge message' });
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = messages.filter(
    (m) =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      m.stream.toLowerCase().includes(search.toLowerCase()) ||
      m.errorReason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-rose-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">
              Poison Pill & DLQ Quarantine Workbench
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Isolate failed JetStream records exceeding MaxDeliver limits, inspect worker crash reasons, edit payloads, and re-inject into live streams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition-colors shadow-sm shadow-rose-500/20"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>Scan Streams for Poison Pills</span>
          </button>
          <button
            onClick={loadMessages}
            disabled={loading}
            className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
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

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Messages List */}
        <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID, stream, subject, or error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 divide-y divide-slate-800/50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No quarantined messages found.
              </div>
            ) : (
              filtered.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => selectMessage(msg)}
                    className={`pt-2.5 pb-2.5 px-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-rose-500/15 border border-rose-500/30'
                        : 'hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-rose-300">{msg.id}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase ${
                          msg.status === 'republished'
                            ? 'bg-teal-950 text-teal-400 border border-teal-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {msg.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span>Stream: {msg.stream}</span>
                      <span>•</span>
                      <span>Seq: #{msg.sequence}</span>
                      <span>•</span>
                      <span className="text-amber-400">Retries: {msg.redeliveries}</span>
                    </div>

                    <p className="text-[11px] text-rose-300/80 truncate mt-1">
                      {msg.errorReason}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Quarantine Inspector & Editor */}
        <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-5">
          {!selectedMessage ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              Select a quarantined message on the left to inspect payload and error details.
            </div>
          ) : (
            <>
              {/* Message Banner */}
              <div className="p-3.5 bg-rose-950/20 border border-rose-800/50 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Crash Reason / Exception</span>
                </div>
                <p className="text-xs font-mono text-rose-200">{selectedMessage.errorReason}</p>
                <div className="text-[10px] text-slate-400 pt-1">
                  Captured on: {formatDate(selectedMessage.timestamp)}
                </div>
              </div>

              {/* Target Subject Override */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Re-publish Target Subject
                </label>
                <input
                  type="text"
                  value={targetSubject}
                  onChange={(e) => setTargetSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* In-Place JSON Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-teal-400" />
                    <span>Payload Editor (Fix Corrupt or Invalid Fields)</span>
                  </label>
                  <button
                    onClick={() => setEditedPayload(selectedMessage.payload)}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Reset Original
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={editedPayload}
                  onChange={(e) => setEditedPayload(e.target.value)}
                  className="w-full p-3 bg-[#0A0F1D] border border-slate-800 rounded-xl text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500 leading-relaxed resize-y"
                />
              </div>

              {/* Options */}
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackOriginal}
                  onChange={(e) => setAckOriginal(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span>Delete / Acknowledge original poisoned sequence record (#{selectedMessage.sequence})</span>
              </label>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={handlePurge}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge from Quarantine</span>
                </button>

                <button
                  onClick={handleRepublish}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition-colors shadow-sm shadow-teal-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Re-publish to Stream</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
