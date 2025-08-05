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
          await prisma.product.create({
            data: {
              name: row.name,
              description: row.description || '',
              price: parseFloat(row.price) || 0,
              cost: parseFloat(row.cost) || 0,
              sku: row.sku || '',
              barcode: row.barcode || '',
              category: row.category || '',
              brand: row.brand || '',
              weight: parseFloat(row.weight) || 0,
              dimensions: row.dimensions || '',
              stockQuantity: parseInt(row.stockQuantity) || 0,
              reorderPoint: parseInt(row.reorderPoint) || 0,
              isActive: row.isActive === 'true' || row.isActive === true,
              organizationId
            }
          });
          successCount++;
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error.message}`);
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
    } catch (error) {
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [error.message],
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
              address: row.address || '',
              city: row.city || '',
              state: row.state || '',
              country: row.country || '',
              postalCode: row.postalCode || '',
              organizationId,
              metadata: {
                source: 'bulk_import',
                importDate: new Date().toISOString()
              }
            }
          });
          successCount++;
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error.message}`);
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
    } catch (error) {
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [error.message],
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
        const csvData = products.map(product => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          cost: product.cost,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          brand: product.brand,
          weight: product.weight,
          dimensions: product.dimensions,
          stockQuantity: product.stockQuantity,
          reorderPoint: product.reorderPoint,
          isActive: product.isActive,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }));

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
    } catch (error) {
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [error.message],
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
          address: customer.address,
          city: customer.city,
          state: customer.state,
          country: customer.country,
          postalCode: customer.postalCode,
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
    } catch (error) {
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [error.message],
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
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
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
    } catch (error) {
      await prisma.bulkOperation.update({
        where: { id: operation.id },
        data: {
          status: 'failed',
          errors: [error.message],
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