import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ThemeService } from '@/lib/theme/themeService';

const themeService = ThemeService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'config':
        const user = await prisma.user.findUnique({
          where: { email: session.user.email }
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get user's theme preference from database
        const userTheme = await prisma.userPreference.findUnique({
          where: { userId: user.id }
        });

        const config = userTheme?.themeConfig 
          ? JSON.parse(userTheme.themeConfig)
          : themeService.getDefaultConfig();

        return NextResponse.json({ config });

      case 'presets':
        const presets = themeService.getPresets();
        return NextResponse.json({ presets });

      case 'preset':
        const presetId = searchParams.get('id');
        if (!presetId) {
          return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
        }
        const preset = themeService.getPreset(presetId);
        if (!preset) {
          return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
        }
        return NextResponse.json({ preset });

      case 'system-theme':
        const systemTheme = themeService.getSystemTheme();
        return NextResponse.json({ theme: systemTheme });

      case 'css':
        const userForCSS = await prisma.user.findUnique({
          where: { email: session.user.email }
        });

        if (!userForCSS) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userThemeForCSS = await prisma.userPreference.findUnique({
          where: { userId: userForCSS.id }
        });

        const configForCSS = userThemeForCSS?.themeConfig 
          ? JSON.parse(userThemeForCSS.themeConfig)
          : themeService.getDefaultConfig();

        const css = themeService.generateThemeCSS(configForCSS);
        return new NextResponse(css, {
          headers: { 'Content-Type': 'text/css' }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Theme API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'update-config':
        const { config } = data;
        
        // Validate config
        if (!config || typeof config !== 'object') {
          return NextResponse.json({ error: 'Invalid config' }, { status: 400 });
        }

        // Apply theme
        themeService.applyTheme(config);

        // Save to database
        await prisma.userPreference.upsert({
          where: { userId: user.id },
          update: {
            themeConfig: JSON.stringify(config),
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            themeConfig: JSON.stringify(config)
          }
        });

        return NextResponse.json({ success: true, config });

      case 'apply-preset':
        const { presetId } = data;
        if (!presetId) {
          return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
        }

        const preset = themeService.getPreset(presetId);
        if (!preset) {
          return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
        }

        // Apply preset theme
        themeService.applyTheme(preset.config);

        // Save to database
        await prisma.userPreference.upsert({
          where: { userId: user.id },
          update: {
            themeConfig: JSON.stringify(preset.config),
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            themeConfig: JSON.stringify(preset.config)
          }
        });

        return NextResponse.json({ success: true, preset });

      case 'reset':
        const defaultConfig = themeService.getDefaultConfig();
        themeService.resetTheme();

        // Save to database
        await prisma.userPreference.upsert({
          where: { userId: user.id },
          update: {
            themeConfig: JSON.stringify(defaultConfig),
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            themeConfig: JSON.stringify(defaultConfig)
          }
        });

        return NextResponse.json({ success: true, config: defaultConfig });

      case 'create-preset':
        const { name, description, config: presetConfig } = data;
        
        if (!name || !presetConfig) {
          return NextResponse.json({ error: 'Name and config required' }, { status: 400 });
        }

        const newPreset = {
          id: `custom-${Date.now()}`,
          name,
          description: description || '',
          config: presetConfig
        };

        themeService.addPreset(newPreset);
        return NextResponse.json({ success: true, preset: newPreset });

      case 'delete-preset':
        const { presetId: deletePresetId } = data;
        if (!deletePresetId) {
          return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
        }

        const presetToDelete = themeService.getPreset(deletePresetId);
        if (!presetToDelete) {
          return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
        }

        if (presetToDelete.isDefault) {
          return NextResponse.json({ error: 'Cannot delete default preset' }, { status: 400 });
        }

        themeService.removePreset(deletePresetId);
        return NextResponse.json({ success: true });

      case 'export-theme':
        const userThemeForExport = await prisma.userPreference.findUnique({
          where: { userId: user.id }
        });

        const configForExport = userThemeForExport?.themeConfig 
          ? JSON.parse(userThemeForExport.themeConfig)
          : themeService.getDefaultConfig();

        const exportData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          config: configForExport,
          css: themeService.generateThemeCSS(configForExport)
        };

        return NextResponse.json({ export: exportData });

      case 'import-theme':
        const { importData } = data;
        
        if (!importData || !importData.config) {
          return NextResponse.json({ error: 'Invalid import data' }, { status: 400 });
        }

        // Apply imported theme
        themeService.applyTheme(importData.config);

        // Save to database
        await prisma.userPreference.upsert({
          where: { userId: user.id },
          update: {
            themeConfig: JSON.stringify(importData.config),
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            themeConfig: JSON.stringify(importData.config)
          }
        });

        return NextResponse.json({ success: true, config: importData.config });

      case 'generate-palette':
        const { baseColor } = data;
        if (!baseColor) {
          return NextResponse.json({ error: 'Base color required' }, { status: 400 });
        }

        const palette = themeService.generateColorPalette(baseColor);
        return NextResponse.json({ palette });

      case 'get-contrast-color':
        const { backgroundColor } = data;
        if (!backgroundColor) {
          return NextResponse.json({ error: 'Background color required' }, { status: 400 });
        }

        const contrastColor = themeService.getContrastColor(backgroundColor);
        return NextResponse.json({ contrastColor });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Theme API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 