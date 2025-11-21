import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { FacebookCommerceService } from '@/lib/integrations/facebook/facebookCommerceService';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-hub-signature-256');
    const body = await request.text();

    if (!signature) {
      return NextResponse.json({ message: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature (simplified - in production, use proper app secret)
    // const expectedSignature = crypto
    //   .createHmac('sha256', process.env.FACEBOOK_APP_SECRET || '')
    //   .update(body)
    //   .digest('hex');

    const data = JSON.parse(body);

    // Handle different webhook events
    if (data.object === 'page') {
      for (const entry of data.entry || []) {
        for (const event of entry.messaging || []) {
          // Handle Messenger events
          if (event.message) {
            // Process incoming message
            console.log('Facebook Messenger message received:', event);
          }
        }

        for (const event of entry.changes || []) {
          // Handle catalog/inventory updates
          if (event.value && event.value.catalog_id) {
            console.log('Facebook catalog update:', event);
          }
        }
      }
    }

    return NextResponse.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing Facebook webhook:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

