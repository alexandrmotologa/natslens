import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Activity,
  Layers,
  Gauge,
  Database,
  FolderArchive,
  SendHorizontal,
  Radio,
  Share2,
  FileCode2,
  AlertOctagon,
  Flame,
  BellRing,
  ArrowRight,
  Plus,
  Play,
  Terminal,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { StreamSummary, KVBucketSummary, ConsumerSummary } from '../../lib/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  streams: StreamSummary[];
  kvBuckets: KVBucketSummary[];
  consumers: ConsumerSummary[];
  onSelectStream?: (name: string) => void;
  onSelectKVBucket?: (name: string) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Streams' | 'Consumers' | 'Key-Value' | 'Quick Actions';
  icon: React.FC<{ className?: string }>;
  action: () => void;
  subtext?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  streams,
  kvBuckets,
  consumers,
  onSelectStream,
  onSelectKVBucket,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const items: PaletteItem[] = [
    // Navigation
    {
      id: 'nav-cluster',
      title: 'Cluster Overview',
      category: 'Navigation',
      icon: Activity,
      subtext: 'Server memory, JetStream storage limits & connections',
      action: () => { onNavigate('cluster'); onClose(); },
    },
    {
      id: 'nav-topology',
      title: 'Topology Graph',
      category: 'Navigation',
      icon: Share2,
      subtext: 'Visual stream-to-consumer data flow graph',
      action: () => { onNavigate('topology'); onClose(); },
    },
    {
      id: 'nav-streams',
      title: 'Streams & Subjects',
      category: 'Navigation',
      icon: Layers,
      subtext: 'JetStream streams, subject trees & message browser',
      action: () => { onNavigate('streams'); onClose(); },
    },
    {
      id: 'nav-consumers',
      title: 'Consumer Lag & Heatmap',
      category: 'Navigation',
      icon: Gauge,
      subtext: 'In-flight ack pending, redeliveries & consumer health',
      action: () => { onNavigate('consumers'); onClose(); },
    },
    {
      id: 'nav-kv',
      title: 'Key-Value Workbench',
      category: 'Navigation',
      icon: Database,
      subtext: 'NATS KV buckets, revision histories & live SSE watcher',
      action: () => { onNavigate('kv'); onClose(); },
    },
    {
      id: 'nav-dlq',
      title: 'Poison Pill / DLQ Workbench',
      category: 'Navigation',
      icon: AlertOctagon,
      subtext: 'Quarantined stuck messages, JSON error editor & re-publish',
      action: () => { onNavigate('dlq'); onClose(); },
    },
    {
      id: 'nav-schemas',
      title: 'Schema Registry & Validator',
      category: 'Navigation',
      icon: FileCode2,
      subtext: 'JSON Schema definitions and subject wildcard bindings',
      action: () => { onNavigate('schemas'); onClose(); },
    },
    {
      id: 'nav-traffic',
      title: 'Traffic & Chaos Studio',
      category: 'Navigation',
      icon: Flame,
      subtext: 'Synthetic load generators, rate knobs & fault injection',
      action: () => { onNavigate('traffic'); onClose(); },
    },
    {
      id: 'nav-alerts',
      title: 'Alerts & Prometheus Metrics',
      category: 'Navigation',
      icon: BellRing,
      subtext: 'Webhook alert rules, /metrics scrape endpoint & events',
      action: () => { onNavigate('alerts'); onClose(); },
    },
    {
      id: 'nav-studio',
      title: 'Message Studio & Replay',
      category: 'Navigation',
      icon: SendHorizontal,
      subtext: 'Publish test payloads with Nats-Msg-Id & stream replays',
      action: () => { onNavigate('studio'); onClose(); },
    },
    {
      id: 'nav-tap',
      title: 'Live Tap & Latency Probe',
      category: 'Navigation',
      icon: Radio,
      subtext: 'Real-time Core NATS sniffer & nanosecond request-reply probe',
      action: () => { onNavigate('tap'); onClose(); },
    },
    {
      id: 'nav-objectstore',
      title: 'ObjectStore Explorer',
      category: 'Navigation',
      icon: FolderArchive,
      subtext: 'Upload and inspect binary objects in NATS ObjectStore',
      action: () => { onNavigate('objectstore'); onClose(); },
    },

    // Streams
    ...streams.map((s) => ({
      id: `stream-${s.name}`,
      title: `Stream: ${s.name}`,
      category: 'Streams' as const,
      icon: Layers,
      subtext: `${s.storage} storage | ${s.messagesCount.toLocaleString()} messages | ${s.subjects.join(', ')}`,
      action: () => {
        onNavigate('streams');
        if (onSelectStream) onSelectStream(s.name);
        onClose();
      },
    })),

    // Key-Value Buckets
    ...kvBuckets.map((b) => ({
      id: `kv-${b.bucket}`,
      title: `KV Bucket: ${b.bucket}`,
      category: 'Key-Value' as const,
      icon: Database,
      subtext: `${b.valuesCount} keys | ${b.storage} storage | history: ${b.history}`,
      action: () => {
        onNavigate('kv');
        if (onSelectKVBucket) onSelectKVBucket(b.bucket);
        onClose();
      },
    })),

    // Consumers
    ...consumers.map((c) => ({
      id: `cons-${c.streamName}-${c.name}`,
      title: `Consumer: ${c.streamName} / ${c.name}`,
      category: 'Consumers' as const,
      icon: Gauge,
      subtext: `lag: ${c.numPending} | in-flight: ${c.numAckPending} | health: ${c.healthStatus}`,
      action: () => {
        onNavigate('consumers');
        onClose();
      },
    })),

    // Quick Actions
    {
      id: 'action-metrics',
      title: 'Open Prometheus /metrics Endpoint',
      category: 'Quick Actions',
      icon: Terminal,
      subtext: 'Open raw text Prometheus scrape endpoint in browser',
      action: () => {
        window.open('/metrics', '_blank');
        onClose();
      },
    },
    {
      id: 'action-traffic',
      title: 'Launch Synthetic Traffic Run',
      category: 'Quick Actions',
      icon: Play,
      subtext: 'Quick jump to Traffic Studio to start load test',
      action: () => {
        onNavigate('traffic');
        onClose();
      },
    },
    {
      id: 'action-new-stream',
      title: 'Create New JetStream Stream',
      category: 'Quick Actions',
      icon: Plus,
      subtext: 'Open stream configuration dialog',
      action: () => {
        onNavigate('streams');
        onClose();
      },
    },
  ];

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtext && item.subtext.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-[#0A0F1D]">
          <Search className="w-5 h-5 text-teal-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, stream, consumer, KV bucket, or action..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm focus:outline-none font-mono"
          />
          <kbd className="px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800/80 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-800/50 flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No matching commands or entities found for &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-teal-500/15 text-white border border-teal-500/30' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs tracking-wide">{item.title}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      {item.subtext && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtext}</p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-teal-400 shrink-0 ml-2 animate-pulse" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Helper Bar */}
        <div className="px-4 py-2 bg-[#090D16] border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <div className="text-teal-400/80">NATSLens Quick Studio</div>
        </div>
      </div>
    </div>
  );
};
