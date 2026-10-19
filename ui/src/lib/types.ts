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
