package natsclient

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// ListStreams returns summaries of all JetStream streams.
func (c *Client) ListStreams(ctx context.Context) ([]models.StreamSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	var summaries []models.StreamSummary
	streamChan := js.StreamsInfo(nats.Context(ctx))

	for streamInfo := range streamChan {
		if streamInfo == nil {
			continue
		}
		// Filter out internal KV and ObjectStore backing streams from general stream view if needed,
		// but keep them identifiable.
		summaries = append(summaries, formatStreamSummary(streamInfo))
	}

	return summaries, nil
}

// GetStream returns comprehensive stream details including subject tree.
func (c *Client) GetStream(ctx context.Context, name string) (*models.StreamDetail, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	info, err := js.StreamInfo(name, nats.Context(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get stream %s: %w", name, err)
	}

	detail := &models.StreamDetail{
		StreamSummary:          formatStreamSummary(info),
		MaxConsumers:           info.Config.MaxConsumers,
		MaxMsgs:                info.Config.MaxMsgs,
		MaxBytes:               info.Config.MaxBytes,
		MaxAgeSeconds:          int64(info.Config.MaxAge.Seconds()),
		MaxMsgSize:             info.Config.MaxMsgSize,
		Discard:                DiscardPolicyString(info.Config.Discard),
		DuplicateWindowSeconds: int64(info.Config.Duplicates.Seconds()),
		SubjectCounts:          info.State.Subjects,
	}

	detail.SubjectHierarchy = BuildSubjectHierarchy(info.Config.Subjects, info.State.Subjects)
	return detail, nil
}

// CreateStream adds a new JetStream stream.
func (c *Client) CreateStream(ctx context.Context, req models.CreateStreamRequest) (*models.StreamDetail, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	if req.Name == "" {
		return nil, fmt.Errorf("stream name is required")
	}
	if len(req.Subjects) == 0 {
		req.Subjects = []string{req.Name + ".*"}
	}

	cfg := &nats.StreamConfig{
		Name:         req.Name,
		Description:  req.Description,
		Subjects:     req.Subjects,
		MaxConsumers: req.MaxConsumers,
		MaxMsgs:      req.MaxMsgs,
		MaxBytes:     req.MaxBytes,
		MaxMsgSize:   req.MaxMsgSize,
		Replicas:     req.Replicas,
	}

	if req.MaxAgeSeconds > 0 {
		cfg.MaxAge = time.Duration(req.MaxAgeSeconds) * time.Second
	}
	if req.DuplicateWindowSeconds > 0 {
		cfg.Duplicates = time.Duration(req.DuplicateWindowSeconds) * time.Second
	}

	// Retention policy
	switch strings.ToLower(req.Retention) {
	case "interest":
		cfg.Retention = nats.InterestPolicy
	case "workqueue":
		cfg.Retention = nats.WorkQueuePolicy
	default:
		cfg.Retention = nats.LimitsPolicy
	}

	// Storage backend
	switch strings.ToLower(req.Storage) {
	case "memory":
		cfg.Storage = nats.MemoryStorage
	default:
		cfg.Storage = nats.FileStorage
	}

	// Discard policy
	switch strings.ToLower(req.Discard) {
	case "new":
		cfg.Discard = nats.DiscardNew
	default:
		cfg.Discard = nats.DiscardOld
	}

	info, err := js.AddStream(cfg, nats.Context(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to create stream %s: %w", req.Name, err)
	}

	return c.GetStream(ctx, info.Config.Name)
}

// DeleteStream removes a stream completely.
func (c *Client) DeleteStream(ctx context.Context, name string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}
	return js.DeleteStream(name, nats.Context(ctx))
}

// PurgeStream deletes messages in a stream, optionally filtered by subject.
func (c *Client) PurgeStream(ctx context.Context, name string, subjectFilter string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}

	if subjectFilter != "" {
		return js.PurgeStream(name, &nats.StreamPurgeRequest{Subject: subjectFilter}, nats.Context(ctx))
	}
	return js.PurgeStream(name, nats.Context(ctx))
}

// DeleteMessage deletes a single message from a stream by its sequence number.
func (c *Client) DeleteMessage(ctx context.Context, stream string, seq uint64) error {
	js, err := c.JS()
	if err != nil {
		return err
	}
	return js.DeleteMsg(stream, seq, nats.Context(ctx))
}

// GetMessage fetches a single message by sequence from a stream.
func (c *Client) GetMessage(ctx context.Context, stream string, seq uint64) (*models.StreamMessage, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	rawMsg, err := js.GetMsg(stream, seq, nats.Context(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to get message %d from stream %s: %w", seq, stream, err)
	}

	msg := &models.StreamMessage{
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

	return msg, nil
}

// BuildSubjectHierarchy constructs an expandable tree of subjects.
func BuildSubjectHierarchy(configuredSubjects []string, subjectCounts map[string]uint64) *models.SubjectNode {
	root := &models.SubjectNode{
		Name:     "root",
		FullPath: "",
		Children: []*models.SubjectNode{},
	}

	// Merge all subjects into map
	allSubjects := make(map[string]uint64)
	for _, s := range configuredSubjects {
		allSubjects[s] = 0
	}
	for s, cnt := range subjectCounts {
		allSubjects[s] = cnt
	}

	for subject, count := range allSubjects {
		parts := strings.Split(subject, ".")
		current := root
		fullPath := ""

		for i, part := range parts {
			if fullPath == "" {
				fullPath = part
			} else {
				fullPath = fullPath + "." + part
			}

			var nextChild *models.SubjectNode
			for _, child := range current.Children {
				if child.Name == part {
					nextChild = child
					break
				}
			}

			if nextChild == nil {
				nextChild = &models.SubjectNode{
					Name:     part,
					FullPath: fullPath,
					Children: []*models.SubjectNode{},
				}
				current.Children = append(current.Children, nextChild)
			}

			if i == len(parts)-1 {
				nextChild.MessageCount += count
			}
			current = nextChild
		}
	}

	return root
}

func formatStreamSummary(info *nats.StreamInfo) models.StreamSummary {
	var numSubj int
	if info.State.Subjects != nil {
		numSubj = len(info.State.Subjects)
	}

	return models.StreamSummary{
		Name:          info.Config.Name,
		Description:   info.Config.Description,
		Created:       info.Created,
		Subjects:      info.Config.Subjects,
		Retention:     RetentionPolicyString(info.Config.Retention),
		Storage:       StorageTypeString(info.Config.Storage),
		MessagesCount: info.State.Msgs,
		BytesCount:    info.State.Bytes,
		FirstSeq:      info.State.FirstSeq,
		LastSeq:       info.State.LastSeq,
		ConsumerCount: info.State.Consumers,
		Replicas:      info.Config.Replicas,
		DeletedCount:  info.State.NumDeleted,
		NumSubjects:   numSubj,
	}
}
