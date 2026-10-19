package natsclient

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// FormatPrometheusMetrics generates standard Prometheus text format metrics for NATS & JetStream.
func FormatPrometheusMetrics(client *NATSClient) string {
	var sb strings.Builder

	ctx := context.Background()
	stats, _ := client.GetClusterStats()
	streams, _ := client.ListStreams(ctx)
	consumers, _ := client.ListAllConsumers(ctx)

	sb.WriteString("# HELP natslens_scrape_timestamp_seconds Time of this metrics collection.\n")
	sb.WriteString("# TYPE natslens_scrape_timestamp_seconds gauge\n")
	sb.WriteString(fmt.Sprintf("natslens_scrape_timestamp_seconds %d\n\n", time.Now().Unix()))

	if stats != nil {
		sb.WriteString("# HELP natslens_cluster_connections Number of client connections.\n")
		sb.WriteString("# TYPE natslens_cluster_connections gauge\n")
		sb.WriteString(fmt.Sprintf("natslens_cluster_connections %d\n\n", stats.Connections))

		sb.WriteString("# HELP natslens_cluster_in_msgs_total Total ingress messages.\n")
		sb.WriteString("# TYPE natslens_cluster_in_msgs_total counter\n")
		sb.WriteString(fmt.Sprintf("natslens_cluster_in_msgs_total %d\n\n", stats.InMsgs))

		sb.WriteString("# HELP natslens_cluster_out_msgs_total Total egress messages.\n")
		sb.WriteString("# TYPE natslens_cluster_out_msgs_total counter\n")
		sb.WriteString(fmt.Sprintf("natslens_cluster_out_msgs_total %d\n\n", stats.OutMsgs))

		sb.WriteString("# HELP natslens_cluster_in_bytes_total Total ingress bytes.\n")
		sb.WriteString("# TYPE natslens_cluster_in_bytes_total counter\n")
		sb.WriteString(fmt.Sprintf("natslens_cluster_in_bytes_total %d\n\n", stats.InBytes))

		sb.WriteString("# HELP natslens_cluster_out_bytes_total Total egress bytes.\n")
		sb.WriteString("# TYPE natslens_cluster_out_bytes_total counter\n")
		sb.WriteString(fmt.Sprintf("natslens_cluster_out_bytes_total %d\n\n", stats.OutBytes))

		sb.WriteString("# HELP natslens_jetstream_memory_used_bytes In-memory storage consumed by JetStream.\n")
		sb.WriteString("# TYPE natslens_jetstream_memory_used_bytes gauge\n")
		sb.WriteString(fmt.Sprintf("natslens_jetstream_memory_used_bytes %d\n\n", stats.JetStream.MemoryUsed))

		sb.WriteString("# HELP natslens_jetstream_disk_used_bytes Disk storage consumed by JetStream.\n")
		sb.WriteString("# TYPE natslens_jetstream_disk_used_bytes gauge\n")
		sb.WriteString(fmt.Sprintf("natslens_jetstream_disk_used_bytes %d\n\n", stats.JetStream.DiskUsed))
	}

	if len(streams) > 0 {
		sb.WriteString("# HELP natslens_stream_messages_count Total stored messages in stream.\n")
		sb.WriteString("# TYPE natslens_stream_messages_count gauge\n")
		for _, s := range streams {
			sb.WriteString(fmt.Sprintf("natslens_stream_messages_count{stream=%q,storage=%q} %d\n", s.Name, s.Storage, s.MessagesCount))
		}
		sb.WriteString("\n")

		sb.WriteString("# HELP natslens_stream_bytes Total stored bytes in stream.\n")
		sb.WriteString("# TYPE natslens_stream_bytes gauge\n")
		for _, s := range streams {
			sb.WriteString(fmt.Sprintf("natslens_stream_bytes{stream=%q} %d\n", s.Name, s.BytesCount))
		}
		sb.WriteString("\n")
	}

	if len(consumers) > 0 {
		sb.WriteString("# HELP natslens_consumer_lag Unconsumed message backlog for consumer.\n")
		sb.WriteString("# TYPE natslens_consumer_lag gauge\n")
		for _, c := range consumers {
			sb.WriteString(fmt.Sprintf("natslens_consumer_lag{stream=%q,consumer=%q} %d\n", c.StreamName, c.Name, c.NumPending))
		}
		sb.WriteString("\n")

		sb.WriteString("# HELP natslens_consumer_ack_pending Messages currently delivered awaiting acknowledgment.\n")
		sb.WriteString("# TYPE natslens_consumer_ack_pending gauge\n")
		for _, c := range consumers {
			sb.WriteString(fmt.Sprintf("natslens_consumer_ack_pending{stream=%q,consumer=%q} %d\n", c.StreamName, c.Name, c.NumAckPending))
		}
		sb.WriteString("\n")

		sb.WriteString("# HELP natslens_consumer_redeliveries Total redelivered messages.\n")
		sb.WriteString("# TYPE natslens_consumer_redeliveries counter\n")
		for _, c := range consumers {
			sb.WriteString(fmt.Sprintf("natslens_consumer_redeliveries{stream=%q,consumer=%q} %d\n", c.StreamName, c.Name, c.NumRedelivered))
		}
		sb.WriteString("\n")

		sb.WriteString("# HELP natslens_consumer_health Consumer operational status (1 if matching status, 0 otherwise).\n")
		sb.WriteString("# TYPE natslens_consumer_health gauge\n")
		for _, c := range consumers {
			sb.WriteString(fmt.Sprintf("natslens_consumer_health{stream=%q,consumer=%q,status=%q} 1\n", c.StreamName, c.Name, c.HealthStatus))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}
