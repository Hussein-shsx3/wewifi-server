#!/bin/bash
# Development Setup Script for Subscriber Dashboard

echo "🚀 Setting up Subscriber Dashboard Server..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo -e "${BLUE}Building TypeScript...${NC}"
    npm run build
else
    echo -e "${GREEN}✓ TypeScript already compiled${NC}"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${BLUE}Please update .env with your settings${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Make sure MongoDB is running"
echo "2. Run: npm run dev"
echo "3. Visit: http://localhost:3000"
echo ""
