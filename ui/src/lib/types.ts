export interface ConnectionConfig {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  token?: string;
  nkey?: string;
  credsFile?: string;
  clientCert?: string;
  clientKey?: string;
  caCert?: string;
  insecureSkipVerify?: boolean;
}

export interface ClusterStats {
  serverName: string;
  serverId: string;
  version: string;
  proto: number;
  gitCommit: string;
  goVersion: string;
  host: string;
  port: number;
  authRequired: boolean;
  tlsRequired: boolean;
  jetStreamAvailable: boolean;
  maxPayload: number;
  connections: number;
  inMsgs: number;
  outMsgs: number;
  inBytes: number;
  outBytes: number;
  uptime: string;
  memBytes: number;
  jetstream: JetStreamInfo;
}

export interface JetStreamInfo {
  enabled: boolean;
  memoryUsed: number;
  memoryMax: number;
  diskUsed: number;
  diskMax: number;
  streamsCount: number;
  consumersCount: number;
}

export interface SubjectNode {
  name: string;
  fullPath: string;
  messageCount: number;
  children: SubjectNode[];
}

export interface StreamSummary {
  name: string;
  description: string;
  created: string;
  subjects: string[];
  retention: string;
  storage: string;
  messagesCount: number;
  bytesCount: number;
  firstSeq: number;
  lastSeq: number;
  consumerCount: number;
  replicas: number;
  deletedCount: number;
  numSubjects: number;
}

export interface StreamDetail extends StreamSummary {
  maxConsumers: number;
  maxMsgs: number;
  maxBytes: number;
  maxAgeSeconds: number;
  maxMsgSize: number;
  discard: string;
  duplicateWindowSeconds: number;
  subjectHierarchy?: SubjectNode;
  subjectCounts?: Record<string, number>;
}

export interface CreateStreamRequest {
  name: string;
  description?: string;
  subjects: string[];
  retention: string;
  storage: string;
  maxConsumers?: number;
  maxMsgs?: number;
  maxBytes?: number;
  maxAgeSeconds?: number;
  maxMsgSize?: number;
  discard?: string;
  duplicateWindowSeconds?: number;
  replicas?: number;
}

export interface ConsumerSummary {
  streamName: string;
  name: string;
  description: string;
  created: string;
  deliverPolicy: string;
  ackPolicy: string;
  ackWaitSeconds: number;
  maxDeliver: number;
  filterSubject: string;
  deliverSubject?: string;
  numPending: number;
  numAckPending: number;
  numRedelivered: number;
  numWaiting: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  redeliveryRatio: number;
  isPull: boolean;
  paused: boolean;
  deliveredSeq: number;
  ackFloorSeq: number;
}

export interface ConsumerDetail extends ConsumerSummary {
  replayPolicy: string;
  maxAckPending: number;
  maxWaiting: number;
  lastDeliveryTime?: string;
  lastAckTime?: string;
}

export interface CreateConsumerRequest {
  streamName: string;
  name: string;
  description?: string;
  deliverPolicy: string;
  ackPolicy: string;
  ackWaitSeconds: number;
  maxDeliver: number;
  filterSubject?: string;
  deliverSubject?: string;
  replayPolicy?: string;
  maxAckPending?: number;
}

export interface KVBucketSummary {
  bucket: string;
  description: string;
  valuesCount: number;
  history: number;
  ttlSeconds: number;
  storage: string;
  bytesSize: number;
  replicas: number;
  backingStream: string;
  created: string;
}

export interface KVEntry {
  bucket: string;
  key: string;
  value: string;
  revision: number;
  created: string;
  delta: number;
  isDeleted: boolean;
  operation: string;
}

export interface CreateKVBucketRequest {
  bucket: string;
  description?: string;
  history?: number;
  ttlSeconds?: number;
  storage?: string;
  replicas?: number;
  maxBytes?: number;
}

export interface ObjectStoreBucketSummary {
  bucket: string;
  description: string;
  objectsCount: number;
  totalBytes: number;
  storage: string;
  replicas: number;
  ttlSeconds: number;
  backingStream: string;
}

export interface ObjectSummary {
  bucket: string;
  name: string;
  description: string;
  size: number;
  modTime: string;
  chunks: number;
  digest: string;
  deleted: boolean;
}

export interface PublishMessageRequest {
  subject: string;
  payload: string;
  headers?: Record<string, string[]>;
  msgId?: string;
  expectedStream?: string;
  expectedLastSeq?: number;
  expectedLastMsgId?: string;
}

export interface PublishMessageResponse {
  stream: string;
  sequence: number;
  duplicate: boolean;
  timestamp: string;
}

export interface StreamMessage {
  sequence: number;
  subject: string;
  timestamp: string;
  payload: string;
  payloadType: 'json' | 'text' | 'binary';
  headers?: Record<string, string[]>;
}

export interface ReplayRequest {
  sourceStream: string;
  filterSubject?: string;
  startSequence?: number;
  startTime?: string;
  targetSubject: string;
  speed: number;
}

export interface ReplayProgress {
  replayId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalMessages: number;
  replayedCount: number;
  currentSequence: number;
  percentage: number;
  error?: string;
}

export interface RequestReplyRequest {
  subject: string;
  payload: string;
  headers?: Record<string, string[]>;
  timeoutMs: number;
}

export interface RequestReplyResponse {
  subject: string;
  payload: string;
  headers?: Record<string, string[]>;
  latencyMs: number;
  error?: string;
}

export interface TapMessage {
  id: string;
  subject: string;
  reply?: string;
  payload: string;
  headers?: Record<string, string[]>;
  timestamp: string;
  size: number;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  subjectPattern: string;
  schemaType: 'json' | 'protobuf';
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidatePayloadRequest {
  subject: string;
  payload: string;
  schemaId?: string;
}

export interface ValidatePayloadResponse {
  valid: boolean;
  errors?: string[];
  matchedSchema?: string;
  matchedPattern?: string;
}

export interface DLQMessage {
  id: string;
  stream: string;
  consumer: string;
  sequence: number;
  subject: string;
  timestamp: string;
  payload: string;
  payloadType: string;
  headers?: Record<string, string[]>;
  redeliveries: number;
  errorReason: string;
  status: 'quarantined' | 'resolved' | 'republished';
}

export interface RepublishDLQRequest {
  originalStream: string;
  targetSubject: string;
  payload: string;
  headers?: Record<string, string[]>;
  acknowledgeOriginal: boolean;
}

export interface ChaosKnobs {
  malformedPayloadRatio: number;
  latencyJitterMs: number;
  injectHeaderError: boolean;
}

export interface TrafficGeneratorConfig {
  id?: string;
  name: string;
  targetSubject: string;
  ratePerSec: number;
  durationSeconds: number;
  totalMessages: number;
  payloadTemplate: string;
  headers?: Record<string, string>;
  chaos?: ChaosKnobs;
}

export interface TrafficGeneratorStatus {
  id: string;
  active: boolean;
  sentMessages: number;
  targetRate: number;
  currentRate: number;
  elapsedSec: number;
  targetSubject: string;
  lastError?: string;
  startedAt: string;
}

export interface KVExportEntry {
  key: string;
  value: string;
  revision: number;
  created: string;
}

export interface KVExportData {
  bucket: string;
  exportedAt: string;
  entries: KVExportEntry[];
}

export interface StreamExportData {
  stream: string;
  exportedAt: string;
  firstSeq: number;
  lastSeq: number;
  count: number;
  messages: StreamMessage[];
}

export interface AlertRule {
  id: string;
  name: string;
  type: 'consumer_lag' | 'redelivery_ratio' | 'stream_storage' | 'ack_wait';
  targetStream?: string;
  targetConsumer?: string;
  threshold: number;
  durationSeconds: number;
  webhookUrl: string;
  channelType: 'generic' | 'slack' | 'discord';
  enabled: boolean;
  status: 'ok' | 'alerting';
  lastTriggered?: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  severity: 'warning' | 'critical' | 'info';
  message: string;
  resolved: boolean;
}

export interface TopologyNode {
  id: string;
  label: string;
  type: 'ingress' | 'subject' | 'stream' | 'consumer' | 'worker';
  subtext?: string;
  status: 'normal' | 'active' | 'warning' | 'critical';
  rate?: string;
  lag?: number;
}

export interface TopologyEdge {
  source: string;
  target: string;
  label?: string;
  animated: boolean;
  flowRate?: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}
