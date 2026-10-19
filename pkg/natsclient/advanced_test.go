package natsclient_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/embedded"
	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/alexandrmotologa/natslens/pkg/natsclient"
)

func TestAdvancedModules(t *testing.T) {
	// Start embedded demo cluster
	demo, err := embedded.StartDemoServer(0)
	if err != nil {
		t.Fatalf("failed to start embedded NATS server: %v", err)
	}
	defer demo.Stop()

	client := natsclient.NewClient()
	cfg := models.ConnectionConfig{
		Name: "Test Cluster",
		URL:  demo.ClientURL(),
	}
	if err := client.Connect(cfg); err != nil {
		t.Fatalf("failed to connect to embedded NATS: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Schema Registry Test
	t.Run("SchemaRegistry", func(t *testing.T) {
		reg := natsclient.NewSchemaRegistry()
		schemas := reg.ListSchemas()
		if len(schemas) < 2 {
			t.Errorf("expected at least 2 seeded schemas, got %d", len(schemas))
		}

		// Valid payload test
		validRes := reg.ValidatePayload(models.ValidatePayloadRequest{
			Subject: "orders.created",
			Payload: `{"orderId":"ord-100","customerId":"cust-1","amount":49.99,"status":"NEW"}`,
		})
		if !validRes.Valid {
			t.Errorf("expected payload to be valid, got errors: %v", validRes.Errors)
		}

		// Invalid payload test: missing required amount
		invalidRes := reg.ValidatePayload(models.ValidatePayloadRequest{
			Subject: "orders.created",
			Payload: `{"orderId":"ord-100","customerId":"cust-1","status":"NEW"}`,
		})
		if invalidRes.Valid {
			t.Errorf("expected payload to fail validation due to missing amount")
		}
	})

	// 2. DLQ Manager Test
	t.Run("DLQManager", func(t *testing.T) {
		dlq := natsclient.NewDLQManager(client)
		msgs := dlq.ListMessages()
		if len(msgs) == 0 {
			t.Errorf("expected seeded DLQ messages, got 0")
		}

		firstID := msgs[0].ID
		_, found := dlq.GetMessage(firstID)
		if !found {
			t.Fatalf("message %s not found", firstID)
		}

		// Test republish
		err := dlq.RepublishMessage(ctx, firstID, models.RepublishDLQRequest{
			TargetSubject: "orders.republished",
			Payload:       `{"orderId":"ord_err_99","amount":100,"customerId":"cust_55"}`,
		})
		if err != nil {
			t.Errorf("failed to republish DLQ message: %v", err)
		}

		updated, _ := dlq.GetMessage(firstID)
		if updated.Status != "republished" {
			t.Errorf("expected status 'republished', got %s", updated.Status)
		}

		// Test purge
		dlq.PurgeMessage(firstID)
		if _, exists := dlq.GetMessage(firstID); exists {
			t.Errorf("expected message to be purged")
		}
	})

	// 3. Traffic Engine Test
	t.Run("TrafficEngine", func(t *testing.T) {
		eng := natsclient.NewTrafficEngine(client)
		sessID, err := eng.StartSession(models.TrafficGeneratorConfig{
			TargetSubject:   "test.traffic.stream",
			RatePerSec:      20,
			TotalMessages:   5,
			PayloadTemplate: `{"id":"{{uuid}}","val":{{random_int}}}`,
		})
		if err != nil {
			t.Fatalf("failed to start traffic session: %v", err)
		}

		time.Sleep(300 * time.Millisecond)

		status, found := eng.GetStatus(sessID)
		if !found {
			t.Errorf("expected session %s to exist", sessID)
		}
		if status.SentMessages == 0 {
			t.Logf("traffic generator sent %d messages so far", status.SentMessages)
		}

		eng.StopSession(sessID)
	})

	// 4. Prometheus Metrics Formatter Test
	t.Run("PrometheusMetrics", func(t *testing.T) {
		metrics := natsclient.FormatPrometheusMetrics(client)
		if !strings.Contains(metrics, "natslens_scrape_timestamp_seconds") {
			t.Errorf("metrics output missing timestamp header")
		}
		if !strings.Contains(metrics, "natslens_cluster_connections") {
			t.Errorf("metrics output missing cluster connections")
		}
	})

	// 5. Alert Engine Test
	t.Run("AlertEngine", func(t *testing.T) {
		alertEng := natsclient.NewAlertEngine(client)
		rules := alertEng.ListRules()
		if len(rules) < 2 {
			t.Errorf("expected at least 2 seeded alert rules, got %d", len(rules))
		}

		rule := alertEng.SaveRule(models.AlertRule{
			Name:        "Test High Lag",
			Type:        "consumer_lag",
			Threshold:   1,
			WebhookURL:  "https://httpbin.org/post",
			ChannelType: "generic",
			Enabled:     true,
		})
		if rule.ID == "" {
			t.Errorf("expected generated rule ID")
		}

		alertEng.DeleteRule(rule.ID)
	})

	// 6. Topology Builder Test
	t.Run("TopologyData", func(t *testing.T) {
		topo, err := client.BuildTopologyData(ctx)
		if err != nil {
			t.Fatalf("failed to build topology data: %v", err)
		}
		if len(topo.Nodes) == 0 {
			t.Errorf("expected topology nodes, got 0")
		}
	})
}
