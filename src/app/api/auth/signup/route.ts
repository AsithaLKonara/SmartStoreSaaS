import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/utils';

export async function POST() {
  try {
    const body = await _request.json();
    const { name, email, password, organizationName, organizationSlug } = body;

    // Validate required fields
    if (!name || !email || !password || !organizationName) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if organization slug is available
    const finalSlug = organizationSlug || generateSlug(organizationName);
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: finalSlug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { message: 'Organization URL is already taken' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: finalSlug,
          plan: 'STARTER',
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      return { user, organization };
    });

    // Return success response (without password)
    const { password: _, ...userWithoutPassword } = result.user;

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: userWithoutPassword,
        organization: result.organization,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 