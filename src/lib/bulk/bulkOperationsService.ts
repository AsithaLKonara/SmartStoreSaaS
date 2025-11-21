import { prisma } from '@/lib/prisma';
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
    return await prisma.bulkOperation.create({
      data: {
        type,
        entity,
        status: 'pending',
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        errors: [],
        metadata
      }
    });
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

          await prisma.product.create({
            data: {
              name: row.name,
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
            },
          });
          successCount++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Row ${i + 1}: ${errorMessage}`);
          failedCount++;
        }

        // Update progress every 10 records
        if ((i + 1) % 10 === 0) {
          await prisma.bulkOperation.update({
            where: { id: operation.id },
            data: {
              processedRecords: i + 1,
              successRecords: successCount,
              failedRecords: failedCount,
              errors: errors.slice(-100) // Keep last 100 errors
            }
          });
        }
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          processedRecords: data.length,
          successRecords: successCount,
          failedRecords: failedCount,
          errors: errors.slice(-100),
          completedAt: new Date()
        }
      });

      return {
        success: failedCount === 0,
        totalRecords: data.length,
        processedRecords: data.length,
        successRecords: successCount,
        failedRecords: failedCount,
        errors: errors.slice(-100)
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

      throw error;
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
          await prisma.customer.create({
            data: {
              name: row.name,
              email: row.email,
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

        if ((i + 1) % 10 === 0) {
          await prisma.bulkOperation.update({
            where: { id: operation.id },
            data: {
              processedRecords: i + 1,
              successRecords: successCount,
              failedRecords: failedCount,
              errors: errors.slice(-100)
            }
          });
        }
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          processedRecords: data.length,
          successRecords: successCount,
          failedRecords: failedCount,
          errors: errors.slice(-100),
          completedAt: new Date()
        }
      });

      return {
        success: failedCount === 0,
        totalRecords: data.length,
        processedRecords: data.length,
        successRecords: successCount,
        failedRecords: failedCount,
        errors: errors.slice(-100)
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

      throw error;
    }
  }

  async exportProducts(organizationId: string, format: 'csv' | 'xlsx' | 'json'): Promise<ExportResult> {
    const operation = await this.createBulkOperation('export', 'products');
    
    try {
      const products = await prisma.product.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
      });

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: products.length, status: 'processing' }
      });

      let fileUrl: string;
      let fileContent: Buffer;

      if (format === 'json') {
        fileContent = Buffer.from(JSON.stringify(products, null, 2));
        fileUrl = `/exports/products_${Date.now()}.json`;
      } else if (format === 'csv') {
        // Get category names for products
        const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))];
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
        fileContent = Buffer.from(csvString);
        fileUrl = `/exports/products_${Date.now()}.csv`;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        fileContent = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileUrl = `/exports/products_${Date.now()}.xlsx`;
      }

      // Save file (in production, save to cloud storage)
      // For now, we'll just update the operation with the file URL
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          processedRecords: products.length,
          successRecords: products.length,
          fileUrl,
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

      throw error;
    }
  }

  async exportCustomers(organizationId: string, format: 'csv' | 'xlsx' | 'json'): Promise<ExportResult> {
    const operation = await this.createBulkOperation('export', 'customers');
    
    try {
      const customers = await prisma.customer.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
      });

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: customers.length, status: 'processing' }
      });

      let fileUrl: string;
      let fileContent: Buffer;

      if (format === 'json') {
        fileContent = Buffer.from(JSON.stringify(customers, null, 2));
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
        fileContent = Buffer.from(csvString);
        fileUrl = `/exports/customers_${Date.now()}.csv`;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(customers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
        fileContent = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileUrl = `/exports/customers_${Date.now()}.xlsx`;
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          processedRecords: customers.length,
          successRecords: customers.length,
          fileUrl,
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

      throw error;
    }
  }

  async exportOrders(organizationId: string, format: 'csv' | 'xlsx' | 'json'): Promise<ExportResult> {
    const operation = await this.createBulkOperation('export', 'orders');
    
    try {
      const orders = await prisma.order.findMany({
        where: { organizationId },
        include: {
          customer: true,
          items: {
            include: { product: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: { totalRecords: orders.length, status: 'processing' }
      });

      let fileUrl: string;
      let fileContent: Buffer;

      if (format === 'json') {
        fileContent = Buffer.from(JSON.stringify(orders, null, 2));
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
        fileContent = Buffer.from(csvString);
        fileUrl = `/exports/orders_${Date.now()}.csv`;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(orders);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        fileContent = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileUrl = `/exports/orders_${Date.now()}.xlsx`;
      }

      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'completed',
          processedRecords: orders.length,
          successRecords: orders.length,
          fileUrl,
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

      throw error;
    }
  }

  async getBulkOperations(organizationId: string): Promise<BulkOperation[]> {
    return await prisma.bulkOperation.findMany({
      where: { metadata: { path: ['organizationId'], equals: organizationId } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBulkOperation(operationId: string): Promise<BulkOperation | null> {
    return await prisma.bulkOperation.findUnique({
      where: { id: operationId }
    });
  }

  async deleteBulkOperation(operationId: string): Promise<void> {
    await prisma.bulkOperation.delete({
      where: { id: operationId }
    });
  }
} 