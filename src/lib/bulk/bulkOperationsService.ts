import { prisma } from '../prisma';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export interface BulkOperation {
  id: string;
  type: 'import' | 'export';
  entity: 'products' | 'customers' | 'orders' | 'inventory';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  fileUrl?: string;
  errors: string[];
  metadata?: any;
  createdAt: Date;
  completedAt?: Date;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  errors: string[];
  data?: any[];
}

export interface ExportResult {
  success: boolean;
  fileUrl: string;
  recordCount: number;
  format: 'csv' | 'xlsx' | 'json';
}

export class BulkOperationsService {
  async createBulkOperation(type: 'import' | 'export', entity: string, metadata?: any): Promise<BulkOperation> {
    const operation = await prisma.bulkOperation.create({
      data: {
        name: `${type}_${entity}_${Date.now()}`,
        type,
        entity,
        status: 'pending',
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        errors: [],
        metadata,
        organizationId: metadata?.organizationId || process.env.DEFAULT_ORGANIZATION_ID || 'default',
      }
    });

    return {
      id: operation.id,
      type: operation.type as 'import' | 'export',
      entity: operation.entity as 'products' | 'customers' | 'orders' | 'inventory',
      status: operation.status as 'pending' | 'processing' | 'completed' | 'failed',
      totalRecords: operation.totalRecords,
      processedRecords: operation.processedRecords,
      successRecords: operation.successRecords,
      failedRecords: operation.failedRecords,
      fileUrl: operation.fileUrl || undefined,
      errors: operation.errors,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
      completedAt: operation.completedAt || undefined,
    };
  }

  async importProducts(organizationId: string, fileBuffer: Buffer, format: 'csv' | 'xlsx'): Promise<ImportResult> {
    const operation = await this.createBulkOperation('import', 'products');
    
    try {
      let data: any[];
      
      if (format === 'csv') {
        data = parse(fileBuffer.toString(), {
          columns: true,
          skip_empty_lines: true
        });
      } else {
        const workbook = XLSX.read(fileBuffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: data.length, status: 'processing' }
      });

      const errors: string[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Get category ID if category name is provided
          let categoryId: string | null = null;
          if (row.category) {
            const category = await prisma.category.findFirst({
              where: {
                organizationId,
                name: { equals: row.category, mode: 'insensitive' },
              },
            });
            if (category) {
              categoryId = category.id;
            }
          }

          const slug = (row.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          await prisma.product.create({
            data: {
              name: row.name,
              slug: slug || `product-${Date.now()}`,
              description: row.description || '',
              price: parseFloat(row.price) || 0,
              costPrice: parseFloat(row.cost) || 0,
              sku: row.sku || row.barcode || '',
              weight: parseFloat(row.weight) || 0,
              dimensions: {
                ...(row.dimensions ? JSON.parse(row.dimensions) : {}),
                brand: row.brand || undefined,
                barcode: row.barcode || undefined,
              } as any,
              stockQuantity: parseInt(row.stockQuantity) || 0,
              lowStockThreshold: parseInt(row.reorderPoint) || 0,
              categoryId,
              isActive: row.isActive === 'true' || row.isActive === true,
              organizationId,
              createdById: organizationId,
            },
          });
          successCount++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Row ${i + 1}: ${errorMessage}`);
          failedCount++;
        }
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          processedRecords: data.length,
          successRecords: successCount,
          failedRecords: failedCount,
          errors,
          status: failedCount === 0 ? 'completed' : 'completed',
          completedAt: new Date()
        }
      });

      return {
        success: failedCount === 0,
        totalRecords: data.length,
        processedRecords: data.length,
        successRecords: successCount,
        failedRecords: failedCount,
        errors
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [errorMessage],
          completedAt: new Date()
        }
      });

      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        errors: [errorMessage]
      };
    }
  }

  async importCustomers(organizationId: string, fileBuffer: Buffer, format: 'csv' | 'xlsx'): Promise<ImportResult> {
    const operation = await this.createBulkOperation('import', 'customers');
    
    try {
      let data: any[];
      
      if (format === 'csv') {
        data = parse(fileBuffer.toString(), {
          columns: true,
          skip_empty_lines: true
        });
      } else {
        const workbook = XLSX.read(fileBuffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: data.length, status: 'processing' }
      });

      const errors: string[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Combine address information into a single address field
          const fullAddress = [
            row.address || '',
            row.city || '',
            row.state || '',
            row.country || '',
            row.postalCode || ''
          ].filter(Boolean).join(', ');

          await prisma.customer.create({
            data: {
              name: row.name || '',
              email: row.email || '',
              phone: row.phone || '',
              organizationId,
              tags: [
                ...(row.address ? [`address:${row.address}`] : []),
                ...(row.city ? [`city:${row.city}`] : []),
                ...(row.state ? [`state:${row.state}`] : []),
                ...(row.country ? [`country:${row.country}`] : []),
                ...(row.postalCode ? [`postalCode:${row.postalCode}`] : []),
              ],
            },
          });
          successCount++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Row ${i + 1}: ${errorMessage}`);
          failedCount++;
        }
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          processedRecords: data.length,
          successRecords: successCount,
          failedRecords: failedCount,
          errors,
          status: failedCount === 0 ? 'completed' : 'completed',
          completedAt: new Date()
        }
      });

      return {
        success: failedCount === 0,
        totalRecords: data.length,
        processedRecords: data.length,
        successRecords: successCount,
        failedRecords: failedCount,
        errors
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [errorMessage],
          completedAt: new Date()
        }
      });

      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        errors: [errorMessage]
      };
    }
  }

  async exportProducts(organizationId: string, format: 'csv' | 'xlsx' | 'json'): Promise<ExportResult> {
    const operation = await this.createBulkOperation('export', 'products');
    
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          costPrice: true,
          sku: true,
          weight: true,
          dimensions: true,
          stockQuantity: true,
          lowStockThreshold: true,
          categoryId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: products.length, status: 'processing' }
      });

      let fileUrl: string;
      let fileData: any;

      if (format === 'json') {
        fileData = Buffer.from(JSON.stringify(products, null, 2));
        fileUrl = `/exports/products_${Date.now()}.json`;
      } else if (format === 'csv') {
        // Get category names for products
        const categoryIds = Array.from(new Set(products.map(p => p.categoryId).filter(Boolean) as string[]));
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds as string[] } },
          select: { id: true, name: true },
        });
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        const csvData = products.map(product => {
          const dimensions = (product.dimensions as any) || {};
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            cost: product.costPrice,
            sku: product.sku,
            barcode: dimensions.barcode || product.sku,
            category: product.categoryId ? (categoryMap.get(product.categoryId) || '') : '',
            brand: dimensions.brand || '',
            weight: product.weight,
            dimensions: JSON.stringify(product.dimensions),
            stockQuantity: product.stockQuantity,
            reorderPoint: product.lowStockThreshold,
            isActive: product.isActive,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt
          };
        });

        const csvString = stringify(csvData, { header: true });
        fileData = Buffer.from(csvString);
        fileUrl = `/exports/products_${Date.now()}.csv`;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileData = buffer;
        fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
      }
      
      if (format === 'json') {
        fileData = JSON.stringify(products, null, 2);
        fileUrl = `data:application/json;charset=utf-8,${encodeURIComponent(fileData)}`;
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          processedRecords: products.length,
          successRecords: products.length,
          failedRecords: 0,
          fileUrl,
          status: 'completed',
          completedAt: new Date()
        }
      });

      return {
        success: true,
        fileUrl,
        recordCount: products.length,
        format
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [errorMessage],
          completedAt: new Date()
        }
      });

      throw new Error(`Export failed: ${errorMessage}`);
    }
  }

  async exportCustomers(organizationId: string, format: 'csv' | 'xlsx' | 'json'): Promise<ExportResult> {
    const operation = await this.createBulkOperation('export', 'customers');
    
    try {
      const customers = await prisma.customer.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          tags: true,
          source: true,
          totalSpent: true,
          points: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: customers.length, status: 'processing' }
      });

      let fileUrl: string;
      let fileData: any;

      if (format === 'json') {
        fileData = Buffer.from(JSON.stringify(customers, null, 2));
        fileUrl = `/exports/customers_${Date.now()}.json`;
      } else if (format === 'csv') {
        const csvData = customers.map(customer => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: (customer.tags as any)?.address || undefined, // Store in tags metadata or use separate field
          city: (customer.tags as any)?.city || undefined,
          state: (customer.tags as any)?.state || undefined,
          country: (customer.tags as any)?.country || undefined,
          postalCode: (customer.tags as any)?.postalCode || undefined,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        }));

        const csvString = stringify(csvData, { header: true });
        fileData = Buffer.from(csvString);
        fileUrl = `/exports/customers_${Date.now()}.csv`;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(customers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileData = buffer;
        fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
      }
      
      if (format === 'json') {
        fileData = JSON.stringify(customers, null, 2);
        fileUrl = `data:application/json;charset=utf-8,${encodeURIComponent(fileData)}`;
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          processedRecords: customers.length,
          successRecords: customers.length,
          failedRecords: 0,
          fileUrl,
          status: 'completed',
          completedAt: new Date()
        }
      });

      return {
        success: true,
        fileUrl,
        recordCount: customers.length,
        format
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [errorMessage],
          completedAt: new Date()
        }
      });

      throw new Error(`Export failed: ${errorMessage}`);
    }
  }

  async exportOrders(organizationId: string, format: 'csv' | 'xlsx' | 'json'): Promise<ExportResult> {
    const operation = await this.createBulkOperation('export', 'orders');
    
    try {
      const orders = await prisma.order.findMany({
        where: { organizationId },
        include: {
          customer: {
            select: {
              name: true,
              email: true,
              phone: true
            }
          },
          items: {
            select: {
              productId: true,
              quantity: true,
              price: true,
              total: true
            }
          }
        }
      });

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: orders.length, status: 'processing' }
      });

      // Transform orders to exportable format
      const exportData = orders.map((order: any) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || '',
        customerEmail: order.customer?.email || '',
        customerPhone: order.customer?.phone || '',
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Store address information in metadata since shippingAddress and billingAddress don't exist
        shippingAddress: order.metadata?.shippingAddress || '',
        billingAddress: order.metadata?.billingAddress || ''
      }));

      let fileUrl: string;
      let fileData: any;

      if (format === 'json') {
        fileData = Buffer.from(JSON.stringify(orders, null, 2));
        fileUrl = `/exports/orders_${Date.now()}.json`;
      } else if (format === 'csv') {
        const csvData = orders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          customerEmail: order.customer.email,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentMethod: order.paymentMethod,
          shippingAddress: (order.metadata as any)?.shippingAddress || undefined, // Store in metadata
          billingAddress: (order.metadata as any)?.billingAddress || undefined, // Store in metadata
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }));

        const csvString = stringify(csvData, { header: true });
        fileData = Buffer.from(csvString);
        fileUrl = `/exports/orders_${Date.now()}.csv`;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(orders);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileData = buffer;
        fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
      }
      
      if (format === 'json') {
        fileData = JSON.stringify(exportData, null, 2);
        fileUrl = `data:application/json;charset=utf-8,${encodeURIComponent(fileData)}`;
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          processedRecords: orders.length,
          successRecords: orders.length,
          failedRecords: 0,
          fileUrl,
          status: 'completed',
          completedAt: new Date()
        }
      });

      return {
        success: true,
        fileUrl,
        recordCount: orders.length,
        format
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [errorMessage],
          completedAt: new Date()
        }
      });

      throw new Error(`Export failed: ${errorMessage}`);
    }
  }

  async getBulkOperations(organizationId: string): Promise<BulkOperation[]> {
    const operations = await prisma.bulkOperation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });

    return operations.map((operation: any) => ({
      id: operation.id,
      type: operation.type as 'import' | 'export',
      entity: operation.entity as 'products' | 'customers' | 'orders' | 'inventory',
      status: operation.status as 'pending' | 'processing' | 'completed' | 'failed',
      totalRecords: operation.totalRecords,
      processedRecords: operation.processedRecords,
      successRecords: operation.successRecords,
      failedRecords: operation.failedRecords,
      fileUrl: operation.fileUrl || undefined,
      errors: operation.errors,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
      completedAt: operation.completedAt || undefined,
    }));
  }

  async getBulkOperation(operationId: string): Promise<BulkOperation | null> {
    const operation = await prisma.bulkOperation.findUnique({
      where: { id: operationId }
    });

    if (!operation) return null;

    return {
      id: operation.id,
      type: operation.type as 'import' | 'export',
      entity: operation.entity as 'products' | 'customers' | 'orders' | 'inventory',
      status: operation.status as 'pending' | 'processing' | 'completed' | 'failed',
      totalRecords: operation.totalRecords,
      processedRecords: operation.processedRecords,
      successRecords: operation.successRecords,
      failedRecords: operation.failedRecords,
      fileUrl: operation.fileUrl || undefined,
      errors: operation.errors,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
      completedAt: operation.completedAt || undefined,
    };
  }

  async deleteBulkOperation(operationId: string): Promise<void> {
    await prisma.bulkOperation.delete({
      where: { id: operationId }
    });
  }
} 