package models

import (
	"time"
)

// ConnectionConfig holds connection parameters to a NATS cluster.
type ConnectionConfig struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	URL                string `json:"url"`
	Username           string `json:"username,omitempty"`
	Password           string `json:"password,omitempty"`
	Token              string `json:"token,omitempty"`
	NKey               string `json:"nkey,omitempty"`
	CredsFile          string `json:"credsFile,omitempty"`
	ClientCert         string `json:"clientCert,omitempty"`
	ClientKey          string `json:"clientKey,omitempty"`
	CACert             string `json:"caCert,omitempty"`
	InsecureSkipVerify bool   `json:"insecureSkipVerify,omitempty"`
}

// ClusterStats represents cluster status, server statistics, and JetStream usage.
type ClusterStats struct {
	ServerName         string        `json:"serverName"`
	ServerID           string        `json:"serverId"`
	Version            string        `json:"version"`
	Proto              int           `json:"proto"`
	GitCommit          string        `json:"gitCommit"`
	GoVersion          string        `json:"goVersion"`
	Host               string        `json:"host"`
	Port               int           `json:"port"`
	AuthRequired       bool          `json:"authRequired"`
	TLSRequired        bool          `json:"tlsRequired"`
	JetStreamAvailable bool          `json:"jetStreamAvailable"`
	MaxPayload         int64         `json:"maxPayload"`
	Connections        int           `json:"connections"`
	InMsgs             int64         `json:"inMsgs"`
	OutMsgs            int64         `json:"outMsgs"`
	InBytes            int64         `json:"inBytes"`
	OutBytes           int64         `json:"outBytes"`
	Uptime             string        `json:"uptime"`
	MemBytes           int64         `json:"memBytes"`
	JetStream          JetStreamInfo `json:"jetstream"`
}

// JetStreamInfo captures JetStream storage metrics.
type JetStreamInfo struct {
	Enabled       bool   `json:"enabled"`
	MemoryUsed    uint64 `json:"memoryUsed"`
	MemoryMax     int64  `json:"memoryMax"`
	DiskUsed      uint64 `json:"diskUsed"`
	DiskMax       int64  `json:"diskMax"`
	StreamsCount  int    `json:"streamsCount"`
	ConsumersCount int   `json:"consumersCount"`
}

// SubjectNode represents a node in the visual subject hierarchy tree.
type SubjectNode struct {
	Name         string         `json:"name"`
	FullPath     string         `json:"fullPath"`
	MessageCount uint64         `json:"messageCount"`
	Children     []*SubjectNode `json:"children"`
}

// StreamSummary provides a lightweight view of a JetStream stream.
type StreamSummary struct {
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	Created          time.Time `json:"created"`
	Subjects         []string  `json:"subjects"`
	Retention        string    `json:"retention"`
	Storage          string    `json:"storage"`
	MessagesCount    uint64    `json:"messagesCount"`
	BytesCount       uint64    `json:"bytesCount"`
	FirstSeq         uint64    `json:"firstSeq"`
	LastSeq          uint64    `json:"lastSeq"`
	ConsumerCount    int       `json:"consumerCount"`
	Replicas         int       `json:"replicas"`
	DeletedCount     int       `json:"deletedCount"`
	NumSubjects      int       `json:"numSubjects"`
}

// StreamDetail includes full stream configuration, state, and subject breakdown.
type StreamDetail struct {
	StreamSummary
	MaxConsumers           int            `json:"maxConsumers"`
	MaxMsgs                int64          `json:"maxMsgs"`
	MaxBytes               int64          `json:"maxBytes"`
	MaxAgeSeconds          int64          `json:"maxAgeSeconds"`
	MaxMsgSize             int32          `json:"maxMsgSize"`
	Discard                string         `json:"discard"`
	DuplicateWindowSeconds int64          `json:"duplicateWindowSeconds"`
	SubjectHierarchy       *SubjectNode   `json:"subjectHierarchy,omitempty"`
	SubjectCounts          map[string]uint64 `json:"subjectCounts,omitempty"`
}

// CreateStreamRequest defines input for creating a stream.
type CreateStreamRequest struct {
	Name                   string   `json:"name"`
	Description            string   `json:"description,omitempty"`
	Subjects               []string `json:"subjects"`
	Retention              string   `json:"retention"` // limits, interest, workqueue
	Storage                string   `json:"storage"`   // file, memory
	MaxConsumers           int      `json:"maxConsumers,omitempty"`
	MaxMsgs                int64    `json:"maxMsgs,omitempty"`
	MaxBytes               int64    `json:"maxBytes,omitempty"`
	MaxAgeSeconds          int64    `json:"maxAgeSeconds,omitempty"`
	MaxMsgSize             int32    `json:"maxMsgSize,omitempty"`
	Discard                string   `json:"discard,omitempty"` // old, new
	DuplicateWindowSeconds int64    `json:"duplicateWindowSeconds,omitempty"`
	Replicas               int      `json:"replicas,omitempty"`
}

// ConsumerSummary provides key consumer lag and redelivery indicators.
type ConsumerSummary struct {
	StreamName       string    `json:"streamName"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	Created          time.Time `json:"created"`
	DeliverPolicy    string    `json:"deliverPolicy"`
	AckPolicy        string    `json:"ackPolicy"`
	AckWaitSeconds   int64     `json:"ackWaitSeconds"`
	MaxDeliver       int       `json:"maxDeliver"`
	FilterSubject    string    `json:"filterSubject"`
	DeliverSubject   string    `json:"deliverSubject,omitempty"`
	NumPending       uint64    `json:"numPending"`       // lag: remaining unconsumed
	NumAckPending    int       `json:"numAckPending"`    // in-flight: awaiting ACK
	NumRedelivered   int       `json:"numRedelivered"`   // expired AckWait & redelivered
	NumWaiting       int       `json:"numWaiting"`       // pull requests waiting
	HealthStatus     string    `json:"healthStatus"`     // "healthy", "warning", "critical"
	RedeliveryRatio  float64   `json:"redeliveryRatio"`  // redelivered / (ackPending + redelivered)
	IsPull           bool      `json:"isPull"`
	Paused           bool      `json:"paused"`
	DeliveredSeq     uint64    `json:"deliveredSeq"`
	AckFloorSeq      uint64    `json:"ackFloorSeq"`
}

// ConsumerDetail provides detailed consumer progress and configurations.
type ConsumerDetail struct {
	ConsumerSummary
	ReplayPolicy     string    `json:"replayPolicy"`
	MaxAckPending    int       `json:"maxAckPending"`
	MaxWaiting       int       `json:"maxWaiting"`
	LastDeliveryTime *time.Time `json:"lastDeliveryTime,omitempty"`
	LastAckTime      *time.Time `json:"lastAckTime,omitempty"`
}

// CreateConsumerRequest defines input for creating a consumer.
type CreateConsumerRequest struct {
	StreamName     string `json:"streamName"`
	Name           string `json:"name"`
	Description    string `json:"description,omitempty"`
	DeliverPolicy  string `json:"deliverPolicy"` // all, last, new, by_start_sequence, by_start_time
	AckPolicy      string `json:"ackPolicy"`     // explicit, all, none
	AckWaitSeconds int64  `json:"ackWaitSeconds"`
	MaxDeliver     int    `json:"maxDeliver"`
	FilterSubject  string `json:"filterSubject,omitempty"`
	DeliverSubject string `json:"deliverSubject,omitempty"`
	ReplayPolicy   string `json:"replayPolicy,omitempty"`
	MaxAckPending  int    `json:"maxAckPending,omitempty"`
}

// KVBucketSummary provides high-level metadata for a Key-Value bucket.
type KVBucketSummary struct {
	Bucket        string    `json:"bucket"`
	Description   string    `json:"description"`
	ValuesCount   uint64    `json:"valuesCount"`
	History       int       `json:"history"`
	TTLSeconds    int64     `json:"ttlSeconds"`
	Storage       string    `json:"storage"`
	BytesSize     uint64    `json:"bytesSize"`
	Replicas      int       `json:"replicas"`
	BackingStream string    `json:"backingStream"`
	Created       time.Time `json:"created"`
}

// KVEntry represents an individual Key-Value record.
type KVEntry struct {
	Bucket    string    `json:"bucket"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Revision  uint64    `json:"revision"`
	Created   time.Time `json:"created"`
	Delta     uint64    `json:"delta"`
	IsDeleted bool      `json:"isDeleted"`
	Operation string    `json:"operation"` // "PUT", "DEL", "PURGE"
}

// CreateKVBucketRequest defines input for creating a new KV bucket.
type CreateKVBucketRequest struct {
	Bucket      string `json:"bucket"`
	Description string `json:"description,omitempty"`
	History     int    `json:"history,omitempty"`
	TTLSeconds  int64  `json:"ttlSeconds,omitempty"`
	Storage     string `json:"storage,omitempty"` // file, memory
	Replicas    int    `json:"replicas,omitempty"`
	MaxBytes    int64  `json:"maxBytes,omitempty"`
}

// PutKVEntryRequest defines input for storing a key value.
type PutKVEntryRequest struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ObjectStoreBucketSummary represents an ObjectStore bucket.
type ObjectStoreBucketSummary struct {
	Bucket        string    `json:"bucket"`
	Description   string    `json:"description"`
	ObjectsCount  uint64    `json:"objectsCount"`
	TotalBytes    uint64    `json:"totalBytes"`
	Storage       string    `json:"storage"`
	Replicas      int       `json:"replicas"`
	TTLSeconds    int64     `json:"ttlSeconds"`
	BackingStream string    `json:"backingStream"`
}

// ObjectSummary represents an object stored in an ObjectStore.
type ObjectSummary struct {
	Bucket      string    `json:"bucket"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Size        uint64    `json:"size"`
	ModTime     time.Time `json:"modTime"`
	Chunks      uint32    `json:"chunks"`
	Digest      string    `json:"digest"`
	Deleted     bool      `json:"deleted"`
}

// PublishMessageRequest defines a message to be published.
type PublishMessageRequest struct {
	Subject          string              `json:"subject"`
	Payload          string              `json:"payload"`
	Headers          map[string][]string `json:"headers,omitempty"`
	MsgID            string              `json:"msgId,omitempty"`
	ExpectedStream   string              `json:"expectedStream,omitempty"`
	ExpectedLastSeq  uint64              `json:"expectedLastSeq,omitempty"`
	ExpectedLastMsgID string             `json:"expectedLastMsgId,omitempty"`
}

// PublishMessageResponse holds publication ack results.
type PublishMessageResponse struct {
	Stream    string `json:"stream"`
	Sequence  uint64 `json:"sequence"`
	Duplicate bool   `json:"duplicate"`
	Timestamp string `json:"timestamp"`
}

// StreamMessage represents a historical message retrieved from a stream.
type StreamMessage struct {
	Sequence    uint64              `json:"sequence"`
	Subject     string              `json:"subject"`
	Timestamp   time.Time           `json:"timestamp"`
	Payload     string              `json:"payload"`
	PayloadType string              `json:"payloadType"` // "json", "text", "binary"
	Headers     map[string][]string `json:"headers,omitempty"`
}

// ReplayRequest defines parameters for replaying stream messages.
type ReplayRequest struct {
	SourceStream  string  `json:"sourceStream"`
	FilterSubject string  `json:"filterSubject,omitempty"`
	StartSequence uint64  `json:"startSequence,omitempty"`
	StartTime     string  `json:"startTime,omitempty"`
	TargetSubject string  `json:"targetSubject"`
	Speed         float64 `json:"speed"` // 0 = instant, 1.0 = real-time, 2.0 = 2x
}

// ReplayProgress contains live progress for an ongoing stream replay.
type ReplayProgress struct {
	ReplayID        string  `json:"replayId"`
	Status          string  `json:"status"` // running, paused, completed, failed, cancelled
	TotalMessages   uint64  `json:"totalMessages"`
	ReplayedCount   uint64  `json:"replayedCount"`
	CurrentSequence uint64  `json:"currentSequence"`
	Percentage      float64 `json:"percentage"`
	Error           string  `json:"error,omitempty"`
}

// RequestReplyRequest defines a synchronous request-reply probe.
type RequestReplyRequest struct {
	Subject   string              `json:"subject"`
	Payload   string              `json:"payload"`
	Headers   map[string][]string `json:"headers,omitempty"`
	TimeoutMs int                 `json:"timeoutMs"`
}

// RequestReplyResponse holds the response and latency of a request-reply probe.
type RequestReplyResponse struct {
	Subject   string              `json:"subject"`
	Payload   string              `json:"payload"`
	Headers   map[string][]string `json:"headers,omitempty"`
	LatencyMs float64             `json:"latencyMs"`
	Error     string              `json:"error,omitempty"`
}

// TapMessage is a message captured during live Core NATS tapping.
type TapMessage struct {
	ID        string              `json:"id"`
	Subject   string              `json:"subject"`
	Reply     string              `json:"reply,omitempty"`
	Payload   string              `json:"payload"`
	Headers   map[string][]string `json:"headers,omitempty"`
	Timestamp time.Time           `json:"timestamp"`
	Size      int                 `json:"size"`
}

// SchemaDefinition stores a schema bound to a subject pattern.
type SchemaDefinition struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	SubjectPattern string    `json:"subjectPattern"` // e.g. "orders.>" or "telemetry.*"
	SchemaType     string    `json:"schemaType"`     // "json", "protobuf"
	Content        string    `json:"content"`        // JSON schema or proto definition string
	Description    string    `json:"description,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// ValidatePayloadRequest validates an arbitrary payload against matching schemas.
type ValidatePayloadRequest struct {
	Subject  string `json:"subject"`
	Payload  string `json:"payload"`
	SchemaID string `json:"schemaId,omitempty"`
}

// ValidatePayloadResponse reports validation errors and status.
type ValidatePayloadResponse struct {
	Valid          bool     `json:"valid"`
	Errors         []string `json:"errors,omitempty"`
	MatchedSchema  string   `json:"matchedSchema,omitempty"`
	MatchedPattern string   `json:"matchedPattern,omitempty"`
}

// DLQMessage represents a poisoned or stuck message that exceeded redelivery thresholds.
type DLQMessage struct {
	ID            string              `json:"id"`
	Stream        string              `json:"stream"`
	Consumer      string              `json:"consumer"`
	Sequence      uint64              `json:"sequence"`
	Subject       string              `json:"subject"`
	Timestamp     time.Time           `json:"timestamp"`
	Payload       string              `json:"payload"`
	PayloadType   string              `json:"payloadType"`
	Headers       map[string][]string `json:"headers,omitempty"`
	Redeliveries  int                 `json:"redeliveries"`
	ErrorReason   string              `json:"errorReason"`
	Status        string              `json:"status"` // "quarantined", "resolved", "republished"
}

// RepublishDLQRequest defines parameters to re-publish a quarantined message.
type RepublishDLQRequest struct {
	OriginalStream      string              `json:"originalStream"`
	TargetSubject       string              `json:"targetSubject"`
	Payload             string              `json:"payload"`
	Headers             map[string][]string `json:"headers,omitempty"`
	AcknowledgeOriginal bool                `json:"acknowledgeOriginal"`
}

// ChaosKnobs defines fault injection parameters for the traffic generator.
type ChaosKnobs struct {
	MalformedPayloadRatio float64 `json:"malformedPayloadRatio"` // 0.0 - 1.0
	LatencyJitterMs       int     `json:"latencyJitterMs"`
	InjectHeaderError     bool    `json:"injectHeaderError"`
}

// TrafficGeneratorConfig defines a synthetic load generator session.
type TrafficGeneratorConfig struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	TargetSubject   string     `json:"targetSubject"`
	RatePerSec      int        `json:"ratePerSec"`      // e.g. 50
	DurationSeconds int        `json:"durationSeconds"` // 0 = indefinite
	TotalMessages   int        `json:"totalMessages"`   // 0 = indefinite
	PayloadTemplate string     `json:"payloadTemplate"` // JSON template with {{uuid}}, {{now}}, {{random_int}}
	Headers         map[string]string `json:"headers,omitempty"`
	Chaos           ChaosKnobs `json:"chaos,omitempty"`
}

// TrafficGeneratorStatus reports runtime state of an active traffic session.
type TrafficGeneratorStatus struct {
	ID            string    `json:"id"`
	Active        bool      `json:"active"`
	SentMessages  uint64    `json:"sentMessages"`
	TargetRate    int       `json:"targetRate"`
	CurrentRate   float64   `json:"currentRate"`
	ElapsedSec    float64   `json:"elapsedSec"`
	TargetSubject string    `json:"targetSubject"`
	LastError     string    `json:"lastError,omitempty"`
	StartedAt     time.Time `json:"startedAt"`
}

// KVExportData is the serialized portable format of an entire KV bucket.
type KVExportData struct {
	Bucket     string        `json:"bucket"`
	ExportedAt time.Time     `json:"exportedAt"`
	Entries    []KVExportEntry `json:"entries"`
}

// KVExportEntry is a single key snapshot in a KV export.
type KVExportEntry struct {
	Key      string    `json:"key"`
	Value    string    `json:"value"` // base64 or raw string
	Revision uint64    `json:"revision"`
	Created  time.Time `json:"created"`
}

// StreamExportData is a portable slice of stream messages.
type StreamExportData struct {
	Stream     string          `json:"stream"`
	ExportedAt time.Time       `json:"exportedAt"`
	FirstSeq   uint64          `json:"firstSeq"`
	LastSeq    uint64          `json:"lastSeq"`
	Count      int             `json:"count"`
	Messages   []StreamMessage `json:"messages"`
}

// AlertRule defines an automated monitoring condition with webhook dispatch.
type AlertRule struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"` // "consumer_lag", "redelivery_ratio", "stream_storage", "ack_wait"
	TargetStream    string    `json:"targetStream,omitempty"`
	TargetConsumer  string    `json:"targetConsumer,omitempty"`
	Threshold       float64   `json:"threshold"`
	DurationSeconds int       `json:"durationSeconds"`
	WebhookURL      string    `json:"webhookUrl"`
	ChannelType     string    `json:"channelType"` // "generic", "slack", "discord"
	Enabled         bool      `json:"enabled"`
	Status          string    `json:"status"` // "ok", "alerting"
	LastTriggered   *time.Time `json:"lastTriggered,omitempty"`
}

// AlertEvent captures an incident notification sent by the alert engine.
type AlertEvent struct {
	ID        string    `json:"id"`
	RuleID    string    `json:"ruleId"`
	RuleName  string    `json:"ruleName"`
	Timestamp time.Time `json:"timestamp"`
	Severity  string    `json:"severity"` // "warning", "critical", "info"
	Message   string    `json:"message"`
	Resolved  bool      `json:"resolved"`
}

// TopologyNode represents an entity in the dataflow graph.
type TopologyNode struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Type     string `json:"type"` // "ingress", "subject", "stream", "consumer", "worker"
	Subtext  string `json:"subtext,omitempty"`
	Status   string `json:"status"` // "normal", "active", "warning", "critical"
	Rate     string `json:"rate,omitempty"`
	Lag      uint64 `json:"lag,omitempty"`
}

// TopologyEdge represents a message flow path between entities.
type TopologyEdge struct {
	Source   string `json:"source"`
	Target   string `json:"target"`
	Label    string `json:"label,omitempty"`
	Animated bool   `json:"animated"`
	FlowRate string `json:"flowRate,omitempty"`
	Status   string `json:"status"` // "normal", "warning", "critical"
}

// TopologyData contains nodes and edges for the visual topology diagram.
type TopologyData struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}
