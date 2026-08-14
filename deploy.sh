#!/bin/bash

# ============================================================
#   AWS Monitoring Dashboard - Auto Deploy Script (Ubuntu)
#   Just fill in the variables below and run this script!
# ============================================================

# -------  FILL THESE IN BEFORE RUNNING  -------
GITHUB_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"
AWS_REGION="ap-south-1"
PORT="3000"
# -----------------------------------------------

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the public IP of this EC2 instance automatically
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  AWS Monitoring Dashboard - Auto Deployer  ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# ---- STEP 1: Update Ubuntu System ----
echo -e "${YELLOW}[1/7] Updating Ubuntu system packages...${NC}"
sudo apt update -y && sudo apt upgrade -y > /dev/null 2>&1
echo -e "${GREEN}      ✅ System updated successfully.${NC}"

# ---- STEP 2: Install Node.js v20 ----
echo -e "${YELLOW}[2/7] Installing Node.js v20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
sudo apt install -y nodejs > /dev/null 2>&1
NODE_VERSION=$(node --version)
echo -e "${GREEN}      ✅ Node.js installed: ${NODE_VERSION}${NC}"

# ---- STEP 3: Install Git ----
echo -e "${YELLOW}[3/7] Installing Git...${NC}"
sudo apt install -y git > /dev/null 2>&1
GIT_VERSION=$(git --version)
echo -e "${GREEN}      ✅ Git installed: ${GIT_VERSION}${NC}"

# ---- STEP 4: Clone GitHub Repository ----
echo -e "${YELLOW}[4/7] Cloning repository from GitHub...${NC}"

# Extract folder name from repo URL
REPO_FOLDER=$(basename "$GITHUB_REPO" .git)

# Remove folder if it already exists (for re-runs)
if [ -d "$REPO_FOLDER" ]; then
    echo -e "${BLUE}      ℹ️  Existing folder found. Removing and re-cloning...${NC}"
    rm -rf "$REPO_FOLDER"
fi

git clone "$GITHUB_REPO" > /dev/null 2>&1
cd "$REPO_FOLDER" || { echo -e "${RED}      ❌ Failed to enter project folder. Check your GitHub URL.${NC}"; exit 1; }
echo -e "${GREEN}      ✅ Repository cloned successfully.${NC}"

# ---- STEP 5: Create .env file ----
echo -e "${YELLOW}[5/7] Creating .env configuration file...${NC}"
cat > .env << EOF
PORT=${PORT}
USE_MOCK_DATA=false
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
EOF
echo -e "${GREEN}      ✅ .env file created (using IAM Role for AWS credentials).${NC}"

# ---- STEP 6: Install Node packages ----
echo -e "${YELLOW}[6/7] Installing project dependencies (npm install)...${NC}"
npm install > /dev/null 2>&1
echo -e "${GREEN}      ✅ Dependencies installed successfully.${NC}"

# ---- STEP 7: Install PM2 and Start App ----
echo -e "${YELLOW}[7/7] Installing PM2 and starting the dashboard...${NC}"
sudo npm install -g pm2 > /dev/null 2>&1

# Stop existing instance if running
pm2 delete aws-dashboard > /dev/null 2>&1

# Start fresh
pm2 start server.js --name "aws-dashboard" > /dev/null 2>&1

# Auto-start on system reboot
pm2 startup systemd -u ubuntu --hp /home/ubuntu > /dev/null 2>&1
pm2 save > /dev/null 2>&1

echo -e "${GREEN}      ✅ Dashboard started with PM2 (will auto-restart on reboot).${NC}"

# ---- DONE ----
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${GREEN}  🚀 DEPLOYMENT SUCCESSFUL!                 ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "${GREEN}  ✅ Dashboard is LIVE at:${NC}"
echo ""
echo -e "${YELLOW}  👉  http://${PUBLIC_IP}:${PORT}${NC}"
echo ""
echo -e "${CYAN}  Useful PM2 Commands:${NC}"
echo -e "  ${BLUE}pm2 status${NC}           - Check if app is running"
echo -e "  ${BLUE}pm2 logs aws-dashboard${NC} - View live app logs"
echo -e "  ${BLUE}pm2 restart aws-dashboard${NC} - Restart the app"
echo -e "  ${BLUE}pm2 stop aws-dashboard${NC}    - Stop the app"
echo ""
echo -e "${CYAN}=============================================${NC}"
