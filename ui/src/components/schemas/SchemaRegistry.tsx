import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Code,
  Tag,
  Play,
  FileCheck,
} from 'lucide-react';
import { SchemaDefinition, ValidatePayloadResponse } from '../../lib/types';
import { fetchSchemas, createSchema, deleteSchema, validatePayload } from '../../lib/api';

export const SchemaRegistry: React.FC = () => {
  const [schemas, setSchemas] = useState<SchemaDefinition[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<SchemaDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New schema form state
  const [newName, setNewName] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Validator test state
  const [testSubject, setTestSubject] = useState('orders.created');
  const [testPayload, setTestPayload] = useState('{\n  "orderId": "ord_101",\n  "customerId": "cust_88",\n  "amount": 129.50,\n  "status": "APPROVED"\n}');
  const [validationResult, setValidationResult] = useState<ValidatePayloadResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSchemas = async () => {
    setLoading(true);
    try {
      const list = await fetchSchemas();
      setSchemas(list);
      if (list.length > 0 && !selectedSchema) {
        setSelectedSchema(list[0]);
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load schemas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchemas();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createSchema({
        name: newName,
        subjectPattern: newPattern,
        schemaType: 'json',
        content: newContent,
        description: newDesc,
      });
      setNotification({ type: 'success', text: `Schema ${created.name} registered successfully.` });
      setIsCreating(false);
      setNewName('');
      setNewPattern('');
      setNewContent('');
      setNewDesc('');
      await loadSchemas();
      setSelectedSchema(created);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to create schema' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schema?')) return;
    try {
      await deleteSchema(id);
      setNotification({ type: 'success', text: 'Schema deleted.' });
      setSelectedSchema(null);
      await loadSchemas();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to delete schema' });
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await validatePayload({
        subject: testSubject,
        payload: testPayload,
      });
      setValidationResult(res);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Validation request failed' });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCode2 className="w-6 h-6 text-teal-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">
              Schema Registry & Payload Validator
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Associate JSON Schemas with subject wildcard filters, validate payloads in real time, and enforce event contracts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreating(true)}
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition-colors shadow-sm shadow-teal-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Schema</span>
          </button>
          <button
            onClick={loadSchemas}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Schema List */}
        <div className="lg:col-span-4 bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-mono uppercase text-slate-400 font-bold px-1">
            Registered Schemas ({schemas.length})
          </h3>

          <div className="space-y-2">
            {schemas.map((s) => {
              const isSelected = selectedSchema?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSchema(s)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-teal-500/15 border-teal-500/40 text-white'
                      : 'border-slate-800 hover:bg-slate-800/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">{s.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-900 border border-slate-800 text-teal-400">
                      {s.schemaType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <Tag className="w-3 h-3 text-teal-400" />
                    <span>{s.subjectPattern}</span>
                  </div>
                  {s.description && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{s.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center/Right Column: Inspector or Creation Modal */}
        <div className="lg:col-span-8 space-y-6">
          {isCreating ? (
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Create New Schema Contract</h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Schema Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PaymentEventSchema"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Subject Wildcard</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. payments.>"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Description</label>
                  <input
                    type="text"
                    placeholder="Event purpose, payload version, etc."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">JSON Schema Definition</label>
                  <textarea
                    rows={8}
                    required
                    placeholder='{\n  "type": "object",\n  "required": ["id", "amount"],\n  "properties": {\n    "id": { "type": "string" },\n    "amount": { "type": "number" }\n  }\n}'
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full p-3 bg-[#0A0F1D] border border-slate-800 rounded-xl text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500 leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs"
                  >
                    Save Schema
                  </button>
                </div>
              </form>
            </div>
          ) : selectedSchema ? (
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white font-mono">{selectedSchema.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/60 text-teal-400 font-mono text-xs">
                      Pattern: {selectedSchema.subjectPattern}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(selectedSchema.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {selectedSchema.description && (
                <p className="text-xs text-slate-400">{selectedSchema.description}</p>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-teal-400" />
                  <span>Schema Definition</span>
                </label>
                <pre className="p-4 bg-[#0A0F1D] border border-slate-800 rounded-xl text-xs font-mono text-teal-300 overflow-x-auto max-h-60">
                  {selectedSchema.content}
                </pre>
              </div>
            </div>
          ) : null}

          {/* Live Payload Validator Playground */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">Live Payload Validator Playground</h3>
              </div>
              <button
                onClick={handleValidate}
                disabled={validating}
                className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Validate Against Schema</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Target Subject</label>
              <input
                type="text"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                className="w-full px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">JSON Payload</label>
              <textarea
                rows={5}
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                className="w-full p-3 bg-[#0A0F1D] border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-teal-500 resize-y"
              />
            </div>

            {/* Validation Outcome Banner */}
            {validationResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  validationResult.valid
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {validationResult.valid ? 'Payload is Schema Compliant' : 'Payload Validation Failed'}
                    </span>
                  </div>
                  {validationResult.matchedSchema && (
                    <span className="font-mono text-[11px] opacity-80">
                      Matched: {validationResult.matchedSchema} ({validationResult.matchedPattern})
                    </span>
                  )}
                </div>

                {validationResult.errors && validationResult.errors.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
