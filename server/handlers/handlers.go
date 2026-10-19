package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/embedded"
	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/alexandrmotologa/natslens/pkg/natsclient"
)

// APIHandler wraps client and services for HTTP requests.
type APIHandler struct {
	Client         *natsclient.Client
	ReplayManager  *natsclient.ReplayManager
	DemoServer     *embedded.DemoServer
	SchemaRegistry *natsclient.SchemaRegistry
	DLQManager     *natsclient.DLQManager
	TrafficEngine  *natsclient.TrafficEngine
	AlertEngine    *natsclient.AlertEngine
}

// NewAPIHandler creates a new APIHandler.
func NewAPIHandler(client *natsclient.Client, replayMgr *natsclient.ReplayManager) *APIHandler {
	return &APIHandler{
		Client:         client,
		ReplayManager:  replayMgr,
		SchemaRegistry: natsclient.NewSchemaRegistry(),
		DLQManager:     natsclient.NewDLQManager(client),
		TrafficEngine:  natsclient.NewTrafficEngine(client),
		AlertEngine:    natsclient.NewAlertEngine(client),
	}
}

// WriteJSON sends a JSON response with status code.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// WriteError sends a JSON error response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

// HealthCheck responds with server status.
func (h *APIHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"connected": h.Client.IsConnected(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// GetClusterStats returns diagnostic stats for the connected NATS cluster.
func (h *APIHandler) GetClusterStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.Client.GetClusterStats()
	if err != nil {
		WriteError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, stats)
}

// Connect activates a new connection configuration.
func (h *APIHandler) Connect(w http.ResponseWriter, r *http.Request) {
	var cfg models.ConnectionConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if err := h.Client.Connect(cfg); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	stats, _ := h.Client.GetClusterStats()
	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"connected": true,
		"config":    h.Client.Config(),
		"stats":     stats,
	})
}

// GetConnectionConfig returns current connection parameters.
func (h *APIHandler) GetConnectionConfig(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, h.Client.Config())
}

// StartDemoCluster boots an embedded in-process NATS JetStream server and connects to it.
func (h *APIHandler) StartDemoCluster(w http.ResponseWriter, r *http.Request) {
	if h.DemoServer != nil {
		h.DemoServer.Stop()
	}

	ds, err := embedded.StartDemoServer(0)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to start demo server: "+err.Error())
		return
	}
	h.DemoServer = ds

	cfg := models.ConnectionConfig{
		ID:   "embedded-demo",
		Name: "Embedded Demo Cluster",
		URL:  ds.ClientURL(),
	}

	if err := h.Client.Connect(cfg); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to connect to demo cluster: "+err.Error())
		return
	}

	stats, _ := h.Client.GetClusterStats()
	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"connected": true,
		"demo":      true,
		"clientUrl": ds.ClientURL(),
		"config":    cfg,
		"stats":     stats,
	})
}

// ListStreams returns summaries of all JetStream streams.
func (h *APIHandler) ListStreams(w http.ResponseWriter, r *http.Request) {
	streams, err := h.Client.ListStreams(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if streams == nil {
		streams = []models.StreamSummary{}
	}
	WriteJSON(w, http.StatusOK, streams)
}

// GetStream returns details of a single stream.
func (h *APIHandler) GetStream(w http.ResponseWriter, r *http.Request) {
	streamName := strings.TrimPrefix(r.URL.Path, "/api/streams/")
	if idx := strings.Index(streamName, "/"); idx != -1 {
		streamName = streamName[:idx]
	}

	if streamName == "" {
		WriteError(w, http.StatusBadRequest, "stream name is required")
		return
	}

	detail, err := h.Client.GetStream(r.Context(), streamName)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, detail)
}

// CreateStream creates a new JetStream stream.
func (h *APIHandler) CreateStream(w http.ResponseWriter, r *http.Request) {
	var req models.CreateStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	detail, err := h.Client.CreateStream(r.Context(), req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusCreated, detail)
}

// DeleteStream removes a stream.
func (h *APIHandler) DeleteStream(w http.ResponseWriter, r *http.Request) {
	streamName := strings.TrimPrefix(r.URL.Path, "/api/streams/")
	if streamName == "" {
		WriteError(w, http.StatusBadRequest, "stream name is required")
		return
	}

	if err := h.Client.DeleteStream(r.Context(), streamName); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "stream deleted"})
}

// PurgeStream purges messages from a stream.
func (h *APIHandler) PurgeStream(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/purge
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid purge path")
		return
	}
	streamName := parts[2]
	filter := r.URL.Query().Get("subject")

	if err := h.Client.PurgeStream(r.Context(), streamName, filter); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "stream purged"})
}

// GetMessage fetches a single message by sequence.
func (h *APIHandler) GetMessage(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/messages/{seq}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid message path")
		return
	}
	streamName := parts[2]
	seqStr := parts[4]
	seq, err := strconv.ParseUint(seqStr, 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid sequence number")
		return
	}

	msg, err := h.Client.GetMessage(r.Context(), streamName, seq)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, msg)
}

// DeleteMessage deletes a single message by sequence.
func (h *APIHandler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/messages/{seq}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid message path")
		return
	}
	streamName := parts[2]
	seqStr := parts[4]
	seq, err := strconv.ParseUint(seqStr, 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid sequence number")
		return
	}

	if err := h.Client.DeleteMessage(r.Context(), streamName, seq); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "message deleted"})
}

// BrowseMessages returns a window of messages from a stream.
func (h *APIHandler) BrowseMessages(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/browse?startSeq=1&count=50&filter=orders.*
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid browse path")
		return
	}
	streamName := parts[2]

	startSeqStr := r.URL.Query().Get("startSeq")
	countStr := r.URL.Query().Get("count")
	filter := r.URL.Query().Get("filter")

	startSeq, _ := strconv.ParseUint(startSeqStr, 10, 64)
	count, _ := strconv.Atoi(countStr)
	if count <= 0 {
		count = 50
	}

	messages, err := h.Client.BrowseStreamMessages(r.Context(), streamName, startSeq, count, filter)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if messages == nil {
		messages = []models.StreamMessage{}
	}
	WriteJSON(w, http.StatusOK, messages)
}

// ListConsumers returns consumers on a stream.
func (h *APIHandler) ListConsumers(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/consumers
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid stream consumers path")
		return
	}
	streamName := parts[2]

	consumers, err := h.Client.ListConsumers(r.Context(), streamName)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if consumers == nil {
		consumers = []models.ConsumerSummary{}
	}
	WriteJSON(w, http.StatusOK, consumers)
}

// GetConsumer returns details of a single consumer.
func (h *APIHandler) GetConsumer(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/consumers/{cname}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid consumer path")
		return
	}
	streamName := parts[2]
	consumerName := parts[4]

	detail, err := h.Client.GetConsumer(r.Context(), streamName, consumerName)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, detail)
}

// CreateConsumer creates a new consumer.
func (h *APIHandler) CreateConsumer(w http.ResponseWriter, r *http.Request) {
	var req models.CreateConsumerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	consumer, err := h.Client.CreateConsumer(r.Context(), req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusCreated, consumer)
}

// DeleteConsumer deletes a consumer.
func (h *APIHandler) DeleteConsumer(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/consumers/{cname}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid consumer path")
		return
	}
	streamName := parts[2]
	consumerName := parts[4]

	if err := h.Client.DeleteConsumer(r.Context(), streamName, consumerName); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "consumer deleted"})
}

// PauseConsumer temporarily halts consumer deliveries.
func (h *APIHandler) PauseConsumer(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/consumers/{cname}/pause
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid pause path")
		return
	}
	streamName := parts[2]
	consumerName := parts[4]

	pauseUntil := time.Now().Add(1 * time.Hour)
	if err := h.Client.PauseConsumer(r.Context(), streamName, consumerName, pauseUntil); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "consumer paused"})
}

// ResumeConsumer restores consumer deliveries.
func (h *APIHandler) ResumeConsumer(w http.ResponseWriter, r *http.Request) {
	// Path: /api/streams/{name}/consumers/{cname}/resume
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid resume path")
		return
	}
	streamName := parts[2]
	consumerName := parts[4]

	if err := h.Client.ResumeConsumer(r.Context(), streamName, consumerName); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "consumer resumed"})
}

// ListKVBuckets returns all Key-Value buckets.
func (h *APIHandler) ListKVBuckets(w http.ResponseWriter, r *http.Request) {
	buckets, err := h.Client.ListKVBuckets(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if buckets == nil {
		buckets = []models.KVBucketSummary{}
	}
	WriteJSON(w, http.StatusOK, buckets)
}

// GetKVBucket returns metadata for a single KV bucket.
func (h *APIHandler) GetKVBucket(w http.ResponseWriter, r *http.Request) {
	bucket := strings.TrimPrefix(r.URL.Path, "/api/kv/")
	if idx := strings.Index(bucket, "/"); idx != -1 {
		bucket = bucket[:idx]
	}

	summary, err := h.Client.GetKVBucket(r.Context(), bucket)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, summary)
}

// CreateKVBucket creates a new Key-Value bucket.
func (h *APIHandler) CreateKVBucket(w http.ResponseWriter, r *http.Request) {
	var req models.CreateKVBucketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	bucket, err := h.Client.CreateKVBucket(r.Context(), req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusCreated, bucket)
}

// DeleteKVBucket drops a Key-Value bucket.
func (h *APIHandler) DeleteKVBucket(w http.ResponseWriter, r *http.Request) {
	bucket := strings.TrimPrefix(r.URL.Path, "/api/kv/")
	if bucket == "" {
		WriteError(w, http.StatusBadRequest, "bucket is required")
		return
	}

	if err := h.Client.DeleteKVBucket(r.Context(), bucket); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "bucket deleted"})
}

// ListKeys returns keys in a KV bucket.
func (h *APIHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	// Path: /api/kv/{bucket}/keys
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid keys path")
		return
	}
	bucket := parts[2]
	prefix := r.URL.Query().Get("prefix")

	keys, err := h.Client.ListKeys(r.Context(), bucket, prefix)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if keys == nil {
		keys = []models.KVEntry{}
	}
	WriteJSON(w, http.StatusOK, keys)
}

// HandleKey operations: GET, PUT, DELETE
func (h *APIHandler) HandleKey(w http.ResponseWriter, r *http.Request) {
	// Path: /api/kv/{bucket}/keys/{key}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid key path")
		return
	}
	bucket := parts[2]
	key := strings.Join(parts[4:], "/") // handle nested key names if any

	switch r.Method {
	case http.MethodGet:
		entry, err := h.Client.GetEntry(r.Context(), bucket, key)
		if err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, entry)

	case http.MethodPut:
		var req models.PutKVEntryRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}
		rev, err := h.Client.PutEntry(r.Context(), bucket, key, req.Value)
		if err != nil {
			WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]interface{}{"key": key, "revision": rev})

	case http.MethodDelete:
		if err := h.Client.DeleteKey(r.Context(), bucket, key); err != nil {
			WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"message": "key deleted"})

	default:
		WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// GetKeyHistory returns all historical revisions for a key.
func (h *APIHandler) GetKeyHistory(w http.ResponseWriter, r *http.Request) {
	// Path: /api/kv/{bucket}/keys/{key}/history
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 6 {
		WriteError(w, http.StatusBadRequest, "invalid key history path")
		return
	}
	bucket := parts[2]
	key := parts[4]

	history, err := h.Client.GetRevisionHistory(r.Context(), bucket, key)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if history == nil {
		history = []models.KVEntry{}
	}
	WriteJSON(w, http.StatusOK, history)
}

// PurgeKey deletes all historical revisions for a key.
func (h *APIHandler) PurgeKey(w http.ResponseWriter, r *http.Request) {
	// Path: /api/kv/{bucket}/keys/{key}/purge
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 6 {
		WriteError(w, http.StatusBadRequest, "invalid purge path")
		return
	}
	bucket := parts[2]
	key := parts[4]

	if err := h.Client.PurgeKey(r.Context(), bucket, key); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "key purged"})
}

// WatchKVBucket streams live mutations over Server-Sent Events.
func (h *APIHandler) WatchKVBucket(w http.ResponseWriter, r *http.Request) {
	// Path: /api/kv/{bucket}/watch
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid watch path")
		return
	}
	bucket := parts[2]

	flusher, ok := w.(http.Flusher)
	if !ok {
		WriteError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	events, err := h.Client.WatchBucket(r.Context(), bucket)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	for {
		select {
		case <-r.Context().Done():
			return
		case entry, ok := <-events:
			if !ok {
				return
			}
			data, _ := json.Marshal(entry)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// ListObjectStoreBuckets returns all ObjectStore buckets.
func (h *APIHandler) ListObjectStoreBuckets(w http.ResponseWriter, r *http.Request) {
	buckets, err := h.Client.ListObjectStoreBuckets(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if buckets == nil {
		buckets = []models.ObjectStoreBucketSummary{}
	}
	WriteJSON(w, http.StatusOK, buckets)
}

// GetObjectStoreBucket returns status of an ObjectStore bucket.
func (h *APIHandler) GetObjectStoreBucket(w http.ResponseWriter, r *http.Request) {
	bucket := strings.TrimPrefix(r.URL.Path, "/api/objectstore/")
	if idx := strings.Index(bucket, "/"); idx != -1 {
		bucket = bucket[:idx]
	}

	summary, err := h.Client.GetObjectStoreBucket(r.Context(), bucket)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, summary)
}

// CreateObjectStoreBucket creates an ObjectStore bucket.
func (h *APIHandler) CreateObjectStoreBucket(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Bucket      string `json:"bucket"`
		Description string `json:"description"`
		Storage     string `json:"storage"`
		Replicas    int    `json:"replicas"`
		TTLSeconds  int64  `json:"ttlSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	summary, err := h.Client.CreateObjectStoreBucket(r.Context(), body.Bucket, body.Description, body.Storage, body.Replicas, body.TTLSeconds)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusCreated, summary)
}

// DeleteObjectStoreBucket removes an ObjectStore bucket.
func (h *APIHandler) DeleteObjectStoreBucket(w http.ResponseWriter, r *http.Request) {
	bucket := strings.TrimPrefix(r.URL.Path, "/api/objectstore/")
	if bucket == "" {
		WriteError(w, http.StatusBadRequest, "bucket is required")
		return
	}

	if err := h.Client.DeleteObjectStoreBucket(r.Context(), bucket); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "bucket deleted"})
}

// ListObjects returns objects inside an ObjectStore bucket.
func (h *APIHandler) ListObjects(w http.ResponseWriter, r *http.Request) {
	// Path: /api/objectstore/{bucket}/objects
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid objects path")
		return
	}
	bucket := parts[2]

	objects, err := h.Client.ListObjects(r.Context(), bucket)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if objects == nil {
		objects = []models.ObjectSummary{}
	}
	WriteJSON(w, http.StatusOK, objects)
}

// HandleObject handles download, upload, and deletion of an object.
func (h *APIHandler) HandleObject(w http.ResponseWriter, r *http.Request) {
	// Path: /api/objectstore/{bucket}/objects/{name}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		WriteError(w, http.StatusBadRequest, "invalid object path")
		return
	}
	bucket := parts[2]
	name := strings.Join(parts[4:], "/")

	switch r.Method {
	case http.MethodGet:
		data, summary, err := h.Client.GetObject(r.Context(), bucket, name)
		if err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
		if summary != nil && summary.Digest != "" {
			w.Header().Set("ETag", summary.Digest)
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(data)

	case http.MethodPost:
		// Upload object
		data, err := io.ReadAll(r.Body)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "failed to read body: "+err.Error())
			return
		}
		desc := r.Header.Get("X-Object-Description")
		summary, err := h.Client.PutObject(r.Context(), bucket, name, desc, data)
		if err != nil {
			WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		WriteJSON(w, http.StatusCreated, summary)

	case http.MethodDelete:
		if err := h.Client.DeleteObject(r.Context(), bucket, name); err != nil {
			WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"message": "object deleted"})

	default:
		WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// PublishMessage sends a message with custom headers and deduplication.
func (h *APIHandler) PublishMessage(w http.ResponseWriter, r *http.Request) {
	var req models.PublishMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	resp, err := h.Client.PublishMessage(r.Context(), req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, resp)
}

// RequestReply probes a subject synchronously with timeout and latency recording.
func (h *APIHandler) RequestReply(w http.ResponseWriter, r *http.Request) {
	var req models.RequestReplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	resp, err := h.Client.RequestReply(r.Context(), req)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, resp)
}

// StartReplay initiates a background stream replay operation.
func (h *APIHandler) StartReplay(w http.ResponseWriter, r *http.Request) {
	var req models.ReplayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	prog, err := h.ReplayManager.StartReplay(req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusAccepted, prog)
}

// GetReplayProgress returns current replay progress.
func (h *APIHandler) GetReplayProgress(w http.ResponseWriter, r *http.Request) {
	// Path: /api/replay/{id}/progress
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid replay progress path")
		return
	}
	replayID := parts[2]

	prog, err := h.ReplayManager.GetReplayProgress(replayID)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, prog)
}

// StopReplay cancels a stream replay operation.
func (h *APIHandler) StopReplay(w http.ResponseWriter, r *http.Request) {
	// Path: /api/replay/{id}/stop
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid replay stop path")
		return
	}
	replayID := parts[2]

	if err := h.ReplayManager.StopReplay(replayID); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "replay cancelled"})
}

// TapSubject streams live messages matching a subject pattern over SSE.
func (h *APIHandler) TapSubject(w http.ResponseWriter, r *http.Request) {
	// Path: /api/tap?subject=orders.*
	subject := r.URL.Query().Get("subject")
	if subject == "" {
		subject = ">"
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		WriteError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	messages, err := h.Client.TapSubject(r.Context(), subject)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	for {
		select {
		case <-r.Context().Done():
			return
		case msg, ok := <-messages:
			if !ok {
				return
			}
			data, _ := json.Marshal(msg)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// GetTopology returns the dataflow graph for the current NATS & JetStream topology.
func (h *APIHandler) GetTopology(w http.ResponseWriter, r *http.Request) {
	topo, err := h.Client.BuildTopologyData(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, topo)
}

// ListSchemas returns all registered schema definitions.
func (h *APIHandler) ListSchemas(w http.ResponseWriter, r *http.Request) {
	schemas := h.SchemaRegistry.ListSchemas()
	WriteJSON(w, http.StatusOK, schemas)
}

// SaveSchema creates or updates a schema definition.
func (h *APIHandler) SaveSchema(w http.ResponseWriter, r *http.Request) {
	var s models.SchemaDefinition
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid schema payload")
		return
	}
	saved := h.SchemaRegistry.SaveSchema(s)
	WriteJSON(w, http.StatusOK, saved)
}

// DeleteSchema removes a schema definition.
func (h *APIHandler) DeleteSchema(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid schema path")
		return
	}
	id := parts[2]
	if !h.SchemaRegistry.DeleteSchema(id) {
		WriteError(w, http.StatusNotFound, "schema not found")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "schema deleted"})
}

// ValidatePayload validates a payload against matching or specified schema.
func (h *APIHandler) ValidatePayload(w http.ResponseWriter, r *http.Request) {
	var req models.ValidatePayloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid validation request")
		return
	}
	res := h.SchemaRegistry.ValidatePayload(req)
	WriteJSON(w, http.StatusOK, res)
}

// ListDLQMessages returns all quarantined poison pills.
func (h *APIHandler) ListDLQMessages(w http.ResponseWriter, r *http.Request) {
	msgs := h.DLQManager.ListMessages()
	WriteJSON(w, http.StatusOK, msgs)
}

// GetDLQMessage returns a single quarantined message.
func (h *APIHandler) GetDLQMessage(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid dlq path")
		return
	}
	id := parts[2]
	msg, found := h.DLQManager.GetMessage(id)
	if !found {
		WriteError(w, http.StatusNotFound, "message not found in quarantine")
		return
	}
	WriteJSON(w, http.StatusOK, msg)
}

// RepublishDLQ republishes a quarantined message and optionally acknowledges original.
func (h *APIHandler) RepublishDLQ(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid dlq republish path")
		return
	}
	id := parts[2]

	var req models.RepublishDLQRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid republish payload")
		return
	}

	if err := h.DLQManager.RepublishMessage(r.Context(), id, req); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "message republished successfully"})
}

// PurgeDLQ removes a message from the quarantine registry.
func (h *APIHandler) PurgeDLQ(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid dlq path")
		return
	}
	id := parts[2]
	if !h.DLQManager.PurgeMessage(id) {
		WriteError(w, http.StatusNotFound, "message not found")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "quarantined message purged"})
}

// ScanDLQ scans streams for stuck messages or errors.
func (h *APIHandler) ScanDLQ(w http.ResponseWriter, r *http.Request) {
	count := h.DLQManager.ScanStreamsForPoisonPills(r.Context())
	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"scanned":     true,
		"discovered":  count,
		"quarantined": h.DLQManager.QuarantinedCount(),
	})
}

// StartTraffic launches a synthetic traffic generator session.
func (h *APIHandler) StartTraffic(w http.ResponseWriter, r *http.Request) {
	var cfg models.TrafficGeneratorConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid traffic generator configuration")
		return
	}

	sessID, err := h.TrafficEngine.StartSession(cfg)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"sessionId": sessID, "status": "running"})
}

// StopTraffic halts a running traffic session.
func (h *APIHandler) StopTraffic(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid traffic stop path")
		return
	}
	id := parts[2]
	if !h.TrafficEngine.StopSession(id) {
		WriteError(w, http.StatusNotFound, "session not active or not found")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "traffic session stopped"})
}

// ListTraffic returns all traffic generator sessions and statuses.
func (h *APIHandler) ListTraffic(w http.ResponseWriter, r *http.Request) {
	sessions := h.TrafficEngine.ListSessions()
	WriteJSON(w, http.StatusOK, sessions)
}

// ExportKV exports an entire KV bucket to JSON.
func (h *APIHandler) ExportKV(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid kv export path")
		return
	}
	bucket := parts[2]

	data, err := h.Client.ExportKVBucket(r.Context(), bucket)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-kv-export.json", bucket))
	WriteJSON(w, http.StatusOK, data)
}

// ImportKV imports a KV bucket from JSON.
func (h *APIHandler) ImportKV(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid kv import path")
		return
	}
	bucket := parts[2]

	var data models.KVExportData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid import JSON format")
		return
	}

	count, err := h.Client.ImportKVBucket(r.Context(), bucket, data)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]interface{}{"importedKeys": count, "bucket": bucket})
}

// ExportStream exports a message slice from a stream.
func (h *APIHandler) ExportStream(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		WriteError(w, http.StatusBadRequest, "invalid stream export path")
		return
	}
	stream := parts[2]

	startSeq, _ := strconv.ParseUint(r.URL.Query().Get("startSeq"), 10, 64)
	count, _ := strconv.Atoi(r.URL.Query().Get("count"))
	if count <= 0 {
		count = 200
	}

	data, err := h.Client.ExportStreamSlice(r.Context(), stream, startSeq, count)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-stream-export.json", stream))
	WriteJSON(w, http.StatusOK, data)
}

// PrometheusMetrics returns text-based Prometheus metrics for scraping.
func (h *APIHandler) PrometheusMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := natsclient.FormatPrometheusMetrics(h.Client)
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(metrics))
}

// ListAlertRules returns all alert rules.
func (h *APIHandler) ListAlertRules(w http.ResponseWriter, r *http.Request) {
	rules := h.AlertEngine.ListRules()
	WriteJSON(w, http.StatusOK, rules)
}

// SaveAlertRule creates or updates an alert rule.
func (h *APIHandler) SaveAlertRule(w http.ResponseWriter, r *http.Request) {
	var rule models.AlertRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid alert rule format")
		return
	}
	saved := h.AlertEngine.SaveRule(rule)
	WriteJSON(w, http.StatusOK, saved)
}

// DeleteAlertRule removes an alert rule.
func (h *APIHandler) DeleteAlertRule(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		WriteError(w, http.StatusBadRequest, "invalid alert rule path")
		return
	}
	id := parts[2]
	if !h.AlertEngine.DeleteRule(id) {
		WriteError(w, http.StatusNotFound, "rule not found")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "alert rule deleted"})
}

// ListAlertEvents returns recent incident notifications.
func (h *APIHandler) ListAlertEvents(w http.ResponseWriter, r *http.Request) {
	events := h.AlertEngine.ListEvents()
	WriteJSON(w, http.StatusOK, events)
}

// TestWebhook sends a test notification to a webhook endpoint.
func (h *APIHandler) TestWebhook(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WebhookURL  string `json:"webhookUrl"`
		ChannelType string `json:"channelType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid test webhook request")
		return
	}

	if err := h.AlertEngine.TestWebhook(body.WebhookURL, body.ChannelType); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "webhook verified successfully"})
}

