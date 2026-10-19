package server

import (
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/alexandrmotologa/natslens/server/handlers"
)

// NewRouter constructs the HTTP handler tree and middleware.
func NewRouter(h *handlers.APIHandler, staticFS fs.FS) http.Handler {
	mux := http.NewServeMux()

	// Prometheus Metrics Endpoint
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		h.PrometheusMetrics(w, r)
	})

	// API Route Dispatcher
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		switch {
		// Health & Cluster
		case path == "/api/health":
			h.HealthCheck(w, r)
		case path == "/api/cluster/stats":
			h.GetClusterStats(w, r)
		case path == "/api/cluster/connect":
			if r.Method == http.MethodPost {
				h.Connect(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case path == "/api/cluster/config":
			h.GetConnectionConfig(w, r)
		case path == "/api/demo/start":
			if r.Method == http.MethodPost {
				h.StartDemoCluster(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// Topology
		case path == "/api/topology":
			h.GetTopology(w, r)

		// Schema Registry
		case path == "/api/schemas":
			if r.Method == http.MethodGet {
				h.ListSchemas(w, r)
			} else if r.Method == http.MethodPost {
				h.SaveSchema(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case path == "/api/schemas/validate":
			if r.Method == http.MethodPost {
				h.ValidatePayload(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case strings.HasPrefix(path, "/api/schemas/"):
			if r.Method == http.MethodDelete {
				h.DeleteSchema(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// DLQ & Poison Pills
		case path == "/api/dlq":
			h.ListDLQMessages(w, r)
		case path == "/api/dlq/scan":
			if r.Method == http.MethodPost {
				h.ScanDLQ(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case strings.HasPrefix(path, "/api/dlq/"):
			if strings.HasSuffix(path, "/republish") {
				if r.Method == http.MethodPost {
					h.RepublishDLQ(w, r)
				} else {
					handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
				}
			} else if r.Method == http.MethodDelete {
				h.PurgeDLQ(w, r)
			} else if r.Method == http.MethodGet {
				h.GetDLQMessage(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// Traffic Studio
		case path == "/api/traffic/start":
			if r.Method == http.MethodPost {
				h.StartTraffic(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case path == "/api/traffic/sessions":
			h.ListTraffic(w, r)
		case strings.HasPrefix(path, "/api/traffic/") && strings.HasSuffix(path, "/stop"):
			if r.Method == http.MethodPost {
				h.StopTraffic(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// Alerts & Webhooks
		case path == "/api/alerts/rules":
			if r.Method == http.MethodGet {
				h.ListAlertRules(w, r)
			} else if r.Method == http.MethodPost {
				h.SaveAlertRule(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case strings.HasPrefix(path, "/api/alerts/rules/"):
			if r.Method == http.MethodDelete {
				h.DeleteAlertRule(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case path == "/api/alerts/events":
			h.ListAlertEvents(w, r)
		case path == "/api/alerts/test":
			if r.Method == http.MethodPost {
				h.TestWebhook(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// Streams
		case path == "/api/streams":
			if r.Method == http.MethodGet {
				h.ListStreams(w, r)
			} else if r.Method == http.MethodPost {
				h.CreateStream(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		case strings.HasPrefix(path, "/api/streams/"):
			handleStreamsSubroute(h, w, r)

		// Consumers Standalone Creation
		case path == "/api/consumers":
			if r.Method == http.MethodPost {
				h.CreateConsumer(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// Key-Value Store
		case path == "/api/kv":
			if r.Method == http.MethodGet {
				h.ListKVBuckets(w, r)
			} else if r.Method == http.MethodPost {
				h.CreateKVBucket(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		case strings.HasPrefix(path, "/api/kv/"):
			handleKVSubroute(h, w, r)

		// ObjectStore
		case path == "/api/objectstore":
			if r.Method == http.MethodGet {
				h.ListObjectStoreBuckets(w, r)
			} else if r.Method == http.MethodPost {
				h.CreateObjectStoreBucket(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		case strings.HasPrefix(path, "/api/objectstore/"):
			handleObjectStoreSubroute(h, w, r)

		// Messages & Probe
		case path == "/api/messages/publish":
			if r.Method == http.MethodPost {
				h.PublishMessage(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		case path == "/api/messages/request":
			if r.Method == http.MethodPost {
				h.RequestReply(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		// Stream Replay
		case path == "/api/replay/start":
			if r.Method == http.MethodPost {
				h.StartReplay(w, r)
			} else {
				handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
			}

		case strings.HasPrefix(path, "/api/replay/"):
			if strings.HasSuffix(path, "/progress") {
				h.GetReplayProgress(w, r)
			} else if strings.HasSuffix(path, "/stop") {
				h.StopReplay(w, r)
			} else {
				handlers.WriteError(w, http.StatusNotFound, "route not found")
			}

		// Core NATS Tap
		case path == "/api/tap":
			h.TapSubject(w, r)

		default:
			handlers.WriteError(w, http.StatusNotFound, "api endpoint not found")
		}
	})

	// Static UI file server with SPA fallback
	if staticFS != nil {
		fileServer := http.FileServer(http.FS(staticFS))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				return
			}

			// Clean path
			cleanPath := strings.TrimPrefix(r.URL.Path, "/")
			if cleanPath == "" {
				cleanPath = "index.html"
			}

			// Check if file exists in staticFS
			f, err := staticFS.Open(cleanPath)
			if err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}

			// SPA fallback: serve index.html
			indexFile, err := staticFS.Open("index.html")
			if err == nil {
				defer indexFile.Close()
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				stat, _ := indexFile.Stat()
				http.ServeContent(w, r, "index.html", stat.ModTime(), indexFile.(io.ReadSeeker))
				return
			}

			http.NotFound(w, r)
		})
	}

	return corsMiddleware(mux)
}

func handleStreamsSubroute(h *handlers.APIHandler, w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	switch {
	case strings.HasSuffix(path, "/export"):
		h.ExportStream(w, r)

	case strings.HasSuffix(path, "/purge"):
		if r.Method == http.MethodPost {
			h.PurgeStream(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}

	case strings.HasSuffix(path, "/browse"):
		h.BrowseMessages(w, r)

	case strings.Contains(path, "/messages/"):
		if r.Method == http.MethodGet {
			h.GetMessage(w, r)
		} else if r.Method == http.MethodDelete {
			h.DeleteMessage(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}

	case strings.HasSuffix(path, "/consumers"):
		if r.Method == http.MethodGet {
			h.ListConsumers(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}

	case strings.Contains(path, "/consumers/"):
		if strings.HasSuffix(path, "/pause") {
			h.PauseConsumer(w, r)
		} else if strings.HasSuffix(path, "/resume") {
			h.ResumeConsumer(w, r)
		} else if r.Method == http.MethodGet {
			h.GetConsumer(w, r)
		} else if r.Method == http.MethodDelete {
			h.DeleteConsumer(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}

	default:
		// Single stream /api/streams/{name}
		if r.Method == http.MethodGet {
			h.GetStream(w, r)
		} else if r.Method == http.MethodDelete {
			h.DeleteStream(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func handleKVSubroute(h *handlers.APIHandler, w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	switch {
	case strings.HasSuffix(path, "/export"):
		h.ExportKV(w, r)

	case strings.HasSuffix(path, "/import"):
		if r.Method == http.MethodPost {
			h.ImportKV(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}

	case strings.HasSuffix(path, "/watch"):
		h.WatchKVBucket(w, r)

	case strings.HasSuffix(path, "/keys"):
		h.ListKeys(w, r)

	case strings.HasSuffix(path, "/history"):
		h.GetKeyHistory(w, r)

	case strings.HasSuffix(path, "/purge"):
		h.PurgeKey(w, r)

	case strings.Contains(path, "/keys/"):
		h.HandleKey(w, r)

	default:
		// Single bucket /api/kv/{bucket}
		if r.Method == http.MethodGet {
			h.GetKVBucket(w, r)
		} else if r.Method == http.MethodDelete {
			h.DeleteKVBucket(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func handleObjectStoreSubroute(h *handlers.APIHandler, w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	switch {
	case strings.HasSuffix(path, "/objects"):
		h.ListObjects(w, r)

	case strings.Contains(path, "/objects/"):
		h.HandleObject(w, r)

	default:
		// Single bucket /api/objectstore/{bucket}
		if r.Method == http.MethodGet {
			h.GetObjectStoreBucket(w, r)
		} else if r.Method == http.MethodDelete {
			h.DeleteObjectStoreBucket(w, r)
		} else {
			handlers.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Object-Description")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
