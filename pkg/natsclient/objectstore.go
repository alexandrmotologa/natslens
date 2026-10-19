package natsclient

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// ListObjectStoreBuckets returns all ObjectStore buckets.
func (c *Client) ListObjectStoreBuckets(ctx context.Context) ([]models.ObjectStoreBucketSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	var buckets []models.ObjectStoreBucketSummary
	nameChan := js.ObjectStoreNames()

	for name := range nameChan {
		if name == "" {
			continue
		}
		summary, err := c.GetObjectStoreBucket(ctx, name)
		if err == nil && summary != nil {
			buckets = append(buckets, *summary)
		}
	}

	return buckets, nil
}

// GetObjectStoreBucket returns status and statistics for an ObjectStore bucket.
func (c *Client) GetObjectStoreBucket(ctx context.Context, bucket string) (*models.ObjectStoreBucketSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	obs, err := js.ObjectStore(bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to bind to ObjectStore %s: %w", bucket, err)
	}

	status, err := obs.Status()
	if err != nil {
		return nil, fmt.Errorf("failed to get status for ObjectStore %s: %w", bucket, err)
	}

	return &models.ObjectStoreBucketSummary{
		Bucket:        status.Bucket(),
		Description:   status.Description(),
		ObjectsCount:  0, // Will be populated when listing objects
		TotalBytes:    status.Size(),
		Storage:       StorageTypeString(status.Storage()),
		Replicas:      status.Replicas(),
		TTLSeconds:    int64(status.TTL().Seconds()),
		BackingStream: status.BackingStore(),
	}, nil
}

// CreateObjectStoreBucket creates a new JetStream ObjectStore.
func (c *Client) CreateObjectStoreBucket(ctx context.Context, bucket string, desc string, storage string, replicas int, ttlSeconds int64) (*models.ObjectStoreBucketSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	cfg := &nats.ObjectStoreConfig{
		Bucket:      bucket,
		Description: desc,
		Replicas:    replicas,
	}

	if ttlSeconds > 0 {
		cfg.TTL = time.Duration(ttlSeconds) * time.Second
	}
	if strings.ToLower(storage) == "memory" {
		cfg.Storage = nats.MemoryStorage
	} else {
		cfg.Storage = nats.FileStorage
	}

	_, err = js.CreateObjectStore(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create ObjectStore %s: %w", bucket, err)
	}

	return c.GetObjectStoreBucket(ctx, bucket)
}

// DeleteObjectStoreBucket deletes an ObjectStore bucket.
func (c *Client) DeleteObjectStoreBucket(ctx context.Context, bucket string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}
	return js.DeleteObjectStore(bucket)
}

// ListObjects returns metadata of all objects in an ObjectStore bucket.
func (c *Client) ListObjects(ctx context.Context, bucket string) ([]models.ObjectSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	obs, err := js.ObjectStore(bucket)
	if err != nil {
		return nil, err
	}

	list, err := obs.List(nats.Context(ctx))
	if err != nil {
		return nil, err
	}

	var results []models.ObjectSummary
	for _, obj := range list {
		if obj == nil {
			continue
		}
		results = append(results, models.ObjectSummary{
			Bucket:      bucket,
			Name:        obj.Name,
			Description: obj.Description,
			Size:        obj.Size,
			ModTime:     obj.ModTime,
			Chunks:      obj.Chunks,
			Digest:      obj.Digest,
			Deleted:     obj.Deleted,
		})
	}

	return results, nil
}

// PutObject stores a byte slice as a named object.
func (c *Client) PutObject(ctx context.Context, bucket string, name string, desc string, data []byte) (*models.ObjectSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, err
	}

	obs, err := js.ObjectStore(bucket)
	if err != nil {
		return nil, err
	}

	meta := &nats.ObjectMeta{
		Name:        name,
		Description: desc,
	}

	info, err := obs.Put(meta, bytes.NewReader(data), nats.Context(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to put object %s in bucket %s: %w", name, bucket, err)
	}

	return &models.ObjectSummary{
		Bucket:      bucket,
		Name:        info.Name,
		Description: info.Description,
		Size:        info.Size,
		ModTime:     info.ModTime,
		Chunks:      info.Chunks,
		Digest:      info.Digest,
		Deleted:     info.Deleted,
	}, nil
}

// GetObject retrieves raw bytes of an object.
func (c *Client) GetObject(ctx context.Context, bucket string, name string) ([]byte, *models.ObjectSummary, error) {
	js, err := c.JS()
	if err != nil {
		return nil, nil, err
	}

	obs, err := js.ObjectStore(bucket)
	if err != nil {
		return nil, nil, err
	}

	res, err := obs.Get(name, nats.Context(ctx))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get object %s from bucket %s: %w", name, bucket, err)
	}
	defer res.Close()

	data, err := io.ReadAll(res)
	if err != nil {
		return nil, nil, err
	}

	info, err := res.Info()
	if err != nil {
		return data, nil, nil
	}

	summary := &models.ObjectSummary{
		Bucket:      bucket,
		Name:        info.Name,
		Description: info.Description,
		Size:        info.Size,
		ModTime:     info.ModTime,
		Chunks:      info.Chunks,
		Digest:      info.Digest,
		Deleted:     info.Deleted,
	}

	return data, summary, nil
}

// DeleteObject marks or deletes an object in the ObjectStore.
func (c *Client) DeleteObject(ctx context.Context, bucket string, name string) error {
	js, err := c.JS()
	if err != nil {
		return err
	}

	obs, err := js.ObjectStore(bucket)
	if err != nil {
		return err
	}

	return obs.Delete(name)
}
