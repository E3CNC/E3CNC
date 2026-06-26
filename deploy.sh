#!/bin/bash
# Deploy E3CNC fork to the web server directory.
# Delegates to the Ansible deploy playbook.
#
# Usage: ./deploy.sh [--live]
#   --live  Actually build and deploy (default: dry-run with status)

set -euo pipefail

E3CNC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
DEPLOY_DIR="${MAINSAIL_DEPLOY_DIR:-$HOME/mainsail}"

MODE="dry-run"
if [ "${1:-}" = "--live" ]; then
  MODE="live"
fi

echo "=== E3CNC deploy ==="
echo "  Source:  $E3CNC_DIR"
echo "  Target:  $DEPLOY_DIR"
echo "  Mode:    $MODE"
echo ""

if [ "$MODE" = "dry-run" ]; then
  echo "[dry-run] Would run Ansible frontend deploy playbook:"
  echo "  cd $E3CNC_DIR && ansible-playbook \\"
  echo "    -i ansible/inventory/local.yml \\"
  echo "    ansible/playbooks/deploy.yml \\"
  echo "    --diff --check"
  echo ""
  echo "Run: ./deploy.sh --live  to actually deploy."
  exit 0
fi

cd "$E3CNC_DIR"
ansible-playbook \
  -i ansible/inventory/local.yml \
  ansible/playbooks/deploy.yml \
  --diff

echo ""
echo "deployed E3CNC"
