package main

import (
	"os"

	"github.com/lukegabriel520/workit/internal/cli"
)

func main() {
	if err := cli.Execute(); err != nil {
		os.Exit(1)
	}
}
