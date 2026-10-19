package natsclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
)

// AlertEngine evaluates alert conditions against NATS metrics and dispatches webhooks.
type AlertEngine struct {
	mu     sync.RWMutex
	rules  map[string]models.AlertRule
	events []models.AlertEvent
	client *NATSClient
}

// NewAlertEngine creates a new alert engine with default sample rules.
func NewAlertEngine(client *NATSClient) *AlertEngine {
	engine := &AlertEngine{
		rules:  make(map[string]models.AlertRule),
		events: make([]models.AlertEvent, 0),
		client: client,
	}

	// Sample rule 1: Consumer lag threshold
	engine.SaveRule(models.AlertRule{
		ID:              "rule-lag-orders",
		Name:            "Orders Consumer Lag Alert",
		Type:            "consumer_lag",
		TargetStream:    "ORDERS",
		TargetConsumer:  "orders-worker",
		Threshold:       500,
		DurationSeconds: 60,
		WebhookURL:      "https://httpbin.org/post",
		ChannelType:     "generic",
		Enabled:         true,
		Status:          "ok",
	})

	// Sample rule 2: High Redelivery Ratio
	engine.SaveRule(models.AlertRule{
		ID:              "rule-redeliveries",
		Name:            "High Redelivery Poison Alert",
		Type:            "redelivery_ratio",
		Threshold:       10.0, // 10%
		DurationSeconds: 120,
		WebhookURL:      "https://httpbin.org/post",
		ChannelType:     "slack",
		Enabled:         true,
		Status:          "ok",
	})

	return engine
}

// ListRules returns all configured alert rules.
func (e *AlertEngine) ListRules() []models.AlertRule {
	e.mu.RLock()
	defer e.mu.RUnlock()

	res := make([]models.AlertRule, 0, len(e.rules))
	for _, r := range e.rules {
		res = append(res, r)
	}
	return res
}

// SaveRule saves or updates an alert rule.
func (e *AlertEngine) SaveRule(r models.AlertRule) models.AlertRule {
	e.mu.Lock()
	defer e.mu.Unlock()

	if r.ID == "" {
		r.ID = fmt.Sprintf("rule-%d", time.Now().UnixNano())
	}
	if r.Status == "" {
		r.Status = "ok"
	}
	e.rules[r.ID] = r
	return r
}

// DeleteRule removes an alert rule.
func (e *AlertEngine) DeleteRule(id string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, exists := e.rules[id]; exists {
		delete(e.rules, id)
		return true
	}
	return false
}

// ListEvents returns recent incident notifications.
func (e *AlertEngine) ListEvents() []models.AlertEvent {
	e.mu.RLock()
	defer e.mu.RUnlock()

	res := make([]models.AlertEvent, len(e.events))
	copy(res, e.events)
	return res
}

// TestWebhook dispatches a mock test payload to the configured webhook URL.
func (e *AlertEngine) TestWebhook(webhookURL, channelType string) error {
	if webhookURL == "" {
		return fmt.Errorf("webhook URL is empty")
	}

	var payload []byte
	testMsg := "🔔 [NATSLens] Test Alert Notification: Webhook integration is verified and operational."

	switch channelType {
	case "slack":
		payload, _ = json.Marshal(map[string]interface{}{
			"text": testMsg,
			"attachments": []map[string]interface{}{
				{
					"color": "#10b981",
					"title": "NATSLens Alert Engine",
					"text":  "Connection to your NATS JetStream cluster is active.",
				},
			},
		})
	case "discord":
		payload, _ = json.Marshal(map[string]interface{}{
			"content": testMsg,
		})
	default:
		payload, _ = json.Marshal(map[string]interface{}{
			"source":    "NATSLens",
			"event":     "webhook.test",
			"message":   testMsg,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(webhookURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to send webhook HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook endpoint responded with HTTP %d", resp.StatusCode)
	}

	return nil
}

// EvaluateRules checks all active alert rules against live cluster metrics.
func (e *AlertEngine) EvaluateRules() []models.AlertEvent {
	consumers, err := e.client.ListAllConsumers(context.Background())
	if err != nil {
		return nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	var newEvents []models.AlertEvent

	for id, rule := range e.rules {
		if !rule.Enabled {
			continue
		}

		triggered := false
		var triggerMsg string
		severity := "warning"

		switch rule.Type {
		case "consumer_lag":
			for _, c := range consumers {
				if (rule.TargetStream == "" || rule.TargetStream == c.StreamName) &&
					(rule.TargetConsumer == "" || rule.TargetConsumer == c.Name) {
					if float64(c.NumPending) >= rule.Threshold {
						triggered = true
						severity = "critical"
						triggerMsg = fmt.Sprintf("Consumer %s/%s lag exceeded threshold: %d >= %.0f", c.StreamName, c.Name, c.NumPending, rule.Threshold)
						break
					}
				}
			}

		case "redelivery_ratio":
			for _, c := range consumers {
				if c.RedeliveryRatio*100 >= rule.Threshold && c.NumRedelivered > 5 {
					triggered = true
					severity = "warning"
					triggerMsg = fmt.Sprintf("Consumer %s/%s redelivery ratio high: %.1f%% >= %.1f%%", c.StreamName, c.Name, c.RedeliveryRatio*100, rule.Threshold)
					break
				}
			}
		}

		now := time.Now()
		if triggered {
			rule.Status = "alerting"
			rule.LastTriggered = &now
			e.rules[id] = rule

			event := models.AlertEvent{
				ID:        fmt.Sprintf("evt-%d", now.UnixNano()),
				RuleID:    rule.ID,
				RuleName:  rule.Name,
				Timestamp: now,
				Severity:  severity,
				Message:   triggerMsg,
				Resolved:  false,
			}
			e.events = append(e.events, event)
			newEvents = append(newEvents, event)

			// Async dispatch
			go func(url, cType, msg string) {
				_ = e.TestWebhook(url, cType)
			}(rule.WebhookURL, rule.ChannelType, triggerMsg)
		} else {
			if rule.Status == "alerting" {
				rule.Status = "ok"
				e.rules[id] = rule
			}
		}
	}

	return newEvents
}
