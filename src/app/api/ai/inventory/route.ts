import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiInventoryService } from '@/lib/ai/inventoryService';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const organizationId = session.user.organizationId;

    // Get data for AI analysis
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }
    const products = await prisma.product.findMany({
      where: { organizationId },
      include: { category: true },
    });

    const orders = await prisma.order.findMany({
      where: { organizationId },
      include: { items: true },
    });

    const salesHistory = orders.map((order: any) => ({
      orderId: order.id,
      date: order.createdAt,
      items: order.items,
      total: order.total,
    }));

    switch (type) {
      case 'stockout-predictions':
        const predictions = await aiInventoryService.predictStockoutRisk(
          products,
          salesHistory,
          products.map((p: any) => ({ productId: p.id, currentStock: p.stock }))
        );
        return NextResponse.json({ predictions });

      case 'seasonal-trends':
        const timeRange = {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
          end: new Date(),
        };
        const trends = await aiInventoryService.analyzeSeasonalTrends(
          salesHistory,
          timeRange
        );
        return NextResponse.json({ trends });

      case 'supplier-performance':
        if (!organizationId) {
          return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }
        const suppliers = await prisma.supplier.findMany({
          where: { organizationId },
        });
        const supplierPerformance = await aiInventoryService.evaluateSupplierPerformance(
          suppliers.map(s => ({
            supplierId: s.id,
            supplierName: s.name,
            averageDeliveryTime: 0,
            qualityScore: s.rating || 0,
            reliabilityScore: s.rating || 0,
            costEffectiveness: 0,
            recommendations: [],
          })),
          orders
        );
        return NextResponse.json({ supplierPerformance });

      case 'purchase-orders':
        const predictionsForPO = await aiInventoryService.predictStockoutRisk(
          products,
          salesHistory,
          products.map((p: any) => ({ productId: p.id, currentStock: p.stockQuantity }))
        );
        if (!organizationId) {
          return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }
        const suppliersForPO = await prisma.supplier.findMany({
          where: { organizationId },
        });
        const purchaseOrders = await aiInventoryService.generatePurchaseOrders(
          predictionsForPO,
          suppliersForPO.map(s => ({
            supplierId: s.id,
            supplierName: s.name,
            averageDeliveryTime: 0,
            qualityScore: s.rating || 0,
            reliabilityScore: s.rating || 0,
            costEffectiveness: 0,
            recommendations: [],
          }))
        );
        return NextResponse.json({ purchaseOrders });

      case 'pricing-optimization':
        const competitorPrices: any[] = []; // This would come from competitor data
        const pricingRecommendations = await aiInventoryService.optimizePricing(
          products,
          salesHistory,
          competitorPrices
        );
        return NextResponse.json({ pricingRecommendations });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch {
    console.error('Error in AI inventory API');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { action, data } = body;
    const organizationId = session.user.organizationId;

    switch (action) {
      case 'generate-purchase-order':
        const purchaseOrder = await prisma.purchaseOrder.create({
          data: {
            ...data,
            organizationId,
            supplierId: data.supplierId,
            orderNumber: `PO-${Date.now()}`,
            status: 'DRAFT',
            totalAmount: data.totalAmount || 0,
            items: data.items || [],
            createdBy: session.user.id,
          },
        });
        return NextResponse.json({ purchaseOrder });

      case 'update-pricing':
        // Update product pricing based on AI recommendations
        const { productId, newPrice } = data;
        if (!organizationId) {
          return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }
        const updatedProduct = await prisma.product.update({
          where: { id: productId, organizationId },
          data: { price: newPrice },
        });
        return NextResponse.json({ updatedProduct });

      case 'set-reorder-points':
        // Set reorder points based on AI predictions
        const { productId: productIdForReorder, reorderPoint } = data;
        if (!organizationId) {
          return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }
        const product = await prisma.product.update({
          where: { id: productIdForReorder, organizationId },
          data: { lowStockThreshold: reorderPoint },
        });
        return NextResponse.json({ product });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    console.error('Error in AI inventory API POST');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 