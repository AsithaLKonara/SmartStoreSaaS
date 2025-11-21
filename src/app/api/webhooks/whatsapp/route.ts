import { NextRequest, NextResponse } from 'next/server';
import { whatsAppService } from '@/lib/whatsapp/whatsappService';
import { prisma } from '@/lib/prisma';

export async function POST(_request: NextRequest) {
  try {
    const body = await _request.json();
    
    // Verify webhook signature (implement proper verification)
    const signature = _request.headers.get('x-hub-signature-256');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Process webhook
    const { object, entry } = body;

    if (object === 'whatsapp_business_account') {
      for (const entryItem of entry) {
        for (const change of entryItem.changes) {
          if (change.field === 'messages') {
            await processMessages(change.value.messages || []);
          } else if (change.field === 'message_status') {
            await processMessageStatuses(change.value.statuses || []);
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processMessages(messages: any[]): Promise<void> {
  for (const message of messages) {
    try {
      const whatsappMessage = {
        id: message.id,
        from: message.from,
        to: message.to,
        type: message.type,
        content: message[message.type] || message.text?.body,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        status: 'delivered',
        organizationId: await getOrganizationId(message.to)
      };

      await prisma.whatsAppMessage.create({
        data: {
          id: whatsappMessage.id,
          from: whatsappMessage.from,
          to: whatsappMessage.to,
          type: whatsappMessage.type,
          content: whatsappMessage.content,
          timestamp: whatsappMessage.timestamp,
          status: whatsappMessage.status,
          organizationId: whatsappMessage.organizationId
        }
      });

      // Find or create customer
      const customer = await findOrCreateCustomer(message.from, whatsappMessage.organizationId);
      
      await prisma.whatsAppMessage.update({
        where: { id: whatsappMessage.id },
        data: { customerId: customer.id }
      });

      // Process message content
      await processMessageContent(whatsappMessage, customer);

    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
}

async function processMessageStatuses(statuses: any[]): Promise<void> {
  for (const status of statuses) {
    try {
      await prisma.whatsAppMessage.updateMany({
        where: { id: status.id },
        data: { status: status.status }
      });
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }
}

async function getOrganizationId(phoneNumberId: string): Promise<string> {
  // This should be implemented based on your phone number mapping
  const integration = await prisma.whatsAppIntegration.findFirst({
    where: { phoneNumberId }
  });
  
  return integration?.organizationId || '';
}

async function findOrCreateCustomer(phone: string, organizationId: string): Promise<any> {
  let customer = await prisma.customer.findFirst({
    where: { phone, organizationId }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        phone,
        organizationId,
        name: `WhatsApp User (${phone})`,
        source: 'whatsapp'
      }
    });
  }

  return customer;
}

async function processMessageContent(message: any, customer: any): Promise<void> {
  const content = message.content?.toLowerCase() || '';

  if (content.includes('order') || content.includes('track')) {
    await handleOrderQuery(message, customer);
  } else if (content.includes('product') || content.includes('catalog')) {
    await handleProductQuery(message, customer);
  } else if (content.includes('help') || content.includes('support')) {
    await handleSupportQuery(message, customer);
  } else {
    await whatsAppService.sendTextMessage(
      message.from,
      'Thank you for your message! How can I help you today? You can ask about:\n- Order status\n- Products\n- Support',
      message.organizationId
    );
  }
}

async function handleOrderQuery(message: any, customer: any): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (orders.length === 0) {
    await whatsAppService.sendTextMessage(
      message.from,
      'You don\'t have any orders yet. Would you like to browse our products?',
      message.organizationId
    );
    return;
  }

  const orderList = orders.map((order: any) => 
    `Order #${order.orderNumber}: ${order.status} - $${order.totalAmount}`
  ).join('\n');

    await whatsAppService.sendTextMessage(
    message.from,
    `Here are your recent orders:\n\n${orderList}`,
    message.organizationId
  );
}

async function handleProductQuery(message: any, customer: any): Promise<void> {
  const products = await prisma.product.findMany({
    where: { 
      organizationId: message.organizationId,
      isActive: true,
      stockQuantity: { gt: 0 }
    },
    take: 5
  });

  if (products.length === 0) {
    await whatsAppService.sendTextMessage(
      message.from,
      'No products available at the moment.',
      message.organizationId
    );
    return;
  }

  const productList = products.map((product: any) => 
    `${product.name} - $${product.price} (${product.stockQuantity} in stock)`
  ).join('\n');

    await whatsAppService.sendTextMessage(
    message.from,
    `Here are some of our products:\n\n${productList}\n\nVisit our website to see more!`,
    message.organizationId
  );
}

async function handleSupportQuery(message: any, customer: any): Promise<void> {
    await whatsAppService.sendTextMessage(
    message.from,
    'Our support team is here to help! Please provide your order number or describe your issue, and we\'ll get back to you soon.',
    message.organizationId
  );
} 