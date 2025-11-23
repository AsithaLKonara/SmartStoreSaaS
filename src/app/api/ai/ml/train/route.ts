import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CustomModelService } from '@/lib/ai/ml/customModelService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await _request.json();
    const { modelType, trainingData, features, targetVariable, hyperparameters } = body;

    if (!modelType || !trainingData || !features || !targetVariable) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const modelService = new CustomModelService();
    const result = await modelService.trainModel(session.user.organizationId, {
      modelType,
      trainingData,
      features,
      targetVariable,
      hyperparameters,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error training model:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

