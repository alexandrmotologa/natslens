package cmd

import (
	"fmt"
	"io/fs"
	"os"

	"github.com/spf13/cobra"
)

var (
	embeddedFS fs.FS
	appVersion = "dev"
)

var rootCmd = &cobra.Command{
	Use:   "natslens",
	Short: "High-performance NATS & JetStream observability studio and KV workbench",
	Long: `NATSLens provides real-time stream inspection, consumer lag and redelivery heatmaps,
Key-Value & ObjectStore exploration, and message replay for NATS.io and JetStream clusters.`,
}

// Execute is the main entrypoint for the CLI application.
func Execute(staticFS fs.FS, version string) {
	embeddedFS = staticFS
	appVersion = version

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
