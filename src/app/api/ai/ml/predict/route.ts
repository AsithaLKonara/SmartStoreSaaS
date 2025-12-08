import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CustomModelService } from '@/lib/ai/ml/customModelService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { modelId, input } = body;

    if (!modelId || !input) {
      return NextResponse.json(
        { message: 'Missing required fields: modelId and input' },
        { status: 400 }
      );
    }

    const modelService = new CustomModelService();
    const prediction = await modelService.predict(modelId, input);

    return NextResponse.json({ prediction });
  } catch (error) {
    console.error('Error making prediction:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

