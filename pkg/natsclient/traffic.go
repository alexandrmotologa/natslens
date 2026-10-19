package natsclient

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
)

// TrafficEngine manages synthetic traffic generation and chaos testing sessions.
type TrafficEngine struct {
	mu       sync.RWMutex
	sessions map[string]*trafficSession
	client   *NATSClient
}

type trafficSession struct {
	config    models.TrafficGeneratorConfig
	status    models.TrafficGeneratorStatus
	stopChan  chan struct{}
	startTime time.Time
}

// NewTrafficEngine creates a new traffic generation engine.
func NewTrafficEngine(client *NATSClient) *TrafficEngine {
	return &TrafficEngine{
		sessions: make(map[string]*trafficSession),
		client:   client,
	}
}

// StartSession launches a synthetic traffic generator worker.
func (e *TrafficEngine) StartSession(config models.TrafficGeneratorConfig) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if config.ID == "" {
		config.ID = fmt.Sprintf("traffic-%d", time.Now().UnixNano())
	}
	if config.RatePerSec <= 0 {
		config.RatePerSec = 10
	}
	if config.TargetSubject == "" {
		config.TargetSubject = "orders.simulated"
	}
	if config.PayloadTemplate == "" {
		config.PayloadTemplate = `{"orderId":"ord_{{uuid}}","timestamp":"{{now}}","amount":{{random_int}},"status":"CREATED"}`
	}

	session := &trafficSession{
		config: config,
		status: models.TrafficGeneratorStatus{
			ID:            config.ID,
			Active:        true,
			TargetRate:    config.RatePerSec,
			TargetSubject: config.TargetSubject,
			StartedAt:     time.Now(),
		},
		stopChan:  make(chan struct{}),
		startTime: time.Now(),
	}

	e.sessions[config.ID] = session

	// Run worker in background
	go e.runWorker(session)

	return config.ID, nil
}

// StopSession halts a running traffic session.
func (e *TrafficEngine) StopSession(id string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()

	session, exists := e.sessions[id]
	if !exists || !session.status.Active {
		return false
	}

	close(session.stopChan)
	session.status.Active = false
	return true
}

// GetStatus returns the live status of a traffic session.
func (e *TrafficEngine) GetStatus(id string) (models.TrafficGeneratorStatus, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	session, exists := e.sessions[id]
	if !exists {
		return models.TrafficGeneratorStatus{}, false
	}
	return session.status, true
}

// ListSessions returns all active and past traffic sessions.
func (e *TrafficEngine) ListSessions() []models.TrafficGeneratorStatus {
	e.mu.RLock()
	defer e.mu.RUnlock()

	list := make([]models.TrafficGeneratorStatus, 0, len(e.sessions))
	for _, s := range e.sessions {
		list = append(list, s.status)
	}
	return list
}

func (e *TrafficEngine) runWorker(s *trafficSession) {
	interval := time.Second / time.Duration(s.config.RatePerSec)
	if interval < time.Millisecond {
		interval = time.Millisecond
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var sent uint64
	maxMessages := uint64(s.config.TotalMessages)
	var maxDuration time.Duration
	if s.config.DurationSeconds > 0 {
		maxDuration = time.Duration(s.config.DurationSeconds) * time.Second
	}

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			// Check duration limits
			elapsed := time.Since(s.startTime)
			if maxDuration > 0 && elapsed >= maxDuration {
				e.StopSession(s.config.ID)
				return
			}
			if maxMessages > 0 && sent >= maxMessages {
				e.StopSession(s.config.ID)
				return
			}

			// Generate payload and inject chaos
			payload := renderTemplate(s.config.PayloadTemplate)

			// Chaos: Malformed payload injection
			if s.config.Chaos.MalformedPayloadRatio > 0 {
				r, _ := rand.Int(rand.Reader, big.NewInt(100))
				if float64(r.Int64()) < s.config.Chaos.MalformedPayloadRatio*100 {
					payload = payload[:len(payload)/2] + " [CORRUPTED_CHAOS_BYTE]"
				}
			}

			// Chaos: Latency jitter
			if s.config.Chaos.LatencyJitterMs > 0 {
				jitter, _ := rand.Int(rand.Reader, big.NewInt(int64(s.config.Chaos.LatencyJitterMs)))
				time.Sleep(time.Duration(jitter.Int64()) * time.Millisecond)
			}

			// Headers
			headers := make(map[string][]string)
			for k, v := range s.config.Headers {
				headers[k] = []string{v}
			}
			headers["Nats-Msg-Id"] = []string{fmt.Sprintf("sim-%d-%d", s.startTime.Unix(), sent)}

			if s.config.Chaos.InjectHeaderError {
				headers["Nats-Error"] = []string{"Chaos simulated error injected by traffic studio"}
			}

			// Publish
			_, err := e.client.PublishMessage(context.Background(), models.PublishMessageRequest{
				Subject: s.config.TargetSubject,
				Payload: payload,
				Headers: headers,
			})

			sent++

			// Update status
			e.mu.Lock()
			s.status.SentMessages = sent
			s.status.ElapsedSec = time.Since(s.startTime).Seconds()
			if s.status.ElapsedSec > 0 {
				s.status.CurrentRate = float64(sent) / s.status.ElapsedSec
			}
			if err != nil {
				s.status.LastError = err.Error()
			}
			e.mu.Unlock()
		}
	}
}

func renderTemplate(tpl string) string {
	res := tpl

	// {{uuid}}
	if strings.Contains(res, "{{uuid}}") {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		res = strings.ReplaceAll(res, "{{uuid}}", hex.EncodeToString(b))
	}

	// {{now}}
	if strings.Contains(res, "{{now}}") {
		res = strings.ReplaceAll(res, "{{now}}", time.Now().UTC().Format(time.RFC3339))
	}

	// {{now_epoch}}
	if strings.Contains(res, "{{now_epoch}}") {
		res = strings.ReplaceAll(res, "{{now_epoch}}", fmt.Sprintf("%d", time.Now().Unix()))
	}

	// {{random_int}}
	if strings.Contains(res, "{{random_int}}") {
		n, _ := rand.Int(rand.Reader, big.NewInt(9000))
		res = strings.ReplaceAll(res, "{{random_int}}", fmt.Sprintf("%d", n.Int64()+1000))
	}

	// {{random_float}}
	if strings.Contains(res, "{{random_float}}") {
		n, _ := rand.Int(rand.Reader, big.NewInt(10000))
		val := float64(n.Int64()) / 100.0
		res = strings.ReplaceAll(res, "{{random_float}}", fmt.Sprintf("%.2f", val))
	}

	return res
}
