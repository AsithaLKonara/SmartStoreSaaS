import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShopifyService } from '@/lib/integrations/shopify/shopifyService';
import { ShopifyWebhookService } from '@/lib/integrations/shopify/shopifyWebhookService';

export async function POST(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const organizationId = params.organizationId;
    const signature = request.headers.get('x-shopify-hmac-sha256');
    const topic = request.headers.get('x-shopify-topic');

    if (!signature || !topic) {
      return NextResponse.json({ message: 'Missing headers' }, { status: 400 });
    }

    const integration = await prisma.shopifyIntegration.findFirst({
      where: { organizationId },
    });

    if (!integration || !integration.webhookSecret) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    const body = await request.text();

    // Verify webhook signature
    const isValid = ShopifyWebhookService.verifyWebhook(
      body,
      signature,
      integration.webhookSecret
    );

    if (!isValid) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(body);

    const shopifyService = new ShopifyService(
      integration.id,
      integration.shopDomain,
      integration.accessToken
    );

    // Handle webhook
    await ShopifyWebhookService.handleWebhook(
      organizationId,
      topic,
      data,
      shopifyService
    );

    return NextResponse.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

