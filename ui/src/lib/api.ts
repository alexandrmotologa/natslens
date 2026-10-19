import {
  ClusterStats,
  ConnectionConfig,
  ConsumerDetail,
  ConsumerSummary,
  CreateConsumerRequest,
  CreateKVBucketRequest,
  CreateStreamRequest,
  KVBucketSummary,
  KVEntry,
  ObjectStoreBucketSummary,
  ObjectSummary,
  PublishMessageRequest,
  PublishMessageResponse,
  ReplayProgress,
  ReplayRequest,
  RequestReplyRequest,
  RequestReplyResponse,
  StreamDetail,
  StreamMessage,
  StreamSummary,
  TopologyData,
  SchemaDefinition,
  ValidatePayloadRequest,
  ValidatePayloadResponse,
  DLQMessage,
  RepublishDLQRequest,
  TrafficGeneratorConfig,
  TrafficGeneratorStatus,
  KVExportData,
  StreamExportData,
  AlertRule,
  AlertEvent,
} from './types';

const BASE_URL = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const parsed = JSON.parse(errorText);
      throw new Error(parsed.error || `HTTP error ${res.status}`);
    } catch {
      throw new Error(errorText || `HTTP error ${res.status}`);
    }
  }
  return res.json();
}

// Cluster & Connection
export async function fetchHealth(): Promise<{ status: string; connected: boolean }> {
  const res = await fetch(`${BASE_URL}/health`);
  return handleResponse(res);
}

export async function fetchClusterStats(): Promise<ClusterStats> {
  const res = await fetch(`${BASE_URL}/cluster/stats`);
  return handleResponse(res);
}

export async function connectCluster(cfg: ConnectionConfig): Promise<{ connected: boolean; config: ConnectionConfig; stats?: ClusterStats }> {
  const res = await fetch(`${BASE_URL}/cluster/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  return handleResponse(res);
}

export async function fetchConnectionConfig(): Promise<ConnectionConfig> {
  const res = await fetch(`${BASE_URL}/cluster/config`);
  return handleResponse(res);
}

export async function startDemoCluster(): Promise<{ connected: boolean; demo: boolean; clientUrl: string; stats?: ClusterStats }> {
  const res = await fetch(`${BASE_URL}/demo/start`, {
    method: 'POST',
  });
  return handleResponse(res);
}

// Streams
export async function fetchStreams(): Promise<StreamSummary[]> {
  const res = await fetch(`${BASE_URL}/streams`);
  return handleResponse(res);
}

export async function fetchStream(name: string): Promise<StreamDetail> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(name)}`);
  return handleResponse(res);
}

export async function createStream(req: CreateStreamRequest): Promise<StreamDetail> {
  const res = await fetch(`${BASE_URL}/streams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function deleteStream(name: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function purgeStream(name: string, filter?: string): Promise<{ message: string }> {
  const url = filter
    ? `${BASE_URL}/streams/${encodeURIComponent(name)}/purge?subject=${encodeURIComponent(filter)}`
    : `${BASE_URL}/streams/${encodeURIComponent(name)}/purge`;
  const res = await fetch(url, { method: 'POST' });
  return handleResponse(res);
}

export async function fetchMessage(stream: string, seq: number): Promise<StreamMessage> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/messages/${seq}`);
  return handleResponse(res);
}

export async function deleteMessage(stream: string, seq: number): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/messages/${seq}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function browseMessages(stream: string, startSeq?: number, count?: number, filter?: string): Promise<StreamMessage[]> {
  const params = new URLSearchParams();
  if (startSeq) params.set('startSeq', startSeq.toString());
  if (count) params.set('count', count.toString());
  if (filter) params.set('filter', filter);

  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/browse?${params.toString()}`);
  return handleResponse(res);
}

// Consumers & Lag
export async function fetchConsumers(stream: string): Promise<ConsumerSummary[]> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/consumers`);
  return handleResponse(res);
}

export async function fetchConsumer(stream: string, name: string): Promise<ConsumerDetail> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/consumers/${encodeURIComponent(name)}`);
  return handleResponse(res);
}

export async function createConsumer(req: CreateConsumerRequest): Promise<ConsumerDetail> {
  const res = await fetch(`${BASE_URL}/consumers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function deleteConsumer(stream: string, name: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/consumers/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function pauseConsumer(stream: string, name: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/consumers/${encodeURIComponent(name)}/pause`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function resumeConsumer(stream: string, name: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/consumers/${encodeURIComponent(name)}/resume`, {
    method: 'POST',
  });
  return handleResponse(res);
}

// Key-Value Workbench
export async function fetchKVBuckets(): Promise<KVBucketSummary[]> {
  const res = await fetch(`${BASE_URL}/kv`);
  return handleResponse(res);
}

export async function fetchKVBucket(bucket: string): Promise<KVBucketSummary> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}`);
  return handleResponse(res);
}

export async function createKVBucket(req: CreateKVBucketRequest): Promise<KVBucketSummary> {
  const res = await fetch(`${BASE_URL}/kv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function deleteKVBucket(bucket: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function fetchKVKeys(bucket: string, prefix?: string): Promise<KVEntry[]> {
  const url = prefix
    ? `${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys?prefix=${encodeURIComponent(prefix)}`
    : `${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchKVEntry(bucket: string, key: string): Promise<KVEntry> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys/${encodeURIComponent(key)}`);
  return handleResponse(res);
}

export async function putKVEntry(bucket: string, key: string, value: string): Promise<{ key: string; revision: number }> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  return handleResponse(res);
}

export async function deleteKVKey(bucket: string, key: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function purgeKVKey(bucket: string, key: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys/${encodeURIComponent(key)}/purge`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function fetchKVHistory(bucket: string, key: string): Promise<KVEntry[]> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/keys/${encodeURIComponent(key)}/history`);
  return handleResponse(res);
}

// ObjectStore Explorer
export async function fetchObjectStoreBuckets(): Promise<ObjectStoreBucketSummary[]> {
  const res = await fetch(`${BASE_URL}/objectstore`);
  return handleResponse(res);
}

export async function createObjectStoreBucket(bucket: string, description: string, storage: string, replicas: number, ttlSeconds: number): Promise<ObjectStoreBucketSummary> {
  const res = await fetch(`${BASE_URL}/objectstore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, description, storage, replicas, ttlSeconds }),
  });
  return handleResponse(res);
}

export async function deleteObjectStoreBucket(bucket: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/objectstore/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function fetchObjects(bucket: string): Promise<ObjectSummary[]> {
  const res = await fetch(`${BASE_URL}/objectstore/${encodeURIComponent(bucket)}/objects`);
  return handleResponse(res);
}

export async function uploadObject(bucket: string, name: string, description: string, data: Blob | string): Promise<ObjectSummary> {
  const body = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data;
  const res = await fetch(`${BASE_URL}/objectstore/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      'X-Object-Description': description,
    },
    body: body,
  });
  return handleResponse(res);
}

export async function deleteObject(bucket: string, name: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/objectstore/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

// Messages & Probe
export async function publishMessage(req: PublishMessageRequest): Promise<PublishMessageResponse> {
  const res = await fetch(`${BASE_URL}/messages/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function sendRequestReply(req: RequestReplyRequest): Promise<RequestReplyResponse> {
  const res = await fetch(`${BASE_URL}/messages/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

// Stream Replay
export async function startReplay(req: ReplayRequest): Promise<ReplayProgress> {
  const res = await fetch(`${BASE_URL}/replay/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function fetchReplayProgress(replayId: string): Promise<ReplayProgress> {
  const res = await fetch(`${BASE_URL}/replay/${encodeURIComponent(replayId)}/progress`);
  return handleResponse(res);
}

export async function stopReplay(replayId: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/replay/${encodeURIComponent(replayId)}/stop`, {
    method: 'POST',
  });
  return handleResponse(res);
}

// Topology
export async function fetchTopology(): Promise<TopologyData> {
  const res = await fetch(`${BASE_URL}/topology`);
  return handleResponse(res);
}

// Schema Registry
export async function fetchSchemas(): Promise<SchemaDefinition[]> {
  const res = await fetch(`${BASE_URL}/schemas`);
  return handleResponse(res);
}

export async function createSchema(schema: Partial<SchemaDefinition>): Promise<SchemaDefinition> {
  const res = await fetch(`${BASE_URL}/schemas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schema),
  });
  return handleResponse(res);
}

export async function deleteSchema(id: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/schemas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function validatePayload(req: ValidatePayloadRequest): Promise<ValidatePayloadResponse> {
  const res = await fetch(`${BASE_URL}/schemas/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

// DLQ & Poison Pills
export async function fetchDLQMessages(): Promise<DLQMessage[]> {
  const res = await fetch(`${BASE_URL}/dlq`);
  return handleResponse(res);
}

export async function getDLQMessage(id: string): Promise<DLQMessage> {
  const res = await fetch(`${BASE_URL}/dlq/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

export async function republishDLQMessage(id: string, req: RepublishDLQRequest): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/dlq/${encodeURIComponent(id)}/republish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function purgeDLQMessage(id: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/dlq/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function scanDLQ(): Promise<{ scanned: boolean; discovered: number; quarantined: number }> {
  const res = await fetch(`${BASE_URL}/dlq/scan`, {
    method: 'POST',
  });
  return handleResponse(res);
}

// Traffic Studio
export async function startTraffic(cfg: TrafficGeneratorConfig): Promise<{ sessionId: string; status: string }> {
  const res = await fetch(`${BASE_URL}/traffic/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  return handleResponse(res);
}

export async function stopTraffic(id: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/traffic/${encodeURIComponent(id)}/stop`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function fetchTrafficSessions(): Promise<TrafficGeneratorStatus[]> {
  const res = await fetch(`${BASE_URL}/traffic/sessions`);
  return handleResponse(res);
}

// Export & Import
export async function exportKVBucket(bucket: string): Promise<KVExportData> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/export`);
  return handleResponse(res);
}

export async function importKVBucket(bucket: string, data: KVExportData): Promise<{ importedKeys: number; bucket: string }> {
  const res = await fetch(`${BASE_URL}/kv/${encodeURIComponent(bucket)}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function exportStream(stream: string, startSeq = 1, count = 200): Promise<StreamExportData> {
  const res = await fetch(`${BASE_URL}/streams/${encodeURIComponent(stream)}/export?startSeq=${startSeq}&count=${count}`);
  return handleResponse(res);
}

// Alerts & Webhooks
export async function fetchAlertRules(): Promise<AlertRule[]> {
  const res = await fetch(`${BASE_URL}/alerts/rules`);
  return handleResponse(res);
}

export async function createAlertRule(rule: Partial<AlertRule>): Promise<AlertRule> {
  const res = await fetch(`${BASE_URL}/alerts/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleResponse(res);
}

export async function deleteAlertRule(id: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/alerts/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function fetchAlertEvents(): Promise<AlertEvent[]> {
  const res = await fetch(`${BASE_URL}/alerts/events`);
  return handleResponse(res);
}

export async function testWebhook(webhookUrl: string, channelType: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/alerts/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, channelType }),
  });
  return handleResponse(res);
}
