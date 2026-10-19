package natsclient

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// ListConsumers returns summaries and health status of all consumers on a stream.
func (c *Client) ListConsumers(ctx context.Context, streamName string) ([]models.ConsumerSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	var consumers []models.ConsumerSummary
	consumerChan := js.ConsumersInfo(streamName, nats.Context(ctx))

	for info := range consumerChan {
		if info == nil {
			continue
		}
		consumers = append(consumers, formatConsumerSummary(info))
	}

	return consumers, nil
}

// GetConsumer returns detailed metrics and configuration for a single consumer.
func (c *Client) GetConsumer(ctx context.Context, streamName string, consumerName string) (*models.ConsumerDetail, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	info, err := js.ConsumerInfo(streamName, consumerName, nats.Context(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get consumer %s on stream %s: %w", consumerName, streamName, err)
	}

	detail := &models.ConsumerDetail{
		ConsumerSummary: formatConsumerSummary(info),
		ReplayPolicy:    ReplayPolicyString(info.Config.ReplayPolicy),
		MaxAckPending:   info.Config.MaxAckPending,
		MaxWaiting:      info.Config.MaxWaiting,
	}

	if info.Delivered.Last != nil && !info.Delivered.Last.IsZero() {
		detail.LastDeliveryTime = info.Delivered.Last
	}
	if info.AckFloor.Last != nil && !info.AckFloor.Last.IsZero() {
		detail.LastAckTime = info.AckFloor.Last
	}

	return detail, nil
}

// CreateConsumer registers a new consumer on a stream.
func (c *Client) CreateConsumer(ctx context.Context, req models.CreateConsumerRequest) (*models.ConsumerDetail, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	if req.StreamName == "" || req.Name == "" {
		return nil, fmt.Errorf("stream name and consumer name are required")
	}

	cfg := &nats.ConsumerConfig{
		Durable:       req.Name,
		Description:   req.Description,
		FilterSubject: req.FilterSubject,
		MaxDeliver:    req.MaxDeliver,
		MaxAckPending: req.MaxAckPending,
	}

	if req.DeliverSubject != "" {
		cfg.DeliverSubject = req.DeliverSubject
	}

	if req.AckWaitSeconds > 0 {
		cfg.AckWait = time.Duration(req.AckWaitSeconds) * time.Second
	} else {
		cfg.AckWait = 30 * time.Second
	}

	// Ack policy
	switch strings.ToLower(req.AckPolicy) {
	case "all":
		cfg.AckPolicy = nats.AckAllPolicy
	case "none":
		cfg.AckPolicy = nats.AckNonePolicy
	default:
		cfg.AckPolicy = nats.AckExplicitPolicy
	}

	// Deliver policy
	switch strings.ToLower(req.DeliverPolicy) {
	case "last":
		cfg.DeliverPolicy = nats.DeliverLastPolicy
	case "new":
		cfg.DeliverPolicy = nats.DeliverNewPolicy
	case "all":
		cfg.DeliverPolicy = nats.DeliverAllPolicy
	default:
		cfg.DeliverPolicy = nats.DeliverAllPolicy
	}

	// Replay policy
	switch strings.ToLower(req.ReplayPolicy) {
	case "original":
		cfg.ReplayPolicy = nats.ReplayOriginalPolicy
	default:
		cfg.ReplayPolicy = nats.ReplayInstantPolicy
	}

	info, err := js.AddConsumer(req.StreamName, cfg, nats.Context(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer %s on stream %s: %w", req.Name, req.StreamName, err)
	}

	return c.GetConsumer(ctx, req.StreamName, info.Name)
}

// DeleteConsumer deletes a consumer from a stream.
func (c *Client) DeleteConsumer(ctx context.Context, streamName string, consumerName string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}
	return js.DeleteConsumer(streamName, consumerName, nats.Context(ctx))
}

// PauseConsumer temporarily pauses consumer message delivery.
func (c *Client) PauseConsumer(ctx context.Context, streamName string, consumerName string, pauseUntil time.Time) error {
	js, err := c.JS()
	if err != nil {
		return err
	}

	info, err := js.ConsumerInfo(streamName, consumerName, nats.Context(ctx))
	if err != nil {
		return err
	}

	cfg := info.Config
	if cfg.Metadata == nil {
		cfg.Metadata = make(map[string]string)
	}
	cfg.Metadata["_natslens_paused"] = "true"
	cfg.Metadata["_natslens_pause_until"] = pauseUntil.Format(time.RFC3339)
	_, err = js.UpdateConsumer(streamName, &cfg, nats.Context(ctx))
	return err
}

// ResumeConsumer resumes paused consumer message delivery.
func (c *Client) ResumeConsumer(ctx context.Context, streamName string, consumerName string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}

	info, err := js.ConsumerInfo(streamName, consumerName, nats.Context(ctx))
	if err != nil {
		return err
	}

	cfg := info.Config
	if cfg.Metadata != nil {
		delete(cfg.Metadata, "_natslens_paused")
		delete(cfg.Metadata, "_natslens_pause_until")
	}
	_, err = js.UpdateConsumer(streamName, &cfg, nats.Context(ctx))
	return err
}

func formatConsumerSummary(info *nats.ConsumerInfo) models.ConsumerSummary {
	var redeliveryRatio float64
	totalInFlight := info.NumAckPending + info.NumRedelivered
	if totalInFlight > 0 {
		redeliveryRatio = float64(info.NumRedelivered) / float64(totalInFlight)
	}

	// Calculate health status
	status := "healthy"
	if info.NumRedelivered > 20 || (info.NumAckPending > 50 && redeliveryRatio > 0.4) {
		status = "critical"
	} else if info.NumRedelivered > 3 || info.NumPending > 500 || info.NumAckPending > 20 {
		status = "warning"
	}

	isPaused := false
	if info.Config.Metadata != nil && info.Config.Metadata["_natslens_paused"] == "true" {
		isPaused = true
	}

	return models.ConsumerSummary{
		StreamName:      info.Stream,
		Name:            info.Name,
		Description:     info.Config.Description,
		Created:         info.Created,
		DeliverPolicy:   DeliverPolicyString(info.Config.DeliverPolicy),
		AckPolicy:       AckPolicyString(info.Config.AckPolicy),
		AckWaitSeconds:  int64(info.Config.AckWait.Seconds()),
		MaxDeliver:      info.Config.MaxDeliver,
		FilterSubject:   info.Config.FilterSubject,
		DeliverSubject:  info.Config.DeliverSubject,
		NumPending:      info.NumPending,
		NumAckPending:   info.NumAckPending,
		NumRedelivered:  info.NumRedelivered,
		NumWaiting:      info.NumWaiting,
		HealthStatus:    status,
		RedeliveryRatio: redeliveryRatio,
		IsPull:          info.Config.DeliverSubject == "",
		Paused:          isPaused,
		DeliveredSeq:    info.Delivered.Consumer,
		AckFloorSeq:     info.AckFloor.Consumer,
	}
}
