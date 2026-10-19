package cmd

import (
	"fmt"
	"runtime"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the NATSLens version and runtime build info",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("NATSLens %s\n", appVersion)
		fmt.Printf("Go runtime: %s (%s/%s)\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
