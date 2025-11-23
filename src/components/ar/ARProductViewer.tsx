'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';

interface ARProductViewerProps {
  productId: string;
  modelUrl: string;
  modelType: 'gltf' | 'glb' | 'obj';
}

export function ARProductViewer({ productId, modelUrl: _modelUrl, modelType: _modelType }: ARProductViewerProps) {
  const [isARSupported, setIsARSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for WebXR support
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      (navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } }).xr?.isSessionSupported('immersive-ar').then((supported: boolean) => {
        setIsARSupported(supported);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const startAR = async () => {
    if (!isARSupported) {
      alert('AR is not supported in this browser. Please use a compatible device.');
      return;
    }

    try {
      const session = await (navigator as Navigator & { xr?: { requestSession: (mode: string) => Promise<unknown> } }).xr?.requestSession('immersive-ar');
      // AR session would be initialized here
      // In production, this would use a 3D library like Three.js with AR capabilities
      console.log('AR session started:', session);
    } catch (error) {
      console.error('Failed to start AR session:', error);
      alert('Failed to start AR session. Please try again.');
    }
  };

  const viewIn3D = () => {
    // Open 3D viewer (could use Three.js, Babylon.js, etc.)
    window.open(`/ar/viewer/${productId}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D & AR View</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={viewerRef} className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">3D Model Viewer</p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={viewIn3D} variant="default">
            View in 3D
          </Button>
          {isARSupported && (
            <Button onClick={startAR} variant="outline">
              View in AR
            </Button>
          )}
        </div>

        {!isARSupported && (
          <p className="text-sm text-gray-500">
            AR requires a compatible device and browser (iOS Safari or Android Chrome with WebXR support)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
