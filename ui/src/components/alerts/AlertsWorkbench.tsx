import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Terminal,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { AlertRule, AlertEvent } from '../../lib/types';
import {
  fetchAlertRules,
  createAlertRule,
  deleteAlertRule,
  fetchAlertEvents,
  testWebhook,
} from '../../lib/api';
import { formatDate } from '../../lib/utils';

export const AlertsWorkbench: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Rule Form
  const [isCreating, setIsCreating] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<'consumer_lag' | 'redelivery_ratio'>('consumer_lag');
  const [targetStream, setTargetStream] = useState('');
  const [threshold, setThreshold] = useState<number>(1000);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelType, setChannelType] = useState<'generic' | 'slack' | 'discord'>('generic');

  // Test webhook state
  const [testingWebhook, setTestingWebhook] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([fetchAlertRules(), fetchAlertEvents()]);
      setRules(r);
      setEvents(e);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyMetrics = () => {
    const url = `${window.location.origin}/metrics`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAlertRule({
        name: ruleName,
        type: ruleType,
        targetStream: targetStream || undefined,
        threshold,
        durationSeconds: 60,
        webhookUrl,
        channelType,
        enabled: true,
      });
      setNotification({ type: 'success', text: 'Alert rule created successfully.' });
      setIsCreating(false);
      setRuleName('');
      setWebhookUrl('');
      await loadData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to create rule' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteAlertRule(id);
      setNotification({ type: 'success', text: 'Rule deleted.' });
      await loadData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to delete rule' });
    }
  };

  const handleTestWebhook = async (url: string, channel: string) => {
    if (!url) {
      setNotification({ type: 'error', text: 'Please enter a webhook URL first.' });
      return;
    }
    setTestingWebhook(true);
    try {
      await testWebhook(url, channel);
      setNotification({ type: 'success', text: 'Webhook verified! Test alert received by endpoint.' });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Webhook verification failed' });
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="w-6 h-6 text-teal-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">
              Alerts & Prometheus Observability
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure automated threshold monitors for consumer lag and redelivery spikes, dispatch webhooks, and scrape metrics into Prometheus or Grafana.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg text-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
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

      {/* Prometheus Scrape Endpoint Banner */}
      <div className="p-5 bg-[#0F172A] border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Prometheus Scraper Endpoint</span>
          </div>
          <p className="text-xs text-slate-400">
            Standard Prometheus text format exposing cluster connections, memory, JetStream storage, consumer lag, and redelivery ratios.
          </p>
          <code className="inline-block text-[11px] font-mono text-teal-300 bg-[#0A0F1D] px-2 py-0.5 rounded border border-slate-800 mt-1">
            curl {window.location.origin}/metrics
          </code>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyMetrics}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center gap-2 border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied URL!' : 'Copy Endpoint URL'}</span>
          </button>
          <a
            href="/metrics"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs"
          >
            View /metrics
          </a>
        </div>
      </div>

      {/* Main Grid: Alert Rules and Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Alert Rules */}
        <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-teal-400" />
              <span>Monitoring & Alert Rules ({rules.length})</span>
            </h3>

            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rule</span>
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateRule} className="p-4 bg-[#0A0F1D] border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white">Create New Alert Rule</h4>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Payments Backlog"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300">Metric Condition</label>
                  <select
                    value={ruleType}
                    onChange={(e: any) => setRuleType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none"
                  >
                    <option value="consumer_lag">Consumer Lag &gt; Threshold</option>
                    <option value="redelivery_ratio">Redelivery Ratio &gt; %</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300">Threshold</label>
                  <input
                    type="number"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">Webhook URL (Slack / Discord / Generic)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                  <select
                    value={channelType}
                    onChange={(e: any) => setChannelType(e.target.value)}
                    className="px-2 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none"
                  >
                    <option value="generic">Generic JSON</option>
                    <option value="slack">Slack</option>
                    <option value="discord">Discord</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleTestWebhook(webhookUrl, channelType)}
                  disabled={testingWebhook || !webhookUrl}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs font-mono flex items-center gap-1.5 border border-slate-700"
                >
                  <Send className="w-3 h-3" />
                  <span>{testingWebhook ? 'Sending...' : 'Test Webhook'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className="p-3.5 bg-[#0A0F1D] border border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white font-mono">{r.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase ${
                        r.status === 'alerting'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                    Condition: {r.type} &gt; {r.threshold} | Channel: {r.channelType}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestWebhook(r.webhookUrl, r.channelType)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs"
                    title="Test Webhook"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg text-xs"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Incident Notification Events */}
        <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Incident Audit Log ({events.length})</span>
          </h3>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No alert incidents recorded. Cluster is operating within normal parameters.
              </div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 bg-[#0A0F1D] border border-slate-800 rounded-xl space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-rose-300 font-mono">{evt.ruleName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(evt.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono">{evt.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
