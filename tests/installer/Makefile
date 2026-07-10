# E3CNC Installer Test Matrix
# Usage:
#   make              - Show available targets
#   make build        - Build all Docker images
#   make test         - Run all tests
#   make test-ubuntu  - Run Ubuntu test only
#   make test-arm64   - Run Debian arm64 test (requires QEMU)
#   make clean        - Remove all test images

PLATFORM := $(shell uname -m)
DOCKER_COMPOSE := docker compose
TEST_DIR := tests/installer

.PHONY: all build test test-ubuntu test-fedora test-rocky test-arm64 clean setup-qemu

all:
	@echo "E3CNC Installer Test Matrix"
	@echo ""
	@echo "Targets:"
	@echo "  make build          - Build all Docker images"
	@echo "  make test           - Run all tests"
	@echo "  make test-ubuntu    - Test Ubuntu 22.04 (apt)"
	@echo "  make test-fedora    - Test Fedora 38 (dnf)"
	@echo "  make test-rocky     - Test Rocky Linux 9 (dnf)"
	@echo "  make test-arm64     - Test Debian arm64 (QEMU required)"
	@echo "  make setup-qemu     - Install QEMU for arm64 emulation"
	@echo "  make clean          - Remove test images"
	@echo ""
	@echo "Current platform: $(PLATFORM)"

# Setup QEMU for cross-platform builds (arm64 on amd64 Mac)
setup-qemu:
	@echo "Installing QEMU user-static for cross-platform Docker builds..."
	docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
	@echo "QEMU setup complete. You can now build arm64 images."

# Build all test images
build:
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml build

# Run all tests
test: test-ubuntu test-fedora test-rocky
	@echo ""
	@echo "All tests completed. Check output above for failures."

# Individual OS tests
test-ubuntu:
	@echo "Running Ubuntu 22.04 test..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up ubuntu
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f ubuntu

test-fedora:
	@echo "Running Fedora 38 test..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up fedora
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f fedora

test-rocky:
	@echo "Running Rocky Linux 9 test..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up rocky
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f rocky

# ARM64 test (requires QEMU on non-ARM hosts)
test-arm64:
	@echo "Running Debian arm64 test (BTT-CB1 target)..."
	@echo "NOTE: This requires QEMU setup. Run 'make setup-qemu' first if needed."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml build debian-arm64
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml up debian-arm64
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml rm -f debian-arm64

# Quick smoke test - just syntax check the install script in a container
smoke:
	@echo "Smoke test: checking install.sh syntax..."
	docker run --rm -v $(PWD):/workspace -w /workspace ubuntu:22.04 \
		bash -c "bash -n install.sh && echo 'Syntax OK'"

# Clean up
clean:
	@echo "Cleaning up test images..."
	$(DOCKER_COMPOSE) -f $(TEST_DIR)/docker-compose.yml down --rmi all --volumes
	docker system prune -f
