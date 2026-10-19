package main

import (
	"embed"
	"io/fs"

	"github.com/alexandrmotologa/natslens/cmd"
)

//go:embed all:ui/dist
var embeddedDist embed.FS

var Version = "0.1.0"

func main() {
	staticFS, err := fs.Sub(embeddedDist, "ui/dist")
	if err != nil {
		staticFS = nil
	}
	cmd.Execute(staticFS, Version)
}
