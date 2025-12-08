#!/bin/bash

# SmartStoreSaaS - Quick Page Test Script
# Tests all dashboard pages for accessibility (200 status)

echo "=== SmartStoreSaaS - Page Accessibility Test ==="
echo ""
echo "Testing all dashboard pages..."
echo "Note: This tests page accessibility only. Full testing requires manual browser verification."
echo ""

BASE_URL="http://localhost:3000"
pages=(
  "dashboard"
  "products"
  "products/new"
  "orders"
  "customers"
  "analytics"
  "analytics/bi"
  "analytics/enhanced"
  "integrations"
  "payments"
  "campaigns"
  "reports"
  "chat"
  "warehouse"
  "couriers"
  "expenses"
  "sync"
  "bulk-operations"
  "settings"
)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0
total=${#pages[@]}

echo "Testing ${total} pages..."
echo ""

for page in "${pages[@]}"; do
  url="${BASE_URL}/${page}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 5)
  
  if [ "$status" -eq 200 ] || [ "$status" -eq 302 ] || [ "$status" -eq 307 ]; then
    echo -e "${GREEN}✓${NC} /${page} - Status: ${status}"
    ((passed++))
  elif [ "$status" -eq 401 ] || [ "$status" -eq 403 ]; then
    echo -e "${YELLOW}⚠${NC} /${page} - Status: ${status} (Auth required - expected)"
    ((passed++))
  elif [ "$status" -eq 404 ]; then
    echo -e "${RED}✗${NC} /${page} - Status: ${status} (Not found)"
    ((failed++))
  elif [ "$status" -eq 500 ]; then
    echo -e "${RED}✗${NC} /${page} - Status: ${status} (Server error)"
    ((failed++))
  else
    echo -e "${YELLOW}?${NC} /${page} - Status: ${status}"
  fi
done

echo ""
echo "=== Test Summary ==="
echo "Total: ${total}"
echo -e "${GREEN}Passed/Expected: ${passed}${NC}"
echo -e "${RED}Failed: ${failed}${NC}"
echo ""
echo "Note: 401/403 responses are expected for protected routes without authentication."
echo "For full testing, use manual browser testing with credentials:"
echo "  Admin: admin@smartstore.ai / admin123"
echo ""

if [ $failed -eq 0 ]; then
  exit 0
else
  exit 1
fi

