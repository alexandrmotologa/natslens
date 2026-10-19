package server

import (
	"context"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/embedded"
	"github.com/alexandrmotologa/natslens/pkg/models"
	"github.com/alexandrmotologa/natslens/pkg/natsclient"
	"github.com/alexandrmotologa/natslens/server/handlers"
)

// Config defines settings for NATSLens server.
type Config struct {
	Host       string
	Port       int
	NATSURL    string
	DemoMode   bool
	StaticFS   fs.FS
	Version    string
}

// Server coordinates HTTP listening, background tasks, and NATS connections.
type Server struct {
	httpServer    *http.Server
	listener      net.Listener
	client        *natsclient.Client
	replayManager *natsclient.ReplayManager
	demoServer    *embedded.DemoServer
	config        Config
}

// NewServer initializes NATSLens server.
func NewServer(cfg Config) (*Server, error) {
	client := natsclient.NewClient()
	replayMgr := natsclient.NewReplayManager(client)
	apiHandler := handlers.NewAPIHandler(client, replayMgr)

	var demoServer *embedded.DemoServer
	if cfg.DemoMode {
		ds, err := embedded.StartDemoServer(0)
		if err != nil {
			return nil, fmt.Errorf("failed to start demo server: %w", err)
		}
		demoServer = ds
		apiHandler.DemoServer = ds
		cfg.NATSURL = ds.ClientURL()
	}

	router := NewRouter(apiHandler, cfg.StaticFS)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		if demoServer != nil {
			demoServer.Stop()
		}
		return nil, fmt.Errorf("failed to bind address %s: %w", addr, err)
	}

	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	return &Server{
		httpServer:    httpSrv,
		listener:      ln,
		client:        client,
		replayManager: replayMgr,
		demoServer:    demoServer,
		config:        cfg,
	}, nil
}

// Start begins serving HTTP requests on the pre-bound TCP listener.
func (s *Server) Start() error {
	// Auto-connect to target or demo NATS
	if s.config.NATSURL != "" {
		_ = s.client.Connect(models.ConnectionConfig{
			ID:   "initial",
			Name: "Initial Connection",
			URL:  s.config.NATSURL,
		})
	}

	return s.httpServer.Serve(s.listener)
}

// Port returns actual listening port (useful if configured as 0).
func (s *Server) Port() int {
	if s.listener != nil {
		return s.listener.Addr().(*net.TCPAddr).Port
	}
	return s.config.Port
}

// URL returns the full base HTTP URL of this server.
func (s *Server) URL() string {
	host := s.config.Host
	if host == "" || host == "0.0.0.0" {
		host = "127.0.0.1"
	}
	return fmt.Sprintf("http://%s:%d", host, s.Port())
}

// Shutdown gracefully terminates HTTP server and connections.
func (s *Server) Shutdown(ctx context.Context) error {
	if s.demoServer != nil {
		s.demoServer.Stop()
	}
	if s.client != nil {
		s.client.Close()
	}
	return s.httpServer.Shutdown(ctx)
}
