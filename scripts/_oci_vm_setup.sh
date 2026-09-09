#!/usr/bin/env bash
# ---------------------------------------------------------------
# OQZARO – Oracle Cloud VM setup helper (run ONCE on the Ubuntu VM)
# Configures ufw, swap, and basic hardening before deploy.
# ---------------------------------------------------------------
set -euo pipefail

echo ">> Updating system..."
apt-get update -qq
apt-get upgrade -y -qq

echo ">> Creating 2G swap (helps if VM is 1GB RAM)..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null 2>&1
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "   swap created."
else
    echo "   swapfile already exists."
fi

echo ">> Configuring firewall (22/80/443)..."
ufw allow 22/tcp  >/dev/null 2>&1 || true
ufw allow 80/tcp  >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
# Rather than enabling ufw here (can lock you out over SSH),
# the deploy script will enable it. Do it explicitly:
#   ufw --force enable
echo "   NOTE: to enable the firewall run:  ufw --force enable"
echo "   (Enable it only after confirming you can still SSH in.)"

echo ""
echo ">> System ready."
echo "   Next: run this once OCI Ingress rules (80/443) are open:"
echo "     sudo bash scripts/_deploy_oracle.sh"
echo ""
