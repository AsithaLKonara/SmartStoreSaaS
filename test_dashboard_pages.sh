#!/bin/bash
echo "=== Testing All Dashboard Pages ==="
echo ""

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
  "test-harness"
)

for page in "${pages[@]}"; do
  echo "Testing /$page..."
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/$page)
  echo "  Status: $status"
done

echo ""
echo "=== Testing Complete ==="
