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
	serverPort int
	serverHost string
	natsURL    string
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start the NATSLens observability web studio",
	Run: func(cmd *cobra.Command, args []string) {
		srv, err := server.NewServer(server.Config{
			Host:     serverHost,
			Port:     serverPort,
			NATSURL:  natsURL,
			DemoMode: false,
			StaticFS: embeddedFS,
			Version:  appVersion,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error initializing server: %v\n", err)
			os.Exit(1)
		}

		go func() {
			fmt.Printf("NATSLens %s starting on %s\n", appVersion, srv.URL())
			if natsURL != "" {
				fmt.Printf("Target NATS Cluster: %s\n", natsURL)
			}
			if err := srv.Start(); err != nil && err.Error() != "http: Server closed" {
				fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
				os.Exit(1)
			}
		}()

		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit

		fmt.Println("\nShutting down NATSLens gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Shutdown error: %v\n", err)
		}
	},
}

func init() {
	serverCmd.Flags().IntVarP(&serverPort, "port", "p", 8080, "HTTP server listening port")
	serverCmd.Flags().StringVar(&serverHost, "host", "127.0.0.1", "HTTP server listening host")
	serverCmd.Flags().StringVarP(&natsURL, "nats", "n", "nats://127.0.0.1:4222", "NATS server URL")
	rootCmd.AddCommand(serverCmd)
}
