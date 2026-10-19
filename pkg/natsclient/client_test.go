package natsclient_test

import (
	"context"
	"testing"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/embedded"
	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/alexandrmotologa/natslens/pkg/natsclient"
	"github.com/nats-io/nats.go"
)

func TestFullNATSClientSuite(t *testing.T) {
	// 1. Start embedded demo server
	demo, err := embedded.StartDemoServer(0)
	if err != nil {
		t.Fatalf("Failed to start embedded demo server: %v", err)
	}
	defer demo.Stop()

	// 2. Connect client
	client := natsclient.NewClient()
	err = client.Connect(models.ConnectionConfig{
		ID:   "test-cluster",
		Name: "Embedded Test Cluster",
		URL:  demo.ClientURL(),
	})
	if err != nil {
		t.Fatalf("Failed to connect client: %v", err)
	}
	defer client.Close()

	if !client.IsConnected() {
		t.Fatalf("Client reports disconnected")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 3. Test Cluster Stats
	t.Run("ClusterStats", func(t *testing.T) {
		stats, err := client.GetClusterStats()
		if err != nil {
			t.Fatalf("GetClusterStats error: %v", err)
		}
		if !stats.JetStreamAvailable {
			t.Fatalf("Expected JetStreamAvailable to be true")
		}
		if stats.JetStream.StreamsCount < 3 {
			t.Errorf("Expected at least 3 streams, got %d", stats.JetStream.StreamsCount)
		}
	})

	// 4. Test Stream Operations
	t.Run("StreamOperations", func(t *testing.T) {
		streams, err := client.ListStreams(ctx)
		if err != nil {
			t.Fatalf("ListStreams error: %v", err)
		}
		if len(streams) == 0 {
			t.Fatalf("Expected non-empty streams list")
		}

		// Find ORDERS stream
		var ordersFound bool
		for _, s := range streams {
			if s.Name == "ORDERS" {
				ordersFound = true
				break
			}
		}
		if !ordersFound {
			t.Errorf("ORDERS stream not found in ListStreams")
		}

		// Get ORDERS stream detail
		detail, err := client.GetStream(ctx, "ORDERS")
		if err != nil {
			t.Fatalf("GetStream error: %v", err)
		}
		if detail.Name != "ORDERS" {
			t.Errorf("Expected stream name ORDERS, got %s", detail.Name)
		}
		if detail.SubjectHierarchy == nil {
			t.Errorf("Expected non-nil SubjectHierarchy")
		}

		// Test Create, Purge, and Delete custom stream
		newStream, err := client.CreateStream(ctx, models.CreateStreamRequest{
			Name:        "AUDIT_LOGS",
			Description: "Test audit logs",
			Subjects:    []string{"audit.*"},
			Retention:   "limits",
			Storage:     "memory",
		})
		if err != nil {
			t.Fatalf("CreateStream error: %v", err)
		}
		if newStream.Name != "AUDIT_LOGS" {
			t.Errorf("Expected name AUDIT_LOGS, got %s", newStream.Name)
		}

		err = client.PurgeStream(ctx, "AUDIT_LOGS", "")
		if err != nil {
			t.Errorf("PurgeStream error: %v", err)
		}

		err = client.DeleteStream(ctx, "AUDIT_LOGS")
		if err != nil {
			t.Errorf("DeleteStream error: %v", err)
		}
	})

	// 5. Test Consumer Lag & Health Metrics
	t.Run("ConsumersAndLag", func(t *testing.T) {
		consumers, err := client.ListConsumers(ctx, "ORDERS")
		if err != nil {
			t.Fatalf("ListConsumers error: %v", err)
		}
		if len(consumers) == 0 {
			t.Fatalf("Expected at least 1 consumer on ORDERS stream")
		}

		cSummary := consumers[0]
		if cSummary.HealthStatus == "" {
			t.Errorf("Consumer health status should not be empty")
		}

		// Test creating a new consumer
		created, err := client.CreateConsumer(ctx, models.CreateConsumerRequest{
			StreamName:     "ORDERS",
			Name:           "test-ephemeral-worker",
			Description:    "Temporary test worker",
			DeliverPolicy:  "all",
			AckPolicy:      "explicit",
			AckWaitSeconds: 15,
			MaxDeliver:     3,
			FilterSubject:  "orders.created",
		})
		if err != nil {
			t.Fatalf("CreateConsumer error: %v", err)
		}
		if created.Name != "test-ephemeral-worker" {
			t.Errorf("Expected consumer name test-ephemeral-worker, got %s", created.Name)
		}

		// Clean up consumer
		err = client.DeleteConsumer(ctx, "ORDERS", "test-ephemeral-worker")
		if err != nil {
			t.Errorf("DeleteConsumer error: %v", err)
		}
	})

	// 6. Test Key-Value Workbench
	t.Run("KeyValueWorkbench", func(t *testing.T) {
		buckets, err := client.ListKVBuckets(ctx)
		if err != nil {
			t.Fatalf("ListKVBuckets error: %v", err)
		}
		if len(buckets) == 0 {
			t.Fatalf("Expected at least 1 KV bucket, got 0")
		}

		// Test creating new bucket, put, get, history, delete
		bucketName := "session-store"
		newBucket, err := client.CreateKVBucket(ctx, models.CreateKVBucketRequest{
			Bucket:      bucketName,
			Description: "User session cache",
			History:     5,
			Storage:     "memory",
		})
		if err != nil {
			t.Fatalf("CreateKVBucket error: %v", err)
		}
		if newBucket.Bucket != bucketName {
			t.Errorf("Expected bucket %s, got %s", bucketName, newBucket.Bucket)
		}

		rev1, err := client.PutEntry(ctx, bucketName, "user.101", `{"role":"admin"}`)
		if err != nil {
			t.Fatalf("PutEntry error: %v", err)
		}
		if rev1 == 0 {
			t.Errorf("Expected revision > 0")
		}

		rev2, err := client.PutEntry(ctx, bucketName, "user.101", `{"role":"superadmin"}`)
		if err != nil {
			t.Fatalf("PutEntry rev 2 error: %v", err)
		}
		if rev2 <= rev1 {
			t.Errorf("Expected rev2 > rev1")
		}

		entry, err := client.GetEntry(ctx, bucketName, "user.101")
		if err != nil {
			t.Fatalf("GetEntry error: %v", err)
		}
		if entry.Value != `{"role":"superadmin"}` {
			t.Errorf("Unexpected entry value: %s", entry.Value)
		}

		history, err := client.GetRevisionHistory(ctx, bucketName, "user.101")
		if err != nil {
			t.Fatalf("GetRevisionHistory error: %v", err)
		}
		if len(history) != 2 {
			t.Errorf("Expected 2 revisions, got %d", len(history))
		}

		_ = client.DeleteKVBucket(ctx, bucketName)
	})

	// 7. Test Message Publisher & Browse
	t.Run("PublishAndBrowse", func(t *testing.T) {
		pubResp, err := client.PublishMessage(ctx, models.PublishMessageRequest{
			Subject: "orders.created",
			Payload: `{"orderId":"ORD-TEST-99","amount":199.95}`,
			MsgID:   "test-dedup-99",
		})
		if err != nil {
			t.Fatalf("PublishMessage error: %v", err)
		}
		if pubResp.Sequence == 0 {
			t.Errorf("Expected non-zero sequence from JetStream publish")
		}

		// Publish duplicate with same MsgID
		pubRespDup, err := client.PublishMessage(ctx, models.PublishMessageRequest{
			Subject: "orders.created",
			Payload: `{"orderId":"ORD-TEST-99","amount":199.95}`,
			MsgID:   "test-dedup-99",
		})
		if err != nil {
			t.Fatalf("Publish duplicate error: %v", err)
		}
		if !pubRespDup.Duplicate {
			t.Errorf("Expected Duplicate flag to be true")
		}

		// Browse messages
		messages, err := client.BrowseStreamMessages(ctx, "ORDERS", 1, 10, "")
		if err != nil {
			t.Fatalf("BrowseStreamMessages error: %v", err)
		}
		if len(messages) == 0 {
			t.Errorf("Expected messages in ORDERS stream")
		}
	})

	// 8. Test Request-Reply Probe
	t.Run("RequestReplyProbe", func(t *testing.T) {
		nc, err := client.Conn()
		if err != nil {
			t.Fatalf("Client Conn error: %v", err)
		}

		// Set up mock responder on subject "service.echo"
		sub, err := nc.Subscribe("service.echo", func(m *nats.Msg) {
			_ = m.Respond([]byte("echo: " + string(m.Data)))
		})
		if err == nil {
			defer sub.Unsubscribe()
		}

		echoResp, err := client.RequestReply(ctx, models.RequestReplyRequest{
			Subject:   "service.echo",
			Payload:   "hello natslens",
			TimeoutMs: 500,
		})
		if err != nil {
			t.Fatalf("RequestReply to echo failed: %v", err)
		}
		if echoResp.Payload != "echo: hello natslens" {
			t.Errorf("Unexpected echo response: %s", echoResp.Payload)
		}
		if echoResp.LatencyMs <= 0 {
			t.Errorf("Expected positive latency, got %f", echoResp.LatencyMs)
		}
	})
}
