package natsclient

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// PublishMessage sends a message with optional custom headers and deduplication ID.
func (c *Client) PublishMessage(ctx context.Context, req models.PublishMessageRequest) (*models.PublishMessageResponse, error) {
	if req.Subject == "" {
		return nil, fmt.Errorf("subject is required")
	}

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

	if req.MsgID != "" {
		msg.Header.Set(nats.MsgIdHdr, req.MsgID)
	}
	if req.ExpectedStream != "" {
		msg.Header.Set(nats.ExpectedStreamHdr, req.ExpectedStream)
	}
	if req.ExpectedLastSeq > 0 {
		msg.Header.Set(nats.ExpectedLastSeqHdr, fmt.Sprintf("%d", req.ExpectedLastSeq))
	}
	if req.ExpectedLastMsgID != "" {
		msg.Header.Set(nats.ExpectedLastMsgIdHdr, req.ExpectedLastMsgID)
	}

	js, jsErr := c.JS()
	if jsErr == nil && js != nil {
		// Attempt publishing via JetStream context for Ack and sequence tracking
		ack, err := js.PublishMsg(msg, nats.Context(ctx))
		if err == nil && ack != nil {
			return &models.PublishMessageResponse{
				Stream:    ack.Stream,
				Sequence:  ack.Sequence,
				Duplicate: ack.Duplicate,
				Timestamp: time.Now().Format(time.RFC3339),
			}, nil
		}
	}

	// Fallback to Core NATS publish if not a JetStream stream or JetStream publish failed
	nc, err := c.Conn()
	if err != nil {
		return nil, err
	}

	if err := nc.PublishMsg(msg); err != nil {
		return nil, fmt.Errorf("failed to publish to subject %s: %w", req.Subject, err)
	}

	return &models.PublishMessageResponse{
		Stream:    "core-nats",
		Sequence:  0,
		Duplicate: false,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// BrowseStreamMessages reads a window of messages from a stream.
func (c *Client) BrowseStreamMessages(ctx context.Context, stream string, startSeq uint64, count int, subjectFilter string) ([]models.StreamMessage, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	info, err := js.StreamInfo(stream, nats.Context(ctx))
	if err != nil {
		return nil, err
	}

	if info.State.Msgs == 0 {
		return []models.StreamMessage{}, nil
	}

	firstSeq := info.State.FirstSeq
	lastSeq := info.State.LastSeq

	if startSeq < firstSeq {
		startSeq = firstSeq
	}
	if count <= 0 {
		count = 50
	}
	if count > 200 {
		count = 200
	}

	var messages []models.StreamMessage
	currentSeq := startSeq

	for currentSeq <= lastSeq && len(messages) < count {
		rawMsg, err := js.GetMsg(stream, currentSeq, nats.Context(ctx))
		if err == nil && rawMsg != nil {
			if subjectFilter == "" || subjectMatches(subjectFilter, rawMsg.Subject) {
				msg := models.StreamMessage{
					Sequence:  rawMsg.Sequence,
					Subject:   rawMsg.Subject,
					Timestamp: rawMsg.Time,
					Headers:   rawMsg.Header,
				}

				if utf8.Valid(rawMsg.Data) {
					msg.Payload = string(rawMsg.Data)
					var jsTest interface{}
					if json.Unmarshal(rawMsg.Data, &jsTest) == nil {
						msg.PayloadType = "json"
					} else {
						msg.PayloadType = "text"
					}
				} else {
					msg.Payload = fmt.Sprintf("[%d bytes binary data]", len(rawMsg.Data))
					msg.PayloadType = "binary"
				}

				messages = append(messages, msg)
			}
		}
		currentSeq++
	}

	return messages, nil
}

// ReplayManager orchestrates background stream message replay operations.
type ReplayManager struct {
	mu       sync.RWMutex
	client   *Client
	replays  map[string]*ActiveReplay
}

// ActiveReplay tracks a running replay job.
type ActiveReplay struct {
	mu       sync.Mutex
	Progress models.ReplayProgress
	cancel   context.CancelFunc
}

// NewReplayManager creates a new ReplayManager.
func NewReplayManager(client *Client) *ReplayManager {
	return &ReplayManager{
		client:  client,
		replays: make(map[string]*ActiveReplay),
	}
}

// StartReplay begins replaying messages asynchronously.
func (rm *ReplayManager) StartReplay(req models.ReplayRequest) (*models.ReplayProgress, error) {
	js, err := rm.client.JS()
	if err != nil {
		return nil, err
	}

	info, err := js.StreamInfo(req.SourceStream)
	if err != nil {
		return nil, fmt.Errorf("source stream %s not found: %w", req.SourceStream, err)
	}

	startSeq := req.StartSequence
	if startSeq < info.State.FirstSeq {
		startSeq = info.State.FirstSeq
	}

	lastSeq := info.State.LastSeq
	var totalMsgs uint64
	if lastSeq >= startSeq {
		totalMsgs = lastSeq - startSeq + 1
	}

	replayID := fmt.Sprintf("rep-%d", time.Now().UnixNano())
	ctx, cancel := context.WithCancel(context.Background())

	active := &ActiveReplay{
		cancel: cancel,
		Progress: models.ReplayProgress{
			ReplayID:        replayID,
			Status:          "running",
			TotalMessages:   totalMsgs,
			ReplayedCount:   0,
			CurrentSequence: startSeq,
			Percentage:      0,
		},
	}

	rm.mu.Lock()
	rm.replays[replayID] = active
	rm.mu.Unlock()

	go rm.runReplayLoop(ctx, active, req, startSeq, lastSeq)

	return &active.Progress, nil
}

func (rm *ReplayManager) runReplayLoop(ctx context.Context, active *ActiveReplay, req models.ReplayRequest, startSeq, lastSeq uint64) {
	js, err := rm.client.JS()
	if err != nil {
		active.mu.Lock()
		active.Progress.Status = "failed"
		active.Progress.Error = err.Error()
		active.mu.Unlock()
		return
	}

	nc, err := rm.client.Conn()
	if err != nil {
		active.mu.Lock()
		active.Progress.Status = "failed"
		active.Progress.Error = err.Error()
		active.mu.Unlock()
		return
	}

	targetSubj := req.TargetSubject
	currSeq := startSeq
	var replayed uint64

	for currSeq <= lastSeq {
		select {
		case <-ctx.Done():
			active.mu.Lock()
			active.Progress.Status = "cancelled"
			active.mu.Unlock()
			return
		default:
		}

		rawMsg, err := js.GetMsg(req.SourceStream, currSeq)
		if err == nil && rawMsg != nil {
			if req.FilterSubject == "" || subjectMatches(req.FilterSubject, rawMsg.Subject) {
				destSubj := targetSubj
				if destSubj == "" {
					destSubj = rawMsg.Subject
				}

				newMsg := nats.NewMsg(destSubj)
				newMsg.Data = rawMsg.Data
				newMsg.Header = rawMsg.Header

				_ = nc.PublishMsg(newMsg)
				replayed++
			}
		}

		currSeq++

		// Update progress
		active.mu.Lock()
		active.Progress.ReplayedCount = replayed
		active.Progress.CurrentSequence = currSeq
		if active.Progress.TotalMessages > 0 {
			active.Progress.Percentage = (float64(currSeq-startSeq) / float64(active.Progress.TotalMessages)) * 100.0
			if active.Progress.Percentage > 100.0 {
				active.Progress.Percentage = 100.0
			}
		}
		active.mu.Unlock()

		// Speed pacing
		if req.Speed > 0 {
			sleepMs := int(50.0 / req.Speed)
			if sleepMs > 0 {
				time.Sleep(time.Duration(sleepMs) * time.Millisecond)
			}
		}
	}

	active.mu.Lock()
	active.Progress.Status = "completed"
	active.Progress.Percentage = 100.0
	active.mu.Unlock()
}

// GetReplayProgress returns current progress of a replay job.
func (rm *ReplayManager) GetReplayProgress(replayID string) (*models.ReplayProgress, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	active, exists := rm.replays[replayID]
	if !exists {
		return nil, fmt.Errorf("replay %s not found", replayID)
	}

	active.mu.Lock()
	defer active.mu.Unlock()
	progCopy := active.Progress
	return &progCopy, nil
}

// StopReplay cancels a running replay job.
func (rm *ReplayManager) StopReplay(replayID string) error {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	active, exists := rm.replays[replayID]
	if !exists {
		return fmt.Errorf("replay %s not found", replayID)
	}

	active.cancel()
	return nil
}

func subjectMatches(filter, subject string) bool {
	if filter == "" || filter == ">" || filter == subject {
		return true
	}
	fParts := strings.Split(filter, ".")
	sParts := strings.Split(subject, ".")
	for i, fp := range fParts {
		if fp == ">" {
			return true
		}
		if i >= len(sParts) {
			return false
		}
		if fp != "*" && fp != sParts[i] {
			return false
		}
	}
	return len(fParts) == len(sParts)
}
