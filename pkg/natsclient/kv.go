package natsclient

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// ListKVBuckets returns all available Key-Value stores.
func (c *Client) ListKVBuckets(ctx context.Context) ([]models.KVBucketSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	var buckets []models.KVBucketSummary
	nameChan := js.KeyValueStoreNames()

	for name := range nameChan {
		if name == "" {
			continue
		}
		summary, err := c.GetKVBucket(ctx, name)
		if err == nil && summary != nil {
			buckets = append(buckets, *summary)
		}
	}

	return buckets, nil
}

// GetKVBucket returns metadata for a single KV store.
func (c *Client) GetKVBucket(ctx context.Context, bucket string) (*models.KVBucketSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to KV bucket %s: %w", bucket, err)
	}

	status, err := kv.Status()
	if err != nil {
		return nil, fmt.Errorf("failed to get status for KV bucket %s: %w", bucket, err)
	}

	cfg := status.Config()
	return &models.KVBucketSummary{
		Bucket:        status.Bucket(),
		Description:   cfg.Description,
		ValuesCount:   status.Values(),
		History:       int(status.History()),
		TTLSeconds:    int64(status.TTL().Seconds()),
		Storage:       StorageTypeString(cfg.Storage),
		BytesSize:     status.Bytes(),
		Replicas:      cfg.Replicas,
		BackingStream: status.BackingStore(),
	}, nil
}

// CreateKVBucket creates a new Key-Value bucket.
func (c *Client) CreateKVBucket(ctx context.Context, req models.CreateKVBucketRequest) (*models.KVBucketSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	if req.Bucket == "" {
		return nil, fmt.Errorf("bucket name is required")
	}

	cfg := &nats.KeyValueConfig{
		Bucket:      req.Bucket,
		Description: req.Description,
		History:     uint8(req.History),
		Replicas:    req.Replicas,
		MaxBytes:    req.MaxBytes,
	}

	if req.TTLSeconds > 0 {
		cfg.TTL = time.Duration(req.TTLSeconds) * time.Second
	}
	if cfg.History == 0 {
		cfg.History = 10
	}

	if strings.ToLower(req.Storage) == "memory" {
		cfg.Storage = nats.MemoryStorage
	} else {
		cfg.Storage = nats.FileStorage
	}

	_, err = js.CreateKeyValue(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create KV bucket %s: %w", req.Bucket, err)
	}

	return c.GetKVBucket(ctx, req.Bucket)
}

// DeleteKVBucket drops a Key-Value bucket and its backing stream.
func (c *Client) DeleteKVBucket(ctx context.Context, bucket string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}
	return js.DeleteKeyValue(bucket)
}

// ListKeys returns keys within a KV bucket, optionally filtered by prefix.
func (c *Client) ListKeys(ctx context.Context, bucket string, prefix string) ([]models.KVEntry, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return nil, err
	}

	keys, err := kv.Keys()
	if err != nil && err != nats.ErrNoKeysFound {
		return nil, err
	}

	var entries []models.KVEntry
	for _, k := range keys {
		if prefix != "" && !strings.HasPrefix(k, prefix) {
			continue
		}
		entry, err := kv.Get(k)
		if err == nil && entry != nil {
			entries = append(entries, models.KVEntry{
				Bucket:    bucket,
				Key:       entry.Key(),
				Value:     string(entry.Value()),
				Revision:  entry.Revision(),
				Created:   entry.Created(),
				Delta:     entry.Delta(),
				Operation: entry.Operation().String(),
			})
		}
	}

	return entries, nil
}

// GetEntry returns the latest value and revision of a single key.
func (c *Client) GetEntry(ctx context.Context, bucket string, key string) (*models.KVEntry, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return nil, err
	}

	entry, err := kv.Get(key)
	if err != nil {
		return nil, fmt.Errorf("key %s not found in bucket %s: %w", key, bucket, err)
	}

	return &models.KVEntry{
		Bucket:    bucket,
		Key:       entry.Key(),
		Value:     string(entry.Value()),
		Revision:  entry.Revision(),
		Created:   entry.Created(),
		Delta:     entry.Delta(),
		Operation: entry.Operation().String(),
	}, nil
}

// GetRevisionHistory returns historical revisions of a specific key.
func (c *Client) GetRevisionHistory(ctx context.Context, bucket string, key string) ([]models.KVEntry, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return nil, err
	}

	history, err := kv.History(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for key %s in bucket %s: %w", key, bucket, err)
	}

	var entries []models.KVEntry
	for _, entry := range history {
		isDel := entry.Operation() == nats.KeyValueDelete || entry.Operation() == nats.KeyValuePurge
		entries = append(entries, models.KVEntry{
			Bucket:    bucket,
			Key:       entry.Key(),
			Value:     string(entry.Value()),
			Revision:  entry.Revision(),
			Created:   entry.Created(),
			Delta:     entry.Delta(),
			IsDeleted: isDel,
			Operation: entry.Operation().String(),
		})
	}

	return entries, nil
}

// PutEntry updates or inserts a value for a key in a bucket.
func (c *Client) PutEntry(ctx context.Context, bucket string, key string, value string) (uint64, error) {
	js, err := c.JS()
	if err != nil {
		return 0, err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return 0, err
	}

	rev, err := kv.PutString(key, value)
	if err != nil {
		return 0, fmt.Errorf("failed to put key %s in bucket %s: %w", key, bucket, err)
	}

	return rev, nil
}

// DeleteKey creates a deletion tombstone for a key.
func (c *Client) DeleteKey(ctx context.Context, bucket string, key string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return err
	}

	return kv.Delete(key)
}

// PurgeKey deletes all historical revisions for a key.
func (c *Client) PurgeKey(ctx context.Context, bucket string, key string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return err
	}

	return kv.Purge(key)
}

// WatchBucket streams live mutations for a bucket to a channel.
func (c *Client) WatchBucket(ctx context.Context, bucket string) (<-chan models.KVEntry, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	kv, err := js.KeyValue(bucket)
	if err != nil {
		return nil, err
	}

	watcher, err := kv.WatchAll()
	if err != nil {
		return nil, fmt.Errorf("failed to watch bucket %s: %w", bucket, err)
	}

	ch := make(chan models.KVEntry, 100)
	go func() {
		defer close(ch)
		defer watcher.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case entry := <-watcher.Updates():
				if entry == nil {
					continue
				}
				isDel := entry.Operation() == nats.KeyValueDelete || entry.Operation() == nats.KeyValuePurge
				ch <- models.KVEntry{
					Bucket:    bucket,
					Key:       entry.Key(),
					Value:     string(entry.Value()),
					Revision:  entry.Revision(),
					Created:   entry.Created(),
					Delta:     entry.Delta(),
					IsDeleted: isDel,
					Operation: entry.Operation().String(),
				}
			}
		}
	}()

	return ch, nil
}
