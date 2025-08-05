import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // For now, return mock templates since we don't have a templates table
    // In a real implementation, this would come from a campaign_templates table
    const mockTemplates = [
      {
        id: 'template_1',
        name: 'Welcome Email',
        type: 'EMAIL',
        content: 'Welcome to SmartStore AI! We\'re excited to have you as a customer. Use code WELCOME10 for 10% off your first order.',
        variables: ['customer_name', 'discount_code'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'template_2',
        name: 'Order Confirmation SMS',
        type: 'SMS',
        content: 'Your order #{order_number} has been confirmed! Total: ${total_amount}. Track your order at {tracking_url}',
        variables: ['order_number', 'total_amount', 'tracking_url'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'template_3',
        name: 'WhatsApp Promotion',
        type: 'WHATSAPP',
        content: '🎉 Special offer just for you! Get 20% off on all products today. Use code FLASH20. Limited time only!',
        variables: ['discount_code', 'expiry_date'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'template_4',
        name: 'Push Notification',
        type: 'PUSH_NOTIFICATION',
        content: 'New products available! Check out our latest arrivals and get exclusive discounts.',
        variables: ['product_count', 'discount_percentage'],
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json(mockTemplates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, content, variables } = body;

    if (!name || !type || !content) {
      return NextResponse.json({ message: 'Name, type, and content are required' }, { status: 400 });
    }

    // In a real implementation, this would save to a campaign_templates table
    const template = {
      id: `template_${Date.now()}`,
      name,
      type: type as any,
      content,
      variables: variables || [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 