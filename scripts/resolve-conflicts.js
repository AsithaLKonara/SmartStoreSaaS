const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesWithConflicts = [
  'prisma/seed.ts',
  'src/app/api/couriers/deliveries/route.ts',
  'src/app/api/chat/conversations/route.ts',
  'src/app/api/chat/conversations/[conversationId]/messages/route.ts',
  'src/app/api/chat/ai/route.ts',
  'src/app/api/social-commerce/route.ts',
  'src/app/api/expenses/route.ts',
  'src/app/api/workflows/advanced/route.ts',
  'src/app/api/integrations/setup/route.ts',
  'src/app/api/pwa/route.ts',
  'src/app/api/webhooks/whatsapp/route.ts',
  'src/components/search/AdvancedSearch.tsx',
  'src/components/ar/ARProductViewer.tsx',
  'src/components/analytics/RealTimeChart.tsx',
  'src/hooks/usePWA.ts',
  'src/lib/woocommerce/woocommerceService.ts',
  'src/lib/bulk/bulkOperationsService.ts',
  'src/lib/courier/sriLankaCourierService.ts',
  'src/lib/sms/smsService.ts',
  'src/lib/security/advancedSecurityService.ts',
  'src/lib/auth/mfaService.ts',
  'src/lib/marketplace/marketplaceService.ts',
  'src/lib/workflows/advancedWorkflowEngine.ts',
  'src/lib/workflows/workflowEngine.ts',
  'src/lib/iot/iotService.ts',
  'src/lib/subscription/subscriptionService.ts',
  'src/lib/social/socialCommerceService.ts',
  'src/lib/blockchain/blockchainService.ts',
  'src/lib/messenger/messengerService.ts',
  'src/lib/voice/voiceCommerceService.ts',
  'src/lib/ml/personalizationEngine.ts',
  'src/lib/ai/chatService.ts',
  'src/lib/ai/analyticsService.ts',
  'src/lib/ai/businessIntelligenceService.ts',
  'src/lib/ai/visualSearchService.ts',
  'src/lib/ai/customerIntelligenceService.ts',
  'src/lib/ai/inventoryService.ts',
  'src/lib/pwa/pwaService.ts',
  'src/lib/sync/realTimeSyncService.ts',
  'src/lib/barcode/barcodeService.ts',
  'src/lib/messaging/index.ts',
  'src/lib/email/emailService.ts',
];

function resolveConflicts(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${filePath} - file not found`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove conflict markers and keep HEAD version (between <<<<<<< HEAD and =======)
    content = content.replace(/<<<<<<< HEAD\n([\s\S]*?)=======[\s\S]*?>>>>>>> [^\n]+\n/g, '$1');
    
    // Also handle cases where there's no newline after >>>>>>>
    content = content.replace(/<<<<<<< HEAD\n([\s\S]*?)=======[\s\S]*?>>>>>>> [^\n]+/g, '$1');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed conflicts in ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;
filesWithConflicts.forEach(file => {
  if (resolveConflicts(file)) {
    fixedCount++;
  }
});

console.log(`\nFixed ${fixedCount} files with conflicts`);

