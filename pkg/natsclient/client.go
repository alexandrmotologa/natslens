package natsclient

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/nats-io/nats.go"
)

// Client wraps NATS connection and JetStream context.
type Client struct {
	mu     sync.RWMutex
	nc     *nats.Conn
	js     nats.JetStreamContext
	config models.ConnectionConfig
}

// NewClient creates an uninitialized Client.
func NewClient() *Client {
	return &Client{}
}

// Connect establishes a connection to NATS according to ConnectionConfig.
func (c *Client) Connect(cfg models.ConnectionConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.nc != nil && c.nc.IsConnected() {
		c.nc.Close()
	}

	opts := []nats.Option{
		nats.Name("NATSLens Studio"),
		nats.Timeout(5 * time.Second),
		nats.PingInterval(10 * time.Second),
		nats.MaxPingsOutstanding(3),
	}

	// Authentication options
	if cfg.Username != "" && cfg.Password != "" {
		opts = append(opts, nats.UserInfo(cfg.Username, cfg.Password))
	} else if cfg.Token != "" {
		opts = append(opts, nats.Token(cfg.Token))
	} else if cfg.NKey != "" {
		opt, err := nats.NkeyOptionFromSeed(cfg.NKey)
		if err != nil {
			return fmt.Errorf("invalid nkey seed: %w", err)
		}
		opts = append(opts, opt)
	} else if cfg.CredsFile != "" {
		opts = append(opts, nats.UserCredentials(cfg.CredsFile))
	}

	// TLS Configuration
	if cfg.ClientCert != "" || cfg.CACert != "" || cfg.InsecureSkipVerify {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: cfg.InsecureSkipVerify,
		}

		if cfg.CACert != "" {
			caCertPool := x509.NewCertPool()
			var caData []byte
			var err error
			if _, statErr := os.Stat(cfg.CACert); statErr == nil {
				caData, err = os.ReadFile(cfg.CACert)
			} else {
				caData = []byte(cfg.CACert)
			}
			if err == nil && caCertPool.AppendCertsFromPEM(caData) {
				tlsConfig.RootCAs = caCertPool
			}
		}

		if cfg.ClientCert != "" && cfg.ClientKey != "" {
			cert, err := tls.LoadX509KeyPair(cfg.ClientCert, cfg.ClientKey)
			if err == nil {
				tlsConfig.Certificates = []tls.Certificate{cert}
			}
		}

		opts = append(opts, nats.Secure(tlsConfig))
	}

	url := cfg.URL
	if url == "" {
		url = nats.DefaultURL
	}

	nc, err := nats.Connect(url, opts...)
	if err != nil {
		return fmt.Errorf("failed to connect to NATS at %s: %w", url, err)
	}

	js, err := nc.JetStream()
	if err != nil {
		// Connected to Core NATS, but JetStream might not be enabled on the server
		c.js = nil
	} else {
		c.js = js
	}

	c.nc = nc
	c.config = cfg
	return nil
}

// Close closes the underlying NATS connection.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.nc != nil && !c.nc.IsClosed() {
		c.nc.Close()
	}
}

// IsConnected returns whether the client is currently connected.
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.nc != nil && c.nc.IsConnected()
}

// Conn returns the raw NATS connection.
func (c *Client) Conn() (*nats.Conn, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.nc == nil || !c.nc.IsConnected() {
		return nil, fmt.Errorf("nats client is not connected")
	}
	return c.nc, nil
}

// JS returns the JetStream context or error if unavailable.
func (c *Client) JS() (nats.JetStreamContext, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.nc == nil || !c.nc.IsConnected() {
		return nil, fmt.Errorf("nats client is not connected")
	}
	if c.js == nil {
		// Attempt to re-obtain JetStream context
		js, err := c.nc.JetStream()
		if err != nil {
			return nil, fmt.Errorf("jetstream is not enabled or available on this cluster: %w", err)
		}
		c.js = js
	}
	return c.js, nil
}

// Config returns the current active connection configuration.
func (c *Client) Config() models.ConnectionConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.config
}

// GetClusterStats retrieves current cluster and server diagnostic info.
func (c *Client) GetClusterStats() (*models.ClusterStats, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.nc == nil || !c.nc.IsConnected() {
		return nil, fmt.Errorf("not connected to NATS")
	}

	stats := c.nc.Stats()
	srvID := c.nc.ConnectedServerId()
	srvURL := c.nc.ConnectedUrl()
	srvVersion := c.nc.ConnectedServerVersion()

	cs := &models.ClusterStats{
		ServerName:         srvURL,
		ServerID:           srvID,
		Version:            srvVersion,
		Host:               srvURL,
		Connections:        1,
		InMsgs:             int64(stats.InMsgs),
		OutMsgs:            int64(stats.OutMsgs),
		InBytes:            int64(stats.InBytes),
		OutBytes:           int64(stats.OutBytes),
		JetStreamAvailable: c.js != nil,
	}

	if c.js != nil {
		accInfo, err := c.js.AccountInfo()
		if err == nil && accInfo != nil {
			cs.JetStream = models.JetStreamInfo{
				Enabled:        true,
				MemoryUsed:     accInfo.Memory,
				MemoryMax:      accInfo.Limits.MaxMemory,
				DiskUsed:       accInfo.Store,
				DiskMax:        accInfo.Limits.MaxStore,
				StreamsCount:   accInfo.Streams,
				ConsumersCount: accInfo.Consumers,
			}
		} else {
			cs.JetStream.Enabled = true
		}
	}

	return cs, nil
}
