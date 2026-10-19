package embedded

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net"
	"os"
	"sync"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/nats-io/nats.go"
)

// DemoServer manages an in-process NATS JetStream server populated with demo data.
type DemoServer struct {
	server   *natsserver.Server
	clientURL string
	tempDir  string
	stopChan chan struct{}
	stopped  bool
	mu       sync.Mutex
}

// StartDemoServer initializes and starts an embedded JetStream server.
func StartDemoServer(requestedPort int) (*DemoServer, error) {
	tempDir, err := os.MkdirTemp("", "natslens-demo-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir for nats: %w", err)
	}

	port := requestedPort
	if port <= 0 {
		port = getFreePort()
	}

	opts := &natsserver.Options{
		ServerName: "natslens-embedded-cluster",
		Host:       "127.0.0.1",
		Port:       port,
		JetStream:  true,
		StoreDir:   tempDir,
		NoLog:      true,
		NoSigs:     true,
	}

	ns, err := natsserver.NewServer(opts)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		return nil, fmt.Errorf("failed to create embedded nats server: %w", err)
	}

	go ns.Start()

	if !ns.ReadyForConnections(10 * time.Second) {
		ns.Shutdown()
		_ = os.RemoveAll(tempDir)
		return nil, fmt.Errorf("embedded nats server did not become ready in time")
	}

	clientURL := fmt.Sprintf("nats://127.0.0.1:%d", ns.Addr().(*net.TCPAddr).Port)

	ds := &DemoServer{
		server:    ns,
		clientURL: clientURL,
		tempDir:   tempDir,
		stopChan:  make(chan struct{}),
	}

	// Seed demo data
	if err := ds.seedData(); err != nil {
		fmt.Printf("warning: error seeding demo data: %v\n", err)
	}

	// Start simulated real-time event generator
	go ds.runTrafficGenerator()

	return ds, nil
}

// ClientURL returns the connection URL for this embedded server.
func (ds *DemoServer) ClientURL() string {
	return ds.clientURL
}

// Stop shuts down the embedded server and cleans up temporary files.
func (ds *DemoServer) Stop() {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.stopped {
		return
	}
	ds.stopped = true
	close(ds.stopChan)

	if ds.server != nil {
		ds.server.Shutdown()
	}
	if ds.tempDir != "" {
		_ = os.RemoveAll(ds.tempDir)
	}
}

func (ds *DemoServer) seedData() error {
	nc, err := nats.Connect(ds.clientURL, nats.Timeout(3*time.Second))
	if err != nil {
		return err
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		return err
	}

	// 1. ORDERS Stream
	_, err = js.AddStream(&nats.StreamConfig{
		Name:        "ORDERS",
		Description: "E-Commerce checkout and lifecycle events",
		Subjects:    []string{"orders.>"},
		Retention:   nats.LimitsPolicy,
		Storage:     nats.FileStorage,
		MaxMsgs:     10000,
	})
	if err != nil {
		return fmt.Errorf("create ORDERS stream: %w", err)
	}

	// Consumers on ORDERS
	_, _ = js.AddConsumer("ORDERS", &nats.ConsumerConfig{
		Durable:        "order-fulfillment-worker",
		Description:    "Processes newly placed orders into warehouse queue",
		FilterSubject:  "orders.created",
		AckPolicy:      nats.AckExplicitPolicy,
		AckWait:        15 * time.Second,
		MaxDeliver:     5,
		DeliverSubject: "workers.fulfillment",
	})

	_, _ = js.AddConsumer("ORDERS", &nats.ConsumerConfig{
		Durable:        "customer-notifications",
		Description:    "Sends SMS and Email notifications upon order state changes",
		FilterSubject:  "orders.>",
		AckPolicy:      nats.AckExplicitPolicy,
		AckWait:        30 * time.Second,
		MaxDeliver:     3,
	})

	_, _ = js.AddConsumer("ORDERS", &nats.ConsumerConfig{
		Durable:        "fraud-audit-pipeline",
		Description:    "High-frequency risk scoring analysis on placed orders",
		FilterSubject:  "orders.paid",
		AckPolicy:      nats.AckExplicitPolicy,
		AckWait:        20 * time.Second,
		MaxDeliver:     5,
	})

	// Seed sample order messages
	statuses := []string{"created", "paid", "fulfilled"}
	for i := 1; i <= 25; i++ {
		status := statuses[i%len(statuses)]
		orderPayload := map[string]interface{}{
			"orderId":   fmt.Sprintf("ORD-%04d", 1000+i),
			"customerId": fmt.Sprintf("CUST-%03d", (i*7)%50+1),
			"amount":    float64(29+i*12) + 0.99,
			"currency":  "USD",
			"status":    status,
			"items": []map[string]interface{}{
				{"sku": "SKU-PRO-01", "qty": (i%3) + 1, "unitPrice": 49.99},
			},
			"timestamp": time.Now().Add(-time.Duration(25-i) * time.Minute).Format(time.RFC3339),
		}
		data, _ := json.Marshal(orderPayload)

		msg := nats.NewMsg(fmt.Sprintf("orders.%s", status))
		msg.Data = data
		msg.Header.Set("Nats-Msg-Id", fmt.Sprintf("ord-msg-%04d", 1000+i))
		msg.Header.Set("Correlation-Id", fmt.Sprintf("corr-%d", 2000+i))
		msg.Header.Set("Origin-Service", "checkout-api")

		_, _ = js.PublishMsg(msg)
	}

	// 2. PAYMENTS Stream
	_, _ = js.AddStream(&nats.StreamConfig{
		Name:        "PAYMENTS",
		Description: "Stripe and PayPal transaction settlements",
		Subjects:    []string{"payments.*"},
		Retention:   nats.InterestPolicy,
		Storage:     nats.FileStorage,
	})

	_, _ = js.AddConsumer("PAYMENTS", &nats.ConsumerConfig{
		Durable:       "settlement-agent",
		Description:   "Reconciles gateway authorizations and captures",
		FilterSubject: "payments.*",
		AckPolicy:     nats.AckExplicitPolicy,
		AckWait:       10 * time.Second,
	})

	for i := 1; i <= 10; i++ {
		payPayload := map[string]interface{}{
			"paymentId": fmt.Sprintf("PAY-%05d", 50000+i),
			"orderId":   fmt.Sprintf("ORD-%04d", 1000+i),
			"method":    "credit_card",
			"gateway":   "stripe",
			"success":   true,
		}
		pData, _ := json.Marshal(payPayload)
		_, _ = js.Publish(fmt.Sprintf("payments.settled"), pData)
	}

	// 3. TELEMETRY Stream
	_, _ = js.AddStream(&nats.StreamConfig{
		Name:        "TELEMETRY",
		Description: "Cluster health metrics and edge node statistics",
		Subjects:    []string{"telemetry.>"},
		Retention:   nats.LimitsPolicy,
		Storage:     nats.MemoryStorage,
		MaxMsgs:     5000,
	})

	for i := 1; i <= 15; i++ {
		metric := map[string]interface{}{
			"node":      fmt.Sprintf("edge-worker-%d", (i%3)+1),
			"cpuUsage":  24.5 + float64(i*2%40),
			"memoryMb":  1024 + i*64,
			"timestamp": time.Now().Format(time.RFC3339),
		}
		mData, _ := json.Marshal(metric)
		_, _ = js.Publish("telemetry.system.metrics", mData)
	}

	// 4. Key-Value Store: app-config
	kv, err := js.CreateKeyValue(&nats.KeyValueConfig{
		Bucket:      "app-config",
		Description: "Application settings and dynamic feature flags",
		History:     5,
		Storage:     nats.FileStorage,
	})
	if err == nil {
		_, _ = kv.PutString("features.checkout_v2", `{"enabled": true, "rolloutPercent": 50}`)
		_, _ = kv.PutString("database.pool_size", "25")
		// Add history revisions
		_, _ = kv.PutString("database.pool_size", "50")
		_, _ = kv.PutString("database.pool_size", "100")
		_, _ = kv.PutString("maintenance_mode", "false")
		_, _ = kv.PutString("theme.primary_color", "#3B82F6")
		_, _ = kv.PutString("rate_limit_per_minute", "1200")
	}

	// 5. Key-Value Store: rate-limits
	kvRate, err := js.CreateKeyValue(&nats.KeyValueConfig{
		Bucket:      "rate-limits",
		Description: "Per-tenant request limits and quotas",
		History:     3,
	})
	if err == nil {
		_, _ = kvRate.PutString("tenant.1001.rpm", "500")
		_, _ = kvRate.PutString("tenant.1002.rpm", "2000")
		_, _ = kvRate.PutString("tenant.1003.rpm", "10000")
	}

	// 6. ObjectStore: documents
	obs, err := js.CreateObjectStore(&nats.ObjectStoreConfig{
		Bucket:      "documents",
		Description: "Centralized configuration and schema store",
	})
	if err == nil {
		schemaDoc := `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OrderEvent",
  "type": "object",
  "properties": {
    "orderId": { "type": "string" },
    "amount": { "type": "number" },
    "currency": { "type": "string" }
  },
  "required": ["orderId", "amount"]
}`
		_, _ = obs.PutBytes("order_schema.json", []byte(schemaDoc))

		cheatsheet := `# NATS.io JetStream Reference
- Subjects use dot separators: orders.us.created
- Wildcards: * matches single token, > matches one or more tokens
- Durable Consumers maintain sequence tracking across disconnects
- Key-Value stores are powered by JetStream streams under KV_<bucket>
`
		_, _ = obs.PutBytes("nats_cheatsheet.md", []byte(cheatsheet))
	}

	return nil
}

func (ds *DemoServer) runTrafficGenerator() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	nc, err := nats.Connect(ds.clientURL)
	if err != nil {
		return
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		return
	}

	counter := 1026
	events := []string{"created", "paid", "fulfilled"}

	for {
		select {
		case <-ds.stopChan:
			return
		case <-ticker.C:
			counter++
			status := events[rand.Intn(len(events))]
			order := map[string]interface{}{
				"orderId":   fmt.Sprintf("ORD-%04d", counter),
				"customerId": fmt.Sprintf("CUST-%03d", rand.Intn(100)+1),
				"amount":    float64(rand.Intn(200)+20) + 0.99,
				"currency":  "USD",
				"status":    status,
				"timestamp": time.Now().Format(time.RFC3339),
			}
			data, _ := json.Marshal(order)
			msg := nats.NewMsg(fmt.Sprintf("orders.%s", status))
			msg.Data = data
			msg.Header.Set("Nats-Msg-Id", fmt.Sprintf("live-%d", counter))
			msg.Header.Set("Origin-Service", "demo-traffic-gen")
			_, _ = js.PublishMsg(msg)

			// Publish telemetry ping
			telem := map[string]interface{}{
				"node":      "demo-node-alpha",
				"cpuUsage":  15.0 + float64(rand.Intn(35)),
				"memoryMb":  1240 + rand.Intn(256),
				"timestamp": time.Now().Format(time.RFC3339),
			}
			tData, _ := json.Marshal(telem)
			_, _ = js.Publish("telemetry.system.metrics", tData)
		}
	}
}

func getFreePort() int {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 4222
	}
	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 4222
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}
