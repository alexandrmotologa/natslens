package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/alexandrmotologa/natslens/server"
)

func TestServerEndpoints(t *testing.T) {
	srv, err := server.NewServer(server.Config{
		Host:     "127.0.0.1",
		Port:     0, // random port
		DemoMode: true,
		Version:  "0.1.0-test",
	})
	if err != nil {
		t.Fatalf("Failed to initialize server: %v", err)
	}

	go func() {
		_ = srv.Start()
	}()
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()

	time.Sleep(300 * time.Millisecond)
	baseURL := srv.URL()

	client := &http.Client{Timeout: 3 * time.Second}

	// 1. Health check
	t.Run("HealthCheck", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/health")
		if err != nil {
			t.Fatalf("GET /api/health error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
		var data map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&data)
		if data["status"] != "ok" {
			t.Errorf("Expected status ok, got %v", data["status"])
		}
	})

	// 2. Cluster stats
	t.Run("ClusterStats", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/cluster/stats")
		if err != nil {
			t.Fatalf("GET /api/cluster/stats error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
		var stats models.ClusterStats
		_ = json.NewDecoder(resp.Body).Decode(&stats)
		if !stats.JetStreamAvailable {
			t.Errorf("Expected JetStreamAvailable")
		}
	})

	// 3. Streams API
	t.Run("StreamsAPI", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/streams")
		if err != nil {
			t.Fatalf("GET /api/streams error: %v", err)
		}
		defer resp.Body.Close()
		var streams []models.StreamSummary
		_ = json.NewDecoder(resp.Body).Decode(&streams)
		if len(streams) == 0 {
			t.Errorf("Expected streams from demo server")
		}

		// Single stream detail
		respDetail, err := client.Get(baseURL + "/api/streams/ORDERS")
		if err != nil {
			t.Fatalf("GET /api/streams/ORDERS error: %v", err)
		}
		defer respDetail.Body.Close()
		var detail models.StreamDetail
		_ = json.NewDecoder(respDetail.Body).Decode(&detail)
		if detail.Name != "ORDERS" {
			t.Errorf("Expected stream ORDERS, got %s", detail.Name)
		}

		// Stream consumers
		respCons, err := client.Get(baseURL + "/api/streams/ORDERS/consumers")
		if err != nil {
			t.Fatalf("GET /api/streams/ORDERS/consumers error: %v", err)
		}
		defer respCons.Body.Close()
		var consumers []models.ConsumerSummary
		_ = json.NewDecoder(respCons.Body).Decode(&consumers)
		if len(consumers) == 0 {
			t.Errorf("Expected consumers on ORDERS stream")
		}
	})

	// 4. KV API
	t.Run("KVAPI", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/kv")
		if err != nil {
			t.Fatalf("GET /api/kv error: %v", err)
		}
		defer resp.Body.Close()
		var buckets []models.KVBucketSummary
		_ = json.NewDecoder(resp.Body).Decode(&buckets)
		if len(buckets) == 0 {
			t.Errorf("Expected KV buckets")
		}

		// List keys
		respKeys, err := client.Get(baseURL + "/api/kv/app-config/keys")
		if err != nil {
			t.Fatalf("GET /api/kv/app-config/keys error: %v", err)
		}
		defer respKeys.Body.Close()
		var keys []models.KVEntry
		_ = json.NewDecoder(respKeys.Body).Decode(&keys)
		if len(keys) == 0 {
			t.Errorf("Expected keys in app-config bucket")
		}
	})

	// 5. Message publish
	t.Run("PublishMessage", func(t *testing.T) {
		reqBody := models.PublishMessageRequest{
			Subject: "orders.created",
			Payload: `{"orderId":"ORD-API-TEST","amount":89.50}`,
			MsgID:   fmt.Sprintf("api-msg-%d", time.Now().UnixNano()),
		}
		data, _ := json.Marshal(reqBody)
		resp, err := client.Post(baseURL+"/api/messages/publish", "application/json", bytes.NewReader(data))
		if err != nil {
			t.Fatalf("POST /api/messages/publish error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
		var pubResp models.PublishMessageResponse
		_ = json.NewDecoder(resp.Body).Decode(&pubResp)
		if pubResp.Sequence == 0 {
			t.Errorf("Expected sequence > 0")
		}
	})

	// 6. Topology Graph
	t.Run("TopologyEndpoint", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/topology")
		if err != nil {
			t.Fatalf("GET /api/topology error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
		var topo models.TopologyData
		_ = json.NewDecoder(resp.Body).Decode(&topo)
		if len(topo.Nodes) == 0 {
			t.Errorf("Expected topology nodes")
		}
	})

	// 7. Schema Registry
	t.Run("SchemaRegistryEndpoints", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/schemas")
		if err != nil {
			t.Fatalf("GET /api/schemas error: %v", err)
		}
		defer resp.Body.Close()
		var schemas []models.SchemaDefinition
		_ = json.NewDecoder(resp.Body).Decode(&schemas)
		if len(schemas) == 0 {
			t.Errorf("Expected seeded schemas")
		}

		// Validate payload
		valReq := models.ValidatePayloadRequest{
			Subject: "orders.created",
			Payload: `{"orderId":"ord-1","customerId":"c1","amount":10,"status":"OK"}`,
		}
		b, _ := json.Marshal(valReq)
		valResp, err := client.Post(baseURL+"/api/schemas/validate", "application/json", bytes.NewReader(b))
		if err != nil {
			t.Fatalf("POST /api/schemas/validate error: %v", err)
		}
		defer valResp.Body.Close()
		var res models.ValidatePayloadResponse
		_ = json.NewDecoder(valResp.Body).Decode(&res)
		if !res.Valid {
			t.Errorf("Expected validation success, got: %v", res.Errors)
		}
	})

	// 8. DLQ & Poison Pills
	t.Run("DLQEndpoints", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/dlq")
		if err != nil {
			t.Fatalf("GET /api/dlq error: %v", err)
		}
		defer resp.Body.Close()
		var msgs []models.DLQMessage
		_ = json.NewDecoder(resp.Body).Decode(&msgs)
		if len(msgs) == 0 {
			t.Errorf("Expected seeded DLQ messages")
		}
	})

	// 9. Traffic Sessions
	t.Run("TrafficEndpoints", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/traffic/sessions")
		if err != nil {
			t.Fatalf("GET /api/traffic/sessions error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})

	// 10. Alerts
	t.Run("AlertsEndpoints", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/api/alerts/rules")
		if err != nil {
			t.Fatalf("GET /api/alerts/rules error: %v", err)
		}
		defer resp.Body.Close()
		var rules []models.AlertRule
		_ = json.NewDecoder(resp.Body).Decode(&rules)
		if len(rules) == 0 {
			t.Errorf("Expected seeded alert rules")
		}
	})

	// 11. Prometheus Metrics
	t.Run("PrometheusEndpoint", func(t *testing.T) {
		resp, err := client.Get(baseURL + "/metrics")
		if err != nil {
			t.Fatalf("GET /metrics error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})
}

