// Command commercial_free is a minimal static dev server for the Phase 1
// proof-of-concept: it serves the repo root so the demo player can load the
// zone manifest and creative assets over HTTP.
//
// Run: go run . then open http://localhost:8080/player/
package main

import (
	"flag"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	flag.Parse()

	http.Handle("/", http.FileServer(http.Dir(".")))
	log.Printf("commercial_free dev server listening on %s", *addr)
	log.Printf("demo player → http://localhost%s/player/", *addr)
	log.Fatal(http.ListenAndServe(*addr, nil))
}

