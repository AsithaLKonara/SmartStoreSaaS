import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { customerIntelligenceService } from '../../../../lib/ai/customerIntelligenceService';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const customerId = searchParams.get('customerId');
    const organizationId = (session.user as any).organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    // Get data for AI analysis
    const customers = await prisma.customer.findMany({
      where: { organizationId: organizationId || '' },
      include: { orders: true },
    });

    const orders = await prisma.order.findMany({
      where: { organizationId: organizationId || '' },
      include: { items: true, customer: true },
    });

    const purchaseHistory = orders.map((order: any) => ({
      orderId: order.id,
      customerId: order.customerId,
      date: order.createdAt,
      items: order.items,
      total: order.totalAmount,
    }));

    // Filter CustomerActivity through customer relationship
    const interactionHistory = await prisma.customerActivity.findMany({
      where: {
        customer: {
          organizationId: organizationId
        }
      },
      include: {
        customer: true
      }
    });

    switch (type) {
      case 'customer-ltv':
        const ltvPredictions = await customerIntelligenceService.predictCustomerLTV(
          customers,
          purchaseHistory,
          interactionHistory
        );
        return NextResponse.json({ ltvPredictions });

      case 'churn-risk':
        const churnRisk = await customerIntelligenceService.assessChurnRisk(
          customers,
          purchaseHistory,
          interactionHistory
        );
        return NextResponse.json({ churnRisk });

      case 'customer-segments':
        const behaviorData = customers.map((customer: any) => ({
          customerId: customer.id,
          totalOrders: customer.orders.length,
          totalSpent: customer.totalSpent,
          lastPurchaseDate: customer.orders[0]?.createdAt,
          averageOrderValue: customer.totalSpent / customer.orders.length || 0,
        }));
        const segments = await customerIntelligenceService.createCustomerSegments(
          customers,
          purchaseHistory,
          behaviorData
        );
        return NextResponse.json({ segments });

      case 'product-recommendations':
        const productCatalog = await prisma.product.findMany({
          where: { organizationId: organizationId || '' },
        });
        const recommendations = await customerIntelligenceService.generateProductRecommendations(
          customers,
          purchaseHistory,
          productCatalog
        );
        return NextResponse.json({ recommendations });

      case 'sentiment-analysis':
        const reviews = await prisma.review.findMany({
          where: { organizationId: organizationId || '' },
        });
        const supportTickets = await prisma.supportTicket.findMany({
          where: { organizationId: organizationId || '' },
        });
        const socialMediaData: any[] = []; // This would come from social media APIs
        const sentiment = await customerIntelligenceService.analyzeCustomerSentiment(
          customers,
          reviews,
          supportTickets,
          socialMediaData
        );
        return NextResponse.json({ sentiment });

      case 'purchase-patterns':
        const patterns = await customerIntelligenceService.analyzePurchasePatterns(
          customers,
          purchaseHistory
        );
        return NextResponse.json({ patterns });

      case 'customer-detail':
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }
        
        const customer = customers.find((c: any) => c.id === customerId);
        if (!customer) {
          return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const customerLTV = await customerIntelligenceService.predictCustomerLTV(
          [customer],
          purchaseHistory.filter((p: any) => p.customerId === customerId),
          interactionHistory.filter((i: any) => i.customerId === customerId)
        );

        const customerChurnRisk = await customerIntelligenceService.assessChurnRisk(
          [customer],
          purchaseHistory.filter((p: any) => p.customerId === customerId),
          interactionHistory.filter((i: any) => i.customerId === customerId)
        );

        const customerRecommendations = await customerIntelligenceService.generateProductRecommendations(
          [customer],
          purchaseHistory.filter((p: any) => p.customerId === customerId),
          await prisma.product.findMany({ where: { organizationId: organizationId || '' } })
        );

        return NextResponse.json({
          customer,
          ltv: customerLTV[0],
          churnRisk: customerChurnRisk[0],
          recommendations: customerRecommendations,
        });

      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in customer intelligence API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const organizationId = (session.user as any).organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    switch (action) {
      case 'create-customer-segment':
        // Create a new customer segment based on AI analysis
        const segment = await prisma.customerSegment.create({
          data: {
            ...data,
            organizationId,
          },
        });
        return NextResponse.json({ segment });

      case 'send-personalized-offer':
        // Send personalized offer to customer based on AI recommendations
        const { customerId, offerType, offerData } = data;
        
        // Create offer record
        const offer = await prisma.customerOffer.create({
          data: {
            name: `Personalized ${offerType} Offer`,
            description: `AI-generated personalized offer for customer ${customerId}`,
            discountType: offerData.discountType || 'percentage',
            discountValue: offerData.discountValue || 10,
            minOrderValue: offerData.minOrderValue || 0,
            maxDiscount: offerData.maxDiscount,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            organizationId,
          },
        });

        // Create customer-offer relationship
        await prisma.customerOfferCustomer.create({
          data: {
            customerOfferId: offer.id,
            customerId,
            organizationId,
          },
        });

        // Send notification (placeholder)
        console.log(`Sending personalized offer to customer ${customerId}: ${offerType}`);

        return NextResponse.json({ offer });

      case 'update-customer-tags':
        // Update customer tags based on AI analysis
        const { customerId: customerIdForTags, tags } = data;
        const updatedCustomer = await prisma.customer.update({
          where: { id: customerIdForTags, organizationId },
          data: { tags },
        });
        return NextResponse.json({ customer: updatedCustomer });

      case 'create-retention-campaign':
        // Create retention campaign for high churn risk customers
        const campaign = await prisma.campaign.create({
          data: {
            ...data,
            organizationId,
            type: 'RETENTION',
          },
        });
        return NextResponse.json({ campaign });

      case 'log-customer-interaction':
        // Log customer interaction for AI analysis
        const interaction = await prisma.customerActivity.create({
          data: {
            type: data.type,
            description: data.description,
            metadata: data.metadata,
            customerId: data.customerId,
          },
        });
        return NextResponse.json({ interaction });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in customer intelligence API POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 