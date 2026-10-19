# NATSLens: High-Performance NATS & JetStream Observability Studio

## Executive Overview

NATSLens is a single-binary observability studio, consumer lag visualizer, and Key-Value/ObjectStore workbench for NATS.io and NATS JetStream. It runs as a self-contained web service with an embedded React 19 UI, providing real-time inspection, monitoring, and interactive message debugging for distributed systems using NATS.

## Core Capabilities

1. **Multi-Connection Profile Manager**
   - Connects to Core NATS and JetStream clusters via standard URL schemes (`nats://`, `tls://`, `ws://`).
   - Supports anonymous, user/password, auth token, NKeys, user credentials files (`.creds`), and TLS client certificate authentication.
   - Includes an in-process embedded sandbox server (`natslens demo`) with sample streams, active traffic, KV buckets, and ObjectStore data for instant evaluation without external dependencies.

2. **Stream & Subject Hierarchy Visualizer**
   - Inspects stream configuration: storage backend (file or memory), retention policies (Limits, Interest, WorkQueue), discard behavior, deduplication windows, and limits.
   - Deconstructs dot-delimited subjects into an interactive visual hierarchy tree with message counts and wildcard coverage.
   - Provides direct message inspection by sequence number with payload decoding (JSON, plain text, hex) and metadata.
   - Supports stream purging, subject-filtered purge, and sequence deletion.

3. **Consumer Lag & Redelivery Heatmap**
   - Tracks consumer states: pending messages, ack pending messages, and redelivered counts.
   - Computes delivery health and alerts on AckWait threshold violations to identify stalled workers or poison messages.
   - Provides consumer lifecycle controls: create, pause, resume, reset sequence, and delete.

4. **JetStream Key-Value (KV) Workbench**
   - Lists buckets with history depth, TTL, storage type, and byte size.
   - Key browser with prefix filtering, syntax-highlighted value inspection, and full revision history tracking.
   - Real-time watcher feed streaming live KV mutations over Server-Sent Events (SSE).
   - Key operations: create, edit, delete, and purge revisions.

5. **JetStream ObjectStore Explorer**
   - Lists ObjectStore buckets with size, chunk count, and replica configurations.
   - Uploads, downloads, and deletes objects with SHA-256 digest verification.
   - Previews text, JSON, and common media formats directly in the interface.

6. **Message Studio & Stream Replay Engine**
   - Publishes test messages to any subject with custom headers, including `Nats-Msg-Id` for deduplication and optimistic concurrency headers.
   - Browses historical messages within streams sequentially.
   - Replays messages from a given sequence number or timestamp to a target subject with rate control (instant, 1x, 2x, 5x, or paced).

7. **Core NATS Inspector & Request-Reply Probe**
   - Live subject tap with wildcard subscriptions (`*`, `>`), search filtering, and pause controls.
   - Request-reply testing utility that measures round-trip latency in milliseconds.

8. **Cluster Health & Server Info**
   - Displays server version, connections, in/out message rates, memory usage, and JetStream storage allocation.

## Architecture

```
+------------------------------------------------------------------+
|                            Web Browser                           |
|      (React 19, TypeScript, Tailwind CSS, Lucide Icons)          |
+---------------------------------+--------------------------------+
                                  | HTTP / SSE
+---------------------------------v--------------------------------+
|                       NATSLens Go Backend                        |
|                                                                  |
|  [HTTP Router & Handlers]      [SSE Hub for Live Feeds]          |
|  - Cluster & Diagnostics        - Consumer lag live updates      |
|  - Streams & Subjects           - Key-Value live watch stream    |
|  - Consumers & Redeliveries     - Core NATS live subject tap     |
|  - KV & ObjectStore             - Stream replay progress stream  |
|  - Message Studio & Replay                                       |
|                                                                  |
|  [NATS Client Adapter]         [Embedded Demo Engine]            |
|  - nats.go connection pool      - In-process NATS JetStream      |
|  - JetStream context            - Automated mock event generator |
|  - KV & ObjectStore managers                                     |
+---------------------------------+--------------------------------+
                                  | NATS Protocol (TCP / TLS)
+---------------------------------v--------------------------------+
|                    Target NATS / JetStream                       |
|                 (Local, Docker, K8s, or Cloud)                   |
+------------------------------------------------------------------+
```

## Implementation Phases

- **Phase 1: Project Foundation & Portfolio Sync**
  - Portfolio registry in `mtlg-site` and `mtlglabs-space`.
  - GitHub repository initialization with 14 topics across 4 dimensions.
  - Go module scaffolding and dependency management.

- **Phase 2: Go Backend Architecture**
  - Models and data structures (`pkg/models/types.go`).
  - NATS connection client with auth handling (`pkg/natsclient/client.go`).
  - Stream & subject inspection logic (`pkg/natsclient/streams.go`).
  - Consumer lag and redelivery calculation (`pkg/natsclient/consumers.go`).
  - KV & ObjectStore operations (`pkg/natsclient/kv.go`, `pkg/natsclient/objectstore.go`).
  - Message publishing and stream replay engine (`pkg/natsclient/replay.go`).
  - Embedded in-process NATS JetStream server for demo mode (`pkg/embedded/server.go`).
  - HTTP router, REST handlers, and SSE streaming engine (`server/`).
  - Cobra CLI commands (`cmd/root.go`, `cmd/server.go`, `cmd/demo.go`, `cmd/version.go`).

- **Phase 3: React 19 Frontend Engineering**
  - Vite + React 19 + TypeScript + Tailwind CSS setup.
  - Dark-mode developer studio design system with Lucide icons.
  - Connection manager modal with profile persistence.
  - Stream list, stream details, and subject hierarchy visualizer.
  - Consumer lag monitor with redelivery and AckWait heatmap alerts.
  - Key-Value workbench with revision history and live watch stream.
  - ObjectStore browser with file upload, download, and preview.
  - Message publisher, stream message browser, and replay engine.
  - Core NATS live message tap and request-reply latency probe.
  - Cluster health dashboard.

- **Phase 4: Embedded Single-Binary Integration & Verification**
  - Build UI and embed assets via `//go:embed all:ui/dist`.
  - Integration tests with embedded JetStream server.
  - Verify standalone binary execution.

- **Phase 5: Visual Assets, Humanized Documentation & Launch**
  - High-fidelity UI screenshots and animated demo GIF (`docs/images/`).
  - Comprehensive humanized `README.md`.
  - Portfolio Phase 2 completion sync and launch broadcast.
