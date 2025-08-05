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

    // For now, return mock reports since we don't have a reports table
    // In a real implementation, this would come from a reports table
    const mockReports = [
      {
        id: 'report_1',
        name: 'Sales Summary Report',
        type: 'SALES',
        status: 'READY',
        format: 'PDF',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        size: '2.3 MB',
      },
      {
        id: 'report_2',
        name: 'Inventory Status Report',
        type: 'INVENTORY',
        status: 'READY',
        format: 'EXCEL',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        size: '1.8 MB',
      },
      {
        id: 'report_3',
        name: 'Customer Analytics Report',
        type: 'CUSTOMER',
        status: 'GENERATING',
        format: 'PDF',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'report_4',
        name: 'Financial Overview Report',
        type: 'FINANCIAL',
        status: 'FAILED',
        format: 'PDF',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json(mockReports);
  } catch (error) {
    console.error('Error fetching reports:', error);
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
    const { name, type, format, parameters } = body;

    if (!name || !type || !format) {
      return NextResponse.json({ message: 'Required fields are missing' }, { status: 400 });
    }

    // In a real implementation, this would create a report record
    const report = {
      id: `report_${Date.now()}`,
      name,
      type: type as any,
      status: 'GENERATING',
      format: format as any,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 