import { NextRequest, NextResponse } from 'next/server';

// Mock user data for testing
const mockUsers = [
  {
    id: '1',
    email: 'admin@smartstore.ai',
    password: 'admin123',
    name: 'Admin User',
    role: 'ADMIN',
  },
  {
    id: '2',
    email: 'user@smartstore.ai',
    password: 'user123',
    name: 'Test User',
    role: 'USER',
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('🔐 Test auth attempt:', { email, hasPassword: !!password });

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = mockUsers.find(u => u.email === email);
    console.log('👤 User found:', !!user);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Check password
    if (password !== user.password) {
      console.log('❌ Invalid password for:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('✅ Authentication successful for:', email);
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: 'Authentication successful',
    });

  } catch (error) {
    console.error('❌ Test auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 