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
}
