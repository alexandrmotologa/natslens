package natsclient

import (
	"context"
	"fmt"

	"github.com/alexandrmotologa/natslens/pkg/models"
)

// BuildTopologyData constructs the complete data flow graph for the active cluster.
func (c *NATSClient) BuildTopologyData(ctx context.Context) (models.TopologyData, error) {
	streams, err := c.ListStreams(ctx)
	if err != nil {
		return models.TopologyData{}, fmt.Errorf("failed to list streams: %w", err)
	}

	consumers, _ := c.ListAllConsumers(ctx)

	var nodes []models.TopologyNode
	var edges []models.TopologyEdge

	// 1. Root Ingress Publisher Node
	nodes = append(nodes, models.TopologyNode{
		ID:      "node-publishers",
		Label:   "Publishers",
		Type:    "ingress",
		Subtext: "Microservices & Producers",
		Status:  "normal",
		Rate:    "active",
	})

	for _, s := range streams {
		streamNodeID := fmt.Sprintf("stream-%s", s.Name)

		// Stream Node
		nodes = append(nodes, models.TopologyNode{
			ID:      streamNodeID,
			Label:   s.Name,
			Type:    "stream",
			Subtext: fmt.Sprintf("%s | %d msgs", s.Storage, s.MessagesCount),
			Status:  "normal",
		})

		// Subject Nodes & Edges
		for _, subj := range s.Subjects {
			subjNodeID := fmt.Sprintf("subj-%s-%s", s.Name, subj)
			nodes = append(nodes, models.TopologyNode{
				ID:      subjNodeID,
				Label:   subj,
				Type:    "subject",
				Subtext: "Wildcard Filter",
				Status:  "normal",
			})

			// Edge: Publishers -> Subject
			edges = append(edges, models.TopologyEdge{
				Source:   "node-publishers",
				Target:   subjNodeID,
				Label:    "pub",
				Animated: true,
				FlowRate: "auto",
				Status:   "normal",
			})

			// Edge: Subject -> Stream
			edges = append(edges, models.TopologyEdge{
				Source:   subjNodeID,
				Target:   streamNodeID,
				Label:    "store",
				Animated: true,
				FlowRate: "persist",
				Status:   "normal",
			})
		}

		// Consumers for this stream
		for _, cons := range consumers {
			if cons.StreamName != s.Name {
				continue
			}

			consNodeID := fmt.Sprintf("consumer-%s-%s", s.Name, cons.Name)
			workerNodeID := fmt.Sprintf("worker-%s-%s", s.Name, cons.Name)

			consStatus := "normal"
			if cons.HealthStatus == "warning" {
				consStatus = "warning"
			} else if cons.HealthStatus == "critical" {
				consStatus = "critical"
			}

			nodes = append(nodes, models.TopologyNode{
				ID:      consNodeID,
				Label:   cons.Name,
				Type:    "consumer",
				Subtext: fmt.Sprintf("%s | lag: %d", cons.DeliverPolicy, cons.NumPending),
				Status:  consStatus,
				Lag:     cons.NumPending,
			})

			nodes = append(nodes, models.TopologyNode{
				ID:      workerNodeID,
				Label:   fmt.Sprintf("%s-worker", cons.Name),
				Type:    "worker",
				Subtext: "Active Subscribers",
				Status:  "normal",
			})

			// Edge: Stream -> Consumer
			edges = append(edges, models.TopologyEdge{
				Source:   streamNodeID,
				Target:   consNodeID,
				Label:    fmt.Sprintf("lag: %d", cons.NumPending),
				Animated: cons.NumPending > 0,
				Status:   consStatus,
			})

			// Edge: Consumer -> Worker
			edges = append(edges, models.TopologyEdge{
				Source:   consNodeID,
				Target:   workerNodeID,
				Label:    "ack",
				Animated: cons.NumAckPending > 0,
				Status:   consStatus,
			})
		}
	}

	return models.TopologyData{
		Nodes: nodes,
		Edges: edges,
	}, nil
}
