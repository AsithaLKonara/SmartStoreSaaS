#!/bin/bash

# Comprehensive Page Testing Script
# Tests all pages and documents HTTP status, redirects, and API behavior

echo "=== SmartStoreSaaS - Comprehensive Page Test ==="
echo ""
echo "Testing all dashboard pages..."
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

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "Testing ${#pages[@]} pages..."
echo ""

results=()
passed=0
redirected=0
failed=0

for page in "${pages[@]}"; do
  url="${BASE_URL}/${page}"
  
  # Get HTTP status and final URL (follow redirects)
  response=$(curl -s -o /dev/null -w "%{http_code}|%{url_effective}" -L "$url" --max-time 5)
  http_code=$(echo "$response" | cut -d'|' -f1)
  final_url=$(echo "$response" | cut -d'|' -f2)
  
  if [ "$http_code" -eq 200 ]; then
    if [[ "$final_url" == *"/auth/signin"* ]]; then
      echo -e "${YELLOW}⚠${NC} /${page} - Status: ${http_code} (Redirected to sign-in - Protected route)"
      ((redirected++))
      results+=("$page|200|REDIRECT|PROTECTED")
    else
      echo -e "${GREEN}✓${NC} /${page} - Status: ${http_code} (Page accessible)"
      ((passed++))
      results+=("$page|200|OK|ACCESSIBLE")
    fi
  elif [ "$http_code" -eq 404 ]; then
    echo -e "${RED}✗${NC} /${page} - Status: ${http_code} (Not found)"
    ((failed++))
    results+=("$page|404|NOT_FOUND|MISSING")
  elif [ "$http_code" -eq 500 ]; then
    echo -e "${RED}✗${NC} /${page} - Status: ${http_code} (Server error)"
    ((failed++))
    results+=("$page|500|ERROR|SERVER_ERROR")
  else
    echo -e "${BLUE}?${NC} /${page} - Status: ${http_code}"
    results+=("$page|$http_code|UNKNOWN|CHECK_MANUAL")
  fi
done

echo ""
echo "=== Test Summary ==="
echo -e "Total Pages: ${#pages[@]}"
echo -e "${GREEN}Accessible: ${passed}${NC}"
echo -e "${YELLOW}Protected (Redirected): ${redirected}${NC}"
echo -e "${RED}Failed/Not Found: ${failed}${NC}"
echo ""

# Test API endpoints
echo "=== API Endpoints Test ==="
echo ""

api_endpoints=(
  "api/auth/session"
  "api/products"
  "api/orders"
  "api/customers"
  "api/analytics/dashboard-stats"
  "api/payments"
  "api/campaigns"
)

for endpoint in "${api_endpoints[@]}"; do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/${endpoint}" --max-time 3)
  
  if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} /${endpoint} - Status: ${http_code}"
  elif [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
    echo -e "${YELLOW}⚠${NC} /${endpoint} - Status: ${http_code} (Auth required - Expected)"
  elif [ "$http_code" -eq 404 ]; then
    echo -e "${RED}✗${NC} /${endpoint} - Status: ${http_code} (Not found)"
  elif [ "$http_code" -eq 500 ]; then
    echo -e "${RED}✗${NC} /${endpoint} - Status: ${http_code} (Server error)"
  else
    echo -e "${BLUE}?${NC} /${endpoint} - Status: ${http_code}"
  fi
done

echo ""
echo "=== Testing Complete ==="

