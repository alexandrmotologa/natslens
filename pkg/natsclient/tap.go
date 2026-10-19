package natsclient

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

var tapCounter uint64

// TapSubject starts listening on a subject with wildcard support and yields incoming messages.
func (c *Client) TapSubject(ctx context.Context, subject string) (<-chan models.TapMessage, error) {
	nc, err := c.Conn()
	if err != nil {
		return nil, err
	}

	if subject == "" {
		subject = ">"
	}

	ch := make(chan models.TapMessage, 500)
	sub, err := nc.Subscribe(subject, func(m *nats.Msg) {
		id := atomic.AddUint64(&tapCounter, 1)
		msg := models.TapMessage{
			ID:        fmt.Sprintf("tap-%d", id),
			Subject:   m.Subject,
			Reply:     m.Reply,
			Payload:   string(m.Data),
			Headers:   m.Header,
			Timestamp: time.Now(),
			Size:      len(m.Data),
		}

		select {
		case ch <- msg:
		default:
			// Drop if channel is full to prevent backpressure on NATS
		}
	})

	if err != nil {
		close(ch)
		return nil, fmt.Errorf("failed to tap subject %s: %w", subject, err)
	}

	go func() {
		<-ctx.Done()
		_ = sub.Unsubscribe()
		close(ch)
	}()

	return ch, nil
}

// RequestReply sends a synchronous request to a subject and returns the reply and round-trip latency.
func (c *Client) RequestReply(ctx context.Context, req models.RequestReplyRequest) (*models.RequestReplyResponse, error) {
	nc, err := c.Conn()
	if err != nil {
		return nil, err
	}

	timeout := 3 * time.Second
	if req.TimeoutMs > 0 {
		timeout = time.Duration(req.TimeoutMs) * time.Millisecond
	}
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	msg := nats.NewMsg(req.Subject)
	msg.Data = []byte(req.Payload)
	if msg.Header == nil {
		msg.Header = make(nats.Header)
	}
	for k, vals := range req.Headers {
		for _, v := range vals {
			msg.Header.Add(k, v)
		}
	}

	start := time.Now()
	replyMsg, err := nc.RequestMsgWithContext(reqCtx, msg)
	dur := time.Since(start)
	latency := float64(dur.Nanoseconds()) / 1e6 // in ms with sub-millisecond precision
	if latency <= 0 {
		latency = 0.01
	}

	if err != nil {
		return &models.RequestReplyResponse{
			Subject:   req.Subject,
			LatencyMs: latency,
			Error:     err.Error(),
		}, nil
	}

	return &models.RequestReplyResponse{
		Subject:   replyMsg.Subject,
		Payload:   string(replyMsg.Data),
		Headers:   replyMsg.Header,
		LatencyMs: latency,
	}, nil
}
