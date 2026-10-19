package natsclient

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
)

// ExportKVBucket exports all entries of a Key-Value bucket.
func (c *NATSClient) ExportKVBucket(ctx context.Context, bucket string) (*models.KVExportData, error) {
	entries, err := c.ListKeys(ctx, bucket, "")
	if err != nil {
		return nil, fmt.Errorf("failed to list keys in bucket %s: %w", bucket, err)
	}

	data := &models.KVExportData{
		Bucket:     bucket,
		ExportedAt: time.Now().UTC(),
		Entries:    make([]models.KVExportEntry, 0, len(entries)),
	}

	for _, entry := range entries {
		data.Entries = append(data.Entries, models.KVExportEntry{
			Key:      entry.Key,
			Value:    base64.StdEncoding.EncodeToString([]byte(entry.Value)),
			Revision: entry.Revision,
			Created:  entry.Created,
		})
	}

	return data, nil
}

// ImportKVBucket restores entries from an export into a Key-Value bucket.
func (c *NATSClient) ImportKVBucket(ctx context.Context, bucket string, data models.KVExportData) (int, error) {
	// Ensure bucket exists or create it
	_, err := c.GetKVBucket(ctx, bucket)
	if err != nil {
		_, err = c.CreateKVBucket(ctx, models.CreateKVBucketRequest{
			Bucket:      bucket,
			Description: fmt.Sprintf("Imported from backup on %s", time.Now().Format(time.RFC3339)),
			History:     5,
		})
		if err != nil {
			return 0, fmt.Errorf("failed to create target bucket %s: %w", bucket, err)
		}
	}

	imported := 0
	for _, entry := range data.Entries {
		decodedVal, err := base64.StdEncoding.DecodeString(entry.Value)
		valToPut := string(decodedVal)
		if err != nil {
			valToPut = entry.Value // Fallback to raw string if not base64
		}

		if _, err := c.PutEntry(ctx, bucket, entry.Key, valToPut); err == nil {
			imported++
		}
	}

	return imported, nil
}

// ExportStreamSlice exports a slice of messages from a JetStream stream.
func (c *NATSClient) ExportStreamSlice(ctx context.Context, stream string, startSeq uint64, count int) (*models.StreamExportData, error) {
	if count <= 0 {
		count = 100
	}
	if count > 1000 {
		count = 1000
	}

	msgs, err := c.BrowseStreamMessages(ctx, stream, startSeq, count, "")
	if err != nil {
		return nil, fmt.Errorf("failed to browse stream %s: %w", stream, err)
	}

	var firstSeq, lastSeq uint64
	if len(msgs) > 0 {
		firstSeq = msgs[0].Sequence
		lastSeq = msgs[len(msgs)-1].Sequence
	}

	return &models.StreamExportData{
		Stream:     stream,
		ExportedAt: time.Now().UTC(),
		FirstSeq:   firstSeq,
		LastSeq:    lastSeq,
		Count:      len(msgs),
		Messages:   msgs,
	}, nil
}
