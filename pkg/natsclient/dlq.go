package natsclient

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// DLQManager manages poison pills and quarantined JetStream messages.
type DLQManager struct {
	mu       sync.RWMutex
	messages map[string]models.DLQMessage
	client   *NATSClient
}

// NewDLQManager creates a new DLQ manager.
func NewDLQManager(client *NATSClient) *DLQManager {
	mgr := &DLQManager{
		messages: make(map[string]models.DLQMessage),
		client:   client,
	}

	// Seed sample quarantined poison pill in demo mode
	mgr.messages["dlq-001"] = models.DLQMessage{
		ID:           "dlq-001",
		Stream:       "ORDERS",
		Consumer:     "orders-worker",
		Sequence:     42,
		Subject:      "orders.created",
		Timestamp:    time.Now().Add(-15 * time.Minute),
		Payload:      `{"orderId":"ord_err_99","amount":"invalid_nan","customerId":"cust_55"}`,
		PayloadType:  "json",
		Headers:      map[string][]string{"Nats-Msg-Id": {"ord_err_99"}, "Nats-Error": {"Unmarshal TypeError: expected number"}},
		Redeliveries: 5,
		ErrorReason:  "MaxDeliver (5) reached: worker panicked parsing amount field",
		Status:       "quarantined",
	}

	return mgr
}

// ListMessages returns all quarantined messages.
func (m *DLQManager) ListMessages() []models.DLQMessage {
	m.mu.RLock()
	defer m.mu.RUnlock()

	res := make([]models.DLQMessage, 0, len(m.messages))
	for _, msg := range m.messages {
		res = append(res, msg)
	}
	return res
}

// GetMessage retrieves a quarantined message by ID.
func (m *DLQManager) GetMessage(id string) (models.DLQMessage, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, ok := m.messages[id]
	return msg, ok
}

// RepublishMessage republishes a modified poison pill to the target stream and marks it resolved.
func (m *DLQManager) RepublishMessage(ctx context.Context, id string, req models.RepublishDLQRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	msg, exists := m.messages[id]
	if !exists {
		return fmt.Errorf("quarantined message %s not found", id)
	}

	targetSubject := req.TargetSubject
	if targetSubject == "" {
		targetSubject = msg.Subject
	}

	// Publish via NATS client
	pubReq := models.PublishMessageRequest{
		Subject: targetSubject,
		Payload: req.Payload,
		Headers: req.Headers,
	}

	if _, err := m.client.PublishMessage(ctx, pubReq); err != nil {
		return fmt.Errorf("failed to republish message: %w", err)
	}

	// If requested to delete original sequence from the stream
	if req.AcknowledgeOriginal && msg.Stream != "" && msg.Sequence > 0 {
		_ = m.client.DeleteMessage(ctx, msg.Stream, msg.Sequence)
	}

	msg.Status = "republished"
	msg.Payload = req.Payload
	m.messages[id] = msg
	return nil
}

// PurgeMessage removes a message from the quarantine registry.
func (m *DLQManager) PurgeMessage(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.messages[id]; exists {
		delete(m.messages, id)
		return true
	}
	return false
}

// ScanStreamsForPoisonPills scans streams and consumer states for high redeliveries.
func (m *DLQManager) ScanStreamsForPoisonPills(ctx context.Context) int {
	consumers, err := m.client.ListAllConsumers(ctx)
	if err != nil {
		return 0
	}

	discovered := 0
	for _, c := range consumers {
		if c.NumRedelivered > 0 || c.NumAckPending > 20 {
			// Browse messages from stream
			msgs, err := m.client.BrowseStreamMessages(ctx, c.StreamName, 1, 30, "")
			if err != nil {
				continue
			}

			for _, sm := range msgs {
				// If message has error headers or matches high redelivery patterns
				hasError := false
				var reason string
				if sm.Headers != nil {
					if errHeader, ok := sm.Headers["Nats-Error"]; ok && len(errHeader) > 0 {
						hasError = true
						reason = errHeader[0]
					}
				}

				if hasError {
					m.mu.Lock()
					id := fmt.Sprintf("dlq-%s-%d", c.StreamName, sm.Sequence)
					if _, exists := m.messages[id]; !exists {
						m.messages[id] = models.DLQMessage{
							ID:           id,
							Stream:       c.StreamName,
							Consumer:     c.Name,
							Sequence:     sm.Sequence,
							Subject:      sm.Subject,
							Timestamp:    sm.Timestamp,
							Payload:      sm.Payload,
							PayloadType:  sm.PayloadType,
							Headers:      sm.Headers,
							Redeliveries: int(c.NumRedelivered),
							ErrorReason:  reason,
							Status:       "quarantined",
						}
						discovered++
					}
					m.mu.Unlock()
				}
			}
		}
	}
	return discovered
}

// QuarantinedCount returns the total number of unresolved items.
func (m *DLQManager) QuarantinedCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, msg := range m.messages {
		if msg.Status == "quarantined" {
			count++
		}
	}
	return count
}

var _ = nats.ErrNoResponders
