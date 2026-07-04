# E3CNC TUI Go binary — Build and cross-compile
# Usage:
#   make               Build for current platform
#   make build-all     Cross-compile for all targets
#   make clean         Remove build artifacts

VERSION := $(shell grep '^VERSION' ../../_e3cnc_shared.py | head -1 | sed 's/.*"\(.*\)".*/\1/')
LDFLAGS := -s -w -X main.version=$(VERSION)
GOFLAGS := -ldflags="$(LDFLAGS)" -trimpath
CGO_ENABLED := 0
OUTPUT := bin/e3cnc-tui

.PHONY: all build-all clean linux-arm64 linux-amd64 darwin-amd64

all: build

build:
	CGO_ENABLED=$(CGO_ENABLED) go build $(GOFLAGS) -o $(OUTPUT) ./cmd/e3cnc-tui/

build-all: linux-arm64 linux-amd64 darwin-amd64

linux-arm64:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=$(CGO_ENABLED) go build $(GOFLAGS) -o $(OUTPUT)-linux-arm64 ./cmd/e3cnc-tui/

linux-amd64:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=$(CGO_ENABLED) go build $(GOFLAGS) -o $(OUTPUT)-linux-amd64 ./cmd/e3cnc-tui/

darwin-amd64:
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=$(CGO_ENABLED) go build $(GOFLAGS) -o $(OUTPUT)-darwin-amd64 ./cmd/e3cnc-tui/

clean:
	rm -rf bin/

# Verify the binary was built and reports the correct version
verify: build
	@echo "--- Version check ---"
	./$(OUTPUT) --version
	@echo "--- Help output ---"
	./$(OUTPUT) --help | head -5
	@echo "--- Size ---"
	ls -lh $(OUTPUT)
