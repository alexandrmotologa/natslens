package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/alexandrmotologa/natslens/server"
	"github.com/spf13/cobra"
)

var (
	demoPort int
	demoHost string
)

var demoCmd = &cobra.Command{
	Use:   "demo",
	Short: "Start NATSLens with an embedded in-memory NATS JetStream sandbox and live traffic generator",
	Long: `Starts an embedded NATS JetStream cluster in-memory, seeds realistic demonstration
streams (ORDERS, PAYMENTS, TELEMETRY), consumers, Key-Value stores, and generates simulated
real-time traffic. Perfect for trying NATSLens without needing an external NATS installation.`,
	Run: func(cmd *cobra.Command, args []string) {
		srv, err := server.NewServer(server.Config{
			Host:     demoHost,
			Port:     demoPort,
			DemoMode: true,
			StaticFS: embeddedFS,
			Version:  appVersion,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error initializing demo server: %v\n", err)
			os.Exit(1)
		}

		go func() {
			fmt.Println("===============================================================")
			fmt.Printf("NATSLens %s (Embedded Demo Mode)\n", appVersion)
			fmt.Printf("Web Studio UI: %s\n", srv.URL())
			fmt.Println("Embedded JetStream cluster running in-memory with live traffic")
			fmt.Println("===============================================================")
			if err := srv.Start(); err != nil && err.Error() != "http: Server closed" {
				fmt.Fprintf(os.Stderr, "Demo server error: %v\n", err)
				os.Exit(1)
			}
		}()

		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit

		fmt.Println("\nStopping embedded demo cluster...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Shutdown error: %v\n", err)
		}
	},
}

func init() {
	demoCmd.Flags().IntVarP(&demoPort, "port", "p", 8080, "HTTP server listening port")
	demoCmd.Flags().StringVar(&demoHost, "host", "127.0.0.1", "HTTP server listening host")
	rootCmd.AddCommand(demoCmd)
}
