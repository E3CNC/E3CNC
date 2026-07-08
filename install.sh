#!/bin/bash
# E3CNC Installer - One-command setup for CNC host
# Usage: sudo ./install.sh [--unattended]
set -uo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
INSTALL_VERSION="v0.9.18-merged"
INSTALL_DIR="/usr/local/bin"
# Allow customizing E3CNC_DIR via environment variable or command-line argument
E3CNC_DIR="${E3CNC_DIR:-$HOME/e3cnc}"
BACKUP_DIR="$E3CNC_DIR.backup.$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$E3CNC_DIR/logs/installer.log"
SUPERVISOR_CONF="/etc/supervisor/conf.d/e3cnc.conf"
RELEASE_URL="https://github.com/E3CNC/E3CNC/releases/latest/download"
BINARY_NAME="e3cnc-tui"
PORTS=(8081 7125 7126)  # Admin UI, Moonraker API, Klipper

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Progress Bar & Step Display ──────────────────────────────────────────────
TOTAL_STEPS=12
CURRENT_STEP=0

# Show overall progress bar: [████████░░░░░░░░░░░░]  40%
progress_bar() {
    local current=$1
    local total=$2
    local width=30
    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    local bar=""

    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done

    printf "\r  ${GREEN}[${NC}%s${GREEN}]${NC} ${GREEN}%3d%%${NC}" "$bar" "$percent"
}

# Begin a step: shows progress bar + step header
step_start() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local desc="$1"
    progress_bar $((CURRENT_STEP - 1)) $TOTAL_STEPS
    echo -e "\n  ${GREEN}➜${NC} ${BOLD}Step ${CURRENT_STEP}/${TOTAL_STEPS}:${NC} ${desc}"
    printf "  ${YELLOW}⟳${NC} Running..."
}

# Mark current step as passed
step_ok() {
    printf "\r  ${GREEN}✓${NC} \n"
    progress_bar $CURRENT_STEP $TOTAL_STEPS
}

# Mark current step as failed (non-fatal)
step_fail() {
    printf "\r  ${RED}✗${NC} \n"
}

# Mark current step as skipped
step_skip() {
    printf "\r  ${YELLOW}○${NC} Skipped\n"
    progress_bar $CURRENT_STEP $TOTAL_STEPS
}

# Run a command with an animated inline spinner
# Shows a rotating green spinner while command runs
spinner_run() {
    local desc="$1"
    shift
    local -a spin_chars=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
    local i=0
    local temp_out
    temp_out=$(mktemp)

    # Run command in background, capturing combined output
    "$@" > "$temp_out" 2>&1 &
    local pid=$!

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${GREEN}%s${NC} %s" "${spin_chars[$i]}" "$desc"
        i=$(( (i + 1) % ${#spin_chars[@]} ))
        sleep 0.08
    done

    wait "$pid"
    local exit_code=$?

    # Clear the spinner line
    printf "\r%$(tput cols)s\r"

    # Show output on failure
    if [[ $exit_code -ne 0 ]]; then
        cat "$temp_out"
    fi

    rm -f "$temp_out"
    return $exit_code
}

# Show animated dots while waiting for a service to respond
# Usage: wait_with_spinner <message> <command>
wait_with_spinner() {
    local desc="$1"
    shift
    local temp_out
    temp_out=$(mktemp)

    "$@" > "$temp_out" 2>&1 &
    local pid=$!
    local dots=0

    while kill -0 "$pid" 2>/dev/null; do
        local d=""
        for ((j=0; j<dots; j++)); do d+="."; done
        printf "\r  ${YELLOW}%s${NC}  %s" "⟳" "$desc$d"
        dots=$(( (dots + 1) % 4 ))
        sleep 0.5
    done

    wait "$pid"
    printf "\r%$(tput cols)s\r"
    rm -f "$temp_out"
}

# ─── Logging ───────────────────────────────────────────────────────────────────
log() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $*"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

log_info() { log "${GREEN}[INFO]${NC} $*"; }
log_warn() { log "${YELLOW}[WARN]${NC} $*"; }
log_error() { log "${RED}[ERROR]${NC} $*" >&2; }
log_success() { log "${GREEN}[SUCCESS]${NC} $*"; }

# ─── Helper Functions ──────────────────────────────────────────────────────────
detect_architecture() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        aarch64|arm64) echo "arm64" ;;
        x86_64|amd64) echo "amd64" ;;
        *) 
            log_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
}

detect_ip() {
    # Try to get the primary IP (not loopback)
    local ip
    ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    if [[ -z "$ip" ]]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    echo "$ip"
}

check_port() {
    local port="$1"
    if ss -tuln | grep -q ":$port "; then
        return 1  # Port is in use
    fi
    return 0  # Port is free
}

wait_for_service() {
    local port="$1"
    local name="$2"
    local retries=10
    local delay=2
    local timeout=5
    local attempt=0
    
    while true; do
        attempt=$((attempt + 1))
        
        # Animated dots for waiting
        local dots=""
        for ((j=0; j<((attempt - 1) % 4); j++)); do dots+="."; done
        printf "\r  ${YELLOW}⟳${NC}  Waiting for %s on port %s%s" "$name" "$port" "$dots"
        
        # Try to connect
        if ss -tuln | grep -q ":$port "; then
            case "$port" in
                7125)
                    if curl -sf --max-time $timeout http://localhost:7125/printer/info > /dev/null 2>&1; then
                        printf "\r  ${GREEN}✓${NC}  %s ready (port %s)\n" "$name" "$port"
                        return 0
                    fi
                    ;;
                8081)
                    if curl -sf --max-time $timeout http://localhost:8081/ > /dev/null 2>&1; then
                        printf "\r  ${GREEN}✓${NC}  %s ready (port %s)\n" "$name" "$port"
                        return 0
                    fi
                    ;;
                7126)
                    printf "\r  ${GREEN}✓${NC}  %s listening (port %s)\n" "$name" "$port"
                    return 0
                    ;;
                *)
                    printf "\r  ${GREEN}✓${NC}  %s listening (port %s)\n" "$name" "$port"
                    return 0
                    ;;
            esac
        fi
        
        if [[ $attempt -ge $retries ]]; then
            printf "\r  ${RED}✗${NC}  %s health check failed after %d retries\n" "$name" "$retries"
            return 1
        fi
        
        sleep $delay
    done
}
backup_existing() {
    step_start "Backing up existing installation"

    if [[ -d "$E3CNC_DIR" ]]; then
        cp -a "$E3CNC_DIR" "$BACKUP_DIR"
        step_ok
    else
        step_skip
    fi
}

install_dependencies() {
    step_start "Installing system dependencies"

    # Detect package manager
    local pkg_manager
    if command -v apt-get &> /dev/null; then
        pkg_manager="apt"
    elif command -v dnf &> /dev/null; then
        pkg_manager="dnf"
    elif command -v yum &> /dev/null; then
        pkg_manager="yum"
    elif command -v pacman &> /dev/null; then
        pkg_manager="pacman"
    elif command -v zypper &> /dev/null; then
        pkg_manager="zypper"
    else
        log_error "Unsupported package manager. Please install dependencies manually:"
        log_error "  git, curl, unzip, zstd, supervisor, python3-pip, iproute2"
        exit 1
    fi
    
    log_info "Detected package manager: $pkg_manager"
    
    # Install dependencies based on package manager
    case "$pkg_manager" in
        apt)
            spinner_run "Updating package lists..." apt-get update -qq
            spinner_run "Installing packages..." apt-get install -y -qq \
                git \
                curl \
                unzip \
                zstd \
                supervisor \
                python3-pip \
                iproute2 \
                coreutils
            systemctl enable supervisor 2>/dev/null || true
            systemctl start supervisor 2>/dev/null || true
            ;;
        dnf|yum)
            spinner_run "Installing packages..." "$pkg_manager" install -y -q \
                git \
                curl \
                unzip \
                zstd \
                supervisor \
                python3-pip \
                iproute \
                coreutils
            systemctl enable supervisord 2>/dev/null || true
            systemctl start supervisord 2>/dev/null || true
            ;;
        pacman)
            spinner_run "Updating package lists..." pacman -Syu --noconfirm
            spinner_run "Installing packages..." pacman -S --noconfirm \
                git \
                curl \
                unzip \
                zstd \
                supervisor \
                python-pip \
                iproute2 \
                coreutils
            systemctl enable supervisord 2>/dev/null || true
            systemctl start supervisord 2>/dev/null || true
            ;;
        zypper)
            spinner_run "Refreshing repositories..." zypper refresh
            spinner_run "Installing packages..." zypper install -y \
                git \
                curl \
                unzip \
                zstd \
                supervisor \
                python3-pip \
                iproute2 \
                coreutils
            systemctl enable supervisor 2>/dev/null || true
            systemctl start supervisor 2>/dev/null || true
            ;;
    esac
    
    # Verify critical dependencies
    local missing_deps=()
    for cmd in git curl unzip python3 pip3; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        step_fail
        log_error "Failed to install some dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    step_ok
}

create_directories() {
    step_start "Creating directory structure"
    
    mkdir -p "$E3CNC_DIR"/{releases,instances,backups,logs}
    chmod 700 "$E3CNC_DIR/backups"
    
    step_ok
}

download_binary() {
    step_start "Downloading E3CNC binary"
    local arch="$1"
    local temp_file="/tmp/$BINARY_NAME"
    local latest_url="https://api.github.com/repos/E3CNC/E3CNC/releases/latest"
    local tag_name
    local download_url
    
    # Query GitHub API for latest release
    local api_response
    if ! api_response=$(spinner_run "Fetching latest release info..." curl -fsSL "$latest_url" 2>/dev/null); then
        step_fail
        log_error "Failed to fetch latest release info from GitHub API"
        log_info "Please download the binary manually and place at $INSTALL_DIR/$BINARY_NAME"
        exit 1
    fi
    
    # Extract tag name (try jq first, fallback to grep/sed)
    if command -v jq &> /dev/null; then
        tag_name=$(echo "$api_response" | jq -r '.tag_name' 2>/dev/null)
    else
        tag_name=$(echo "$api_response" | grep -oP '"tag_name":\s*"\K[^"]+' | head -1)
    fi
    
    if [[ -z "$tag_name" ]]; then
        step_fail
        log_error "Could not determine latest release tag"
        exit 1
    fi
    
    download_url="https://github.com/E3CNC/E3CNC/releases/download/$tag_name/$BINARY_NAME-linux-$arch"
    
    if spinner_run "Downloading $BINARY_NAME for $arch..." curl -fsSL "$download_url" -o "$temp_file"; then
        chmod +x "$temp_file"
        
        if [[ ! -x "$temp_file" ]]; then
            step_fail
            log_error "Downloaded binary is not executable"
            rm -f "$temp_file"
            exit 1
        fi
        
        mv "$temp_file" "$INSTALL_DIR/$BINARY_NAME"
        step_ok
    else
        step_fail
        log_error "Failed to download binary from $download_url"
        log_info "Please download manually and place at $INSTALL_DIR/$BINARY_NAME"
        exit 1
    fi
}

verify_binary() {
    step_start "Verifying binary"
    if [[ -x "$INSTALL_DIR/$BINARY_NAME" ]]; then
        local version
        version=$("$INSTALL_DIR/$BINARY_NAME" --version 2>/dev/null || echo "unknown")
        step_ok
        return 0
    else
        step_fail
        log_error "Binary not found or not executable at $INSTALL_DIR/$BINARY_NAME"
        return 1
    fi
}

verify_binary_capabilities() {
    step_start "Verifying binary capabilities"
    
    local binary="$INSTALL_DIR/$BINARY_NAME"
    local help_output
    local missing_commands=()
    
    # Check if binary responds to --help
    if ! help_output=$("$binary" --help 2>&1); then
        step_fail
        log_error "Binary does not respond to --help"
        return 1
    fi
    
    # Check for required commands
    local required_commands=("install" "status")
    
    for cmd in "${required_commands[@]}"; do
        if ! echo "$help_output" | grep -qw "$cmd"; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_warn "Binary may be incomplete or too old. Missing commands: ${missing_commands[*]}"
        log_warn "The installer may fail. Consider downloading a newer version."
        
        if [[ "${UNATTENDED:-false}" != "true" ]]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                step_fail
                exit 1
            fi
        fi
        step_ok
    else
        step_ok
    fi
    
    # Check version (warn if very old)
    local version
    version=$("$binary" --version 2>/dev/null | grep -oP 'v[0-9]+\.[0-9]+' | head -1)
    
    if [[ -n "$version" ]]; then
        local major minor
        major=$(echo "$version" | cut -d. -f1 | tr -d 'v')
        minor=$(echo "$version" | cut -d. -f2)
        
        # Warn if version is older than v0.9
        if [[ $major -lt 1 && $minor -lt 9 ]]; then
            log_warn "Binary version ($version) is quite old. Some features may not work."
            log_warn "Consider downloading a newer release."
        fi
    fi
}

configure_supervisor() {
    step_start "Configuring supervisor"
    
    # Get the actual user who ran sudo
    local current_user="${SUDO_USER:-$(whoami)}"
    local user_home
    
    # Get user's home directory
    if [[ "$current_user" == "root" ]]; then
        user_home="/root"
    else
        user_home=$(getent passwd "$current_user" | cut -d: -f6)
    fi
    
    # Create temporary supervisor config
    cat > "$SUPERVISOR_CONF" << EOF
[program:moonraker]
command=$E3CNC_DIR/releases/current/bin/moonraker
directory=$E3CNC_DIR/releases/current
user=$current_user
autostart=true
autorestart=true
stdout_logfile=$E3CNC_DIR/logs/moonraker.log
stderr_logfile=$E3CNC_DIR/logs/moonraker.err
environment=HOME="$user_home"

[program:klipper]
command=$E3CNC_DIR/releases/current/bin/klipper $E3CNC_DIR/instances/%(process_num)s/config/printer.cfg
directory=$E3CNC_DIR/releases/current
user=$current_user
autostart=true
autorestart=true
stdout_logfile=$E3CNC_DIR/logs/klipper_%(process_num)s.log
stderr_logfile=$E3CNC_DIR/logs/klipper_%(process_num)s.err
numprocs=1
process_name=%(program_name)_%(process_num)s
environment=HOME="$user_home"

[program:avahi-publish]
command=avahi-publish-address -R
user=$current_user
autostart=true
autorestart=true
stdout_logfile=$E3CNC_DIR/logs/avahi.log
stderr_logfile=$E3CNC_DIR/logs/avahi.err
EOF
    
    # Reload supervisor config
    spinner_run "Reloading supervisor config..." bash -c "supervisorctl reread && supervisorctl update"
    
    step_ok
}

update_supervisor_paths() {
    step_start "Updating supervisor paths"
    
    # Get the actual user who ran sudo
    local current_user="${SUDO_USER:-$(whoami)}"
    local user_home
    
    if [[ "$current_user" == "root" ]]; then
        user_home="/root"
    else
        user_home=$(getent passwd "$current_user" | cut -d: -f6)
    fi
    
    # Find actual moonraker/klipper binaries
    # First check common locations, then use find as fallback
    local moonraker_bin=""
    local klipper_bin=""
    
    # Common binary locations to check first
    local common_paths=(
        "$E3CNC_DIR/releases/current/bin"
        "$E3CNC_DIR/releases/current"
        "$E3CNC_DIR/venv/bin"
    )
    
    for path in "${common_paths[@]}"; do
        if [[ -z "$moonraker_bin" && -f "$path/moonraker" ]]; then
            moonraker_bin="$path/moonraker"
        fi
        if [[ -z "$klipper_bin" && -f "$path/klipper" ]]; then
            klipper_bin="$path/klipper"
        fi
    done
    
    # Fallback to find if not found in common paths
    if [[ -z "$moonraker_bin" ]]; then
        log_warn "Moonraker not found in common paths, searching..."
        moonraker_bin=$(find "$E3CNC_DIR/releases/current" -name "moonraker" -type f 2>/dev/null | head -1)
    fi
    
    if [[ -z "$klipper_bin" ]]; then
        log_warn "Klipper not found in common paths, searching..."
        klipper_bin=$(find "$E3CNC_DIR/releases/current" -name "klipper" -type f 2>/dev/null | head -1)
    fi
    
    if [[ -z "$moonraker_bin" ]]; then
        log_warn "Moonraker binary not found, using placeholder path"
        moonraker_bin="$E3CNC_DIR/releases/current/bin/moonraker"
    fi
    
    if [[ -z "$klipper_bin" ]]; then
        log_warn "Klipper binary not found, using placeholder path"
        klipper_bin="$E3CNC_DIR/releases/current/bin/klipper"
    fi
    
    log_info "Found binaries: moonraker=$moonraker_bin, klipper=$klipper_bin"
    
    # Update supervisor config with actual paths
    if [[ -f "$SUPERVISOR_CONF" ]]; then
        sed -i "s|command=.*moonraker|command=$moonraker_bin|g" "$SUPERVISOR_CONF"
        sed -i "s|command=.*klipper|command=$klipper_bin|g" "$SUPERVISOR_CONF"
        
        spinner_run "Reloading supervisor config..." bash -c "supervisorctl reread && supervisorctl update"
        
        step_ok
    else
        log_warn "Supervisor config not found, skipping path update"
        step_skip
    fi
}

check_ports() {
    step_start "Checking port availability"
    
    local conflicts=()
    for port in "${PORTS[@]}"; do
        if ! check_port "$port"; then
            conflicts+=("$port")
        fi
    done
    
    if [[ ${#conflicts[@]} -gt 0 ]]; then
        log_warn "The following ports are already in use: ${conflicts[*]}"
        log_warn "Services may fail to start. Consider stopping conflicting services."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            step_fail
            exit 1
        fi
        step_ok
    else
        step_ok
    fi
}

start_services() {
    step_start "Starting services"
    
    spinner_run "Starting supervisor services..." supervisorctl start all
    
    # Wait for services to be ready
    wait_for_service 7125 "Moonraker"
    wait_for_service 8081 "Admin UI"
    
    step_ok
}

get_instance_config() {
    step_start "Configuring instance"
    
    if [[ "${UNATTENDED:-false}" == "true" ]]; then
        INSTANCE_NAME="default"
        CONTROLLER_TYPE="BTT-CB1"
    else
        printf "\r  "; read -p "Enter instance name (default: default): " INSTANCE_NAME
        INSTANCE_NAME=${INSTANCE_NAME:-default}
        
        echo "  Select controller type:"
        echo "    1) BTT-CB1"
        echo "    2) Raspberry-Pi4"
        echo "    3) Octopus-Pro"
        echo "    4) Custom"
        printf "  "; read -p "Choice [1-4]: " -n 1 -r
        echo
        
        case $REPLY in
            1) CONTROLLER_TYPE="BTT-CB1" ;;
            2) CONTROLLER_TYPE="Raspberry-Pi4" ;;
            3) CONTROLLER_TYPE="Octopus-Pro" ;;
            4) CONTROLLER_TYPE="Custom" ;;
            *) 
                log_warn "Invalid choice, defaulting to BTT-CB1"
                CONTROLLER_TYPE="BTT-CB1"
                ;;
        esac
    fi
    
    log_info "Instance name: $INSTANCE_NAME"
    log_info "Controller type: $CONTROLLER_TYPE"
    step_ok
}

initialize_instance() {
    step_start "Initializing instance '$INSTANCE_NAME'"
    
    echo "  Interactive input required for instance configuration"
    echo "  Please follow the prompts from e3cnc-tui install"
    echo
    
    # Run the TUI install command interactively
    "$INSTALL_DIR/$BINARY_NAME" install --name "$INSTANCE_NAME"
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        step_ok
    else
        step_fail
        log_error "Failed to initialize instance (exit code: $exit_code)"
        log_info "You can try running manually: $INSTALL_DIR/$BINARY_NAME install --name $INSTANCE_NAME"
        exit 1
    fi
}

print_next_steps() {
    local ip="$1"
    
    echo
    progress_bar $TOTAL_STEPS $TOTAL_STEPS
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}          ${BOLD}INSTALLATION COMPLETE${NC}            ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}Next Steps:${NC}"
    echo "  1. Open browser → http://$ip:8081"
    echo "  2. Verify DRO shows correct position"
    echo "  3. Test jog controls (XY/Z feedrate sliders)"
    echo "  4. Run: e3cnc-tui status"
    echo "  5. Check config: $E3CNC_DIR/instances/$INSTANCE_NAME/config/printer.cfg"
    echo
    echo -e "  ${YELLOW}Installation log:${NC} $LOG_FILE"
    echo
}

# ─── Main Installer Logic ─────────────────────────────────────────────────────
main() {
    # Parse arguments
    UNATTENDED=false
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --unattended)
                UNATTENDED=true
                shift
                ;;
            --dir)
                if [[ -z "${2:-}" ]]; then
                    log_error "--dir requires a path argument"
                    exit 1
                fi
                E3CNC_DIR="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: sudo $0 [OPTIONS]"
                echo
                echo "Options:"
                echo "  --unattended    Run without prompts (use defaults)"
                echo "  --dir <path>    Specify custom installation directory"
                echo "  --help, -h      Show this help message"
                echo
                echo "Environment variables:"
                echo "  E3CNC_DIR        Set installation directory"
                echo "                      Default: \$HOME/e3cnc (auto-updated for sudo user)"
                echo "                      Tip: Use --dir flag instead when running with sudo"
                echo
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Pre-flight checks
    if [[ $EUID -ne 0 ]]; then
        log_error "This installer must be run with sudo"
        echo "Usage: sudo $0 [--unattended]"
        exit 1
    fi
    
    # Fix E3CNC_DIR when running with sudo
    # If E3CNC_DIR is still the default ($HOME/e3cnc) and we're running with sudo,
    # update it to use the sudo user's home directory
    if [[ "$E3CNC_DIR" == "$HOME/e3cnc" && -n "${SUDO_USER:-}" ]]; then
        local sudo_user_home
        sudo_user_home=$(getent passwd "$SUDO_USER" | cut -d: -f6)
        E3CNC_DIR="$sudo_user_home/e3cnc"
        log_info "Updated E3CNC_DIR to: $E3CNC_DIR (sudo user: $SUDO_USER)"
    fi
    
    # Update derived paths
    BACKUP_DIR="$E3CNC_DIR.backup.$(date +%Y%m%d_%H%M%S)"
    LOG_FILE="$E3CNC_DIR/logs/installer.log"
    
    echo
    echo -e "  ${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}║${NC}  ${BOLD}E3CNC Installer${NC}                           ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}  Version: ${CYAN}$INSTALL_VERSION${NC}                       ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}  Hostname: ${YELLOW}$(hostname)${NC}                      ${GREEN}║${NC}"
    echo -e "  ${GREEN}║${NC}  Arch: ${YELLOW}$(detect_architecture)${NC}                            ${GREEN}║${NC}"
    echo -e "  ${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo
    
    # Run installation steps
    backup_existing
    check_ports
    install_dependencies
    create_directories
    
    local arch
    arch=$(detect_architecture)
    download_binary "$arch"
    verify_binary
    verify_binary_capabilities
    
    configure_supervisor
    start_services
    
    get_instance_config
    initialize_instance
    
    # Update supervisor paths with actual binary locations
    update_supervisor_paths
    
    # Restart services to pick up updated paths
    spinner_run "Restarting services..." bash -c "supervisorctl restart all && sleep 2"
    
    local host_ip
    host_ip=$(detect_ip)
    
    print_next_steps "$host_ip"
}

# ─── Run Installer ───────────────────────────────────────────────────────────
main "$@"
