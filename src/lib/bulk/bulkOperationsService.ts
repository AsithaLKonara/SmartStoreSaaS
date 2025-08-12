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
        type,
        entity,
        status: 'pending',
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        errors: [],
        metadata,
        organization: {
          connect: {
            id: process.env.DEFAULT_ORGANIZATION_ID || 'default'
          }
        }
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
          await prisma.product.create({
            data: {
              name: row.name,
              description: row.description || '',
              price: parseFloat(row.price) || 0,
              sku: row.sku || '',
              weight: parseFloat(row.weight) || 0,
              stockQuantity: parseInt(row.stockQuantity) || 0,
              reorderPoint: parseInt(row.reorderPoint) || 0,
              isActive: row.isActive === 'true' || row.isActive === true,
              organization: {
                connect: { id: organizationId }
              },
              slug: row.sku || row.name?.toLowerCase().replace(/\s+/g, '-') || `product-${Date.now()}`,
              createdBy: {
                connect: { id: process.env.DEFAULT_USER_ID || 'default' }
              }
            }
          });
          successCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
              address: fullAddress,
              tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
              source: row.source || 'bulk_import',
              totalSpent: parseFloat(row.totalSpent) || 0,
              points: parseInt(row.points) || 0,
              isActive: row.isActive === 'true' || row.isActive === true,
              organization: {
                connect: { id: organizationId }
              }
            }
          });
          successCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
          sku: true,
          weight: true,
          stockQuantity: true,
          reorderPoint: true,
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

      if (format === 'csv') {
        fileData = stringify(products, { header: true });
        fileUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(fileData)}`;
      } else if (format === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileData = buffer;
        fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
      } else {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
          address: true,
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

      if (format === 'csv') {
        fileData = stringify(customers, { header: true });
        fileUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(fileData)}`;
      } else if (format === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(customers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileData = buffer;
        fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
      } else {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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

      if (format === 'csv') {
        fileData = stringify(exportData, { header: true });
        fileUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(fileData)}`;
      } else if (format === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fileData = buffer;
        fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
      } else {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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