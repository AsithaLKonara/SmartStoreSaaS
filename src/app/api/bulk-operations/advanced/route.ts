import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BulkOperationsService } from '@/lib/bulk/bulkOperationsService';

const bulkOperationsService = new BulkOperationsService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const operationId = searchParams.get('operationId');

    switch (action) {
      case 'operations':
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        });

        if (!user?.organizationId) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const operations = await bulkOperationsService.getBulkOperations(user.organizationId);
        return NextResponse.json({ operations });

      case 'operation':
        if (!operationId) {
          return NextResponse.json({ error: 'Operation ID required' }, { status: 400 });
        }
        const operation = await bulkOperationsService.getBulkOperation(operationId);
        return NextResponse.json({ operation });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bulk Operations API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'import-products':
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const format = data.format || 'csv';

        if (!file) {
          return NextResponse.json({ error: 'File required' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await bulkOperationsService.importProducts(user.organizationId, buffer, format);
        return NextResponse.json({ result });

      case 'import-customers':
        const customerFormData = await request.formData();
        const customerFile = customerFormData.get('file') as File;
        const customerFormat = data.format || 'csv';

        if (!customerFile) {
          return NextResponse.json({ error: 'File required' }, { status: 400 });
        }

        const customerBuffer = Buffer.from(await customerFile.arrayBuffer());
        const customerResult = await bulkOperationsService.importCustomers(user.organizationId, customerBuffer, customerFormat);
        return NextResponse.json({ result: customerResult });

      case 'export-products':
        const exportFormat = data.format || 'csv';
        const exportResult = await bulkOperationsService.exportProducts(user.organizationId, exportFormat);
        return NextResponse.json({ result: exportResult });

      case 'export-customers':
        const customerExportFormat = data.format || 'csv';
        const customerExportResult = await bulkOperationsService.exportCustomers(user.organizationId, customerExportFormat);
        return NextResponse.json({ result: customerExportResult });

      case 'export-orders':
        const orderExportFormat = data.format || 'csv';
        const orderExportResult = await bulkOperationsService.exportOrders(user.organizationId, orderExportFormat);
        return NextResponse.json({ result: orderExportResult });

      case 'delete-operation':
        await bulkOperationsService.deleteBulkOperation(data.operationId);
        return NextResponse.json({ success: true });

      case 'bulk-import':
        const { entity, files, format: bulkFormat } = data;
        const results = [];

        for (const file of files) {
          try {
            const fileBuffer = Buffer.from(file.content, 'base64');
            
            if (entity === 'products') {
              const result = await bulkOperationsService.importProducts(user.organizationId, fileBuffer, bulkFormat);
              results.push({ fileName: file.name, success: true, result });
            } else if (entity === 'customers') {
              const result = await bulkOperationsService.importCustomers(user.organizationId, fileBuffer, bulkFormat);
              results.push({ fileName: file.name, success: true, result });
            }
          } catch (error) {
            results.push({ fileName: file.name, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }

        return NextResponse.json({ results });

      case 'bulk-export':
        const { entities, format: bulkExportFormat } = data;
        const exportResults = [];

        for (const entity of entities) {
          try {
            if (entity === 'products') {
              const result = await bulkOperationsService.exportProducts(user.organizationId, bulkExportFormat);
              exportResults.push({ entity, success: true, result });
            } else if (entity === 'customers') {
              const result = await bulkOperationsService.exportCustomers(user.organizationId, bulkExportFormat);
              exportResults.push({ entity, success: true, result });
            } else if (entity === 'orders') {
              const result = await bulkOperationsService.exportOrders(user.organizationId, bulkExportFormat);
              exportResults.push({ entity, success: true, result });
            }
          } catch (error) {
            exportResults.push({ entity, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }

        return NextResponse.json({ results: exportResults });

      case 'validate-import':
        const { entity: validateEntity, fileContent, format: validateFormat } = data;
        const validationResults = [];

        try {
          const fileBuffer = Buffer.from(fileContent, 'base64');
          
          if (validateFormat === 'csv') {
            const { parse } = await import('csv-parse/sync');
            const records = parse(fileBuffer.toString(), {
              columns: true,
              skip_empty_lines: true
            });

            for (let i = 0; i < Math.min(records.length, 10); i++) {
              const record = records[i] as any;
              const validation = { row: i + 1, valid: true, errors: [] as string[] };

              if (validateEntity === 'products') {
                if (!record.name) validation.errors.push('Name is required');
                if (!record.price || isNaN(parseFloat(record.price))) validation.errors.push('Valid price is required');
                if (validation.errors.length > 0) validation.valid = false;
              } else if (validateEntity === 'customers') {
                if (!record.name) validation.errors.push('Name is required');
                if (!record.email) validation.errors.push('Email is required');
                if (validation.errors.length > 0) validation.valid = false;
              }

              validationResults.push(validation);
            }
          } else if (validateFormat === 'xlsx') {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(fileBuffer);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const records = XLSX.utils.sheet_to_json(worksheet);

            for (let i = 0; i < Math.min(records.length, 10); i++) {
              const record = records[i] as any;
              const validation = { row: i + 1, valid: true, errors: [] as string[] };

              if (validateEntity === 'products') {
                if (!record.name) validation.errors.push('Name is required');
                if (!record.price || isNaN(parseFloat(record.price))) validation.errors.push('Valid price is required');
                if (validation.errors.length > 0) validation.valid = false;
              } else if (validateEntity === 'customers') {
                if (!record.name) validation.errors.push('Name is required');
                if (!record.email) validation.errors.push('Email is required');
                if (validation.errors.length > 0) validation.valid = false;
              }

              validationResults.push(validation);
            }
          }

          return NextResponse.json({ 
            valid: validationResults.every(v => v.valid),
            validationResults,
            totalRecords: validationResults.length
          });
        } catch (error) {
          return NextResponse.json({ 
            valid: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bulk Operations API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 