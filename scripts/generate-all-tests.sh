#!/bin/bash
# Batch generate tests for all routes in config

echo "🚀 Generating tests for all routes in config..."

# Core routes that need tests
ROUTES=(
  "/api/products/bulk-delete"
  "/api/analytics/dashboard-stats"
)

# Integration routes
INTEGRATION_ROUTES=(
  "/api/integrations/shopify"
  "/api/integrations/facebook"
  "/api/integrations/instagram"
  "/api/integrations/tiktok"
  "/api/integrations/pinterest"
  "/api/integrations/magento"
  "/api/integrations/woocommerce"
  "/api/integrations/crm"
  "/api/integrations/accounting"
  "/api/integrations/setup"
)

# AI routes
AI_ROUTES=(
  "/api/ai/business-intelligence"
  "/api/ai/customer-intelligence"
  "/api/ai/ml/predict"
  "/api/ai/ml/train"
  "/api/ai/analytics/advanced"
  "/api/ai/analytics/inventory"
)

# Other routes
OTHER_ROUTES=(
  "/api/search/advanced"
  "/api/omnichannel"
)

ALL_ROUTES=("${ROUTES[@]}" "${INTEGRATION_ROUTES[@]}" "${AI_ROUTES[@]}" "${OTHER_ROUTES[@]}")

for route in "${ALL_ROUTES[@]}"; do
  echo ""
  echo "📝 Generating test for: $route"
  npx ts-node scripts/generate-route-test.ts "$route" || echo "⚠️  Failed to generate test for $route"
done

echo ""
echo "✅ Test generation complete!"
echo "📊 Run 'npm test' to verify all tests pass"

