# E3CNC Installer Test Matrix
# Usage:
#   make              - Show available targets
#   make build        - Build all Docker images (amd64 only)
#   make test         - Run all local Docker tests
#   make test-ubuntu  - Test Ubuntu 22.04 (apt)
#   make test-fedora  - Test Fedora 38 (dnf)
#   make test-rocky   - Test Rocky Linux 9 (dnf)
#   make test-cb1     - Run tests on real BTT-CB1 via SSH
#   make test-all     - Docker tests + CB1 tests
#   make clean        - Remove all test images

PLATFORM := $(shell uname -m)
DOCKER_COMPOSE := docker compose
TEST_DIR := tests/installer
CNC_HOST := cnc

.PHONY: all build test test-ubuntu test-fedora test-rocky test-cb1 test-all clean

all:
	@echo "E3CNC Installer Test Matrix"
	@echo ""
	@echo "Local Docker tests (amd64):"
	@echo "  make build          - Build all Docker images"
	@echo "  make test           - Run all local tests"
	@echo "  make test-ubuntu    - Test Ubuntu 22.04 (apt)"
	@echo "  make test-fedora    - Test Fedora 38 (dnf)"
	@echo "  make test-rocky     - Test Rocky Linux 9 (dnf)"
	@echo ""
	@echo "Real hardware tests:"
	@echo "  make test-cb1       - Test Debian arm64 on BTT-CB1 (SSH: $(CNC_HOST))"
	@echo "  make test-all       - All of the above"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean          - Remove test images"
	@echo ""
	@echo "Current platform: $(PLATFORM)"

# Build all Docker images (amd64 only)
build:
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml build

# Run all local Docker tests
test: test-ubuntu test-fedora test-rocky
	@echo ""
	@echo "All local Docker tests completed."

# Individual OS tests (Docker)
test-ubuntu:
	@echo "Running Ubuntu 22.04 test (apt)..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up ubuntu
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f ubuntu

test-fedora:
	@echo "Running Fedora 38 test (dnf)..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up fedora
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f fedora

test-rocky:
	@echo "Running Rocky Linux 9 test (dnf)..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up rocky
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f rocky

# Run tests on real BTT-CB1 hardware via SSH
test-cb1:
	@echo "Running tests on BTT-CB1 via SSH ($(CNC_HOST))..."
	@if ! ssh -q -o ConnectTimeout=5 $(CNC_HOST) exit; then \
		echo "ERROR: Cannot connect to $(CNC_HOST) via SSH"; \
		echo "Make sure the CNC is on and SSH is configured."; \
		exit 1; \
	fi
	@echo "Connected to $(CNC_HOST). Copying test files..."
	scp $(TEST_DIR)/test-runner.sh $(CNC_HOST):/tmp/e3cnc-test/ 2>/dev/null || mkdir -p /tmp/e3cnc-test && scp $(TEST_DIR)/test-runner.sh $(CNC_HOST):/tmp/e3cnc-test/
	scp install.sh $(CNC_HOST):/tmp/e3cnc-test/
	@echo "Running tests..."
	ssh $(CNC_HOST) "cd /tmp/e3cnc-test && bash test-runner.sh debian-arm64-cb1"
	@echo ""
	@echo "CB1 test completed. Cleaning up..."
	ssh $(CNC_HOST) "rm -rf /tmp/e3cnc-test"

# Run all tests (Docker + CB1)
test-all: test test-cb1
	@echo ""
	@echo "All tests completed (Docker + CB1)."

# Clean up
clean:
	@echo "Cleaning up test images..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml down --rmi all --volumes 2>/dev/null || true
	docker system prune -f
	@echo "Cleanup done."
