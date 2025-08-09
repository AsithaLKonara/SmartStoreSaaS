'use client';

import React, { useEffect, useRef, useState } from 'react';
import { barcodeService, BarcodeResult, ProductLookup } from '@/lib/barcode/barcodeService';
import { Camera, X, Upload, Loader2, Package, AlertCircle, CheckCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onResult: (result: BarcodeResult, product?: ProductLookup) => void;
  onClose: () => void;
  organizationId: string;
  showProductLookup?: boolean;
  allowImageUpload?: boolean;
  className?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onResult,
  onClose,
  organizationId,
  showProductLookup = true,
  allowImageUpload = true,
  className = '',
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<ProductLookup | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  useEffect(() => {
    initializeScanner();
    return () => {
      barcodeService.destroy();
    };
  }, []);

  const initializeScanner = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check camera permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          stream.getTracks().forEach(track => track.stop());
          setCameraPermission('granted');
        } catch (err) {
          setCameraPermission('denied');
          setError('Camera permission denied. Please allow camera access or use image upload.');
          setIsLoading(false);
          return;
        }
      }

      if (!videoRef.current) {
        setError('Scanner container not found');
        setIsLoading(false);
        return;
      }

      const config = barcodeService.createDefaultConfig(videoRef.current);
      await barcodeService.initialize(config);

      barcodeService.onDetected(handleBarcodeDetected);
      barcodeService.start();
      setIsScanning(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize scanner:', err);
      setError('Failed to initialize barcode scanner. Please try again.');
      setIsLoading(false);
    }
  };

  const handleBarcodeDetected = async (result: BarcodeResult) => {
    // Avoid duplicate scans
    if (result.code === lastScan) return;
    
    setLastScan(result.code);
    setIsLoading(true);

    try {
      let product: ProductLookup | null = null;

      if (showProductLookup) {
        product = await barcodeService.lookupProduct(result.code, organizationId);
        setProductInfo(product);
      }

      onResult(result, product || undefined);
    } catch (err) {
      console.error('Error processing barcode:', err);
      setError('Failed to process barcode');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await barcodeService.scanFromImage(file);
      if (result) {
        let product: ProductLookup | null = null;

        if (showProductLookup) {
          product = await barcodeService.lookupProduct(result.code, organizationId);
          setProductInfo(product);
        }

        onResult(result, product || undefined);
      } else {
        setError('No barcode found in the image. Please try a clearer image.');
      }
    } catch (err) {
      console.error('Error scanning image:', err);
      setError('Failed to scan barcode from image');
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanning = () => {
    barcodeService.stop();
    setIsScanning(false);
  };

  const startScanning = () => {
    if (cameraPermission === 'granted') {
      barcodeService.start();
      setIsScanning(true);
      setError(null);
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Barcode Scanner</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center">
              <Loader2 className="w-5 h-5 text-blue-500 mr-2 animate-spin" />
              <span className="text-blue-700 text-sm">Processing...</span>
            </div>
          )}

          {/* Camera Scanner */}
          {cameraPermission === 'granted' && (
            <div className="mb-4">
              <div
                ref={videoRef}
                className="relative bg-gray-100 rounded-lg overflow-hidden"
                style={{ height: '300px' }}
              >
                {!isScanning && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">Camera ready</p>
                      <button
                        onClick={startScanning}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Start Scanning
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isScanning && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={stopScanning}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Stop Scanning
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Image Upload */}
          {allowImageUpload && (
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center">
                  <Upload className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Upload Image</span>
                </div>
              </button>
            </div>
          )}

          {/* Product Information */}
          {productInfo && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-green-900 mb-1">Product Found</h3>
                  <div className="space-y-2 text-sm text-green-800">
                    <div>
                      <span className="font-medium">Name:</span> {productInfo.name}
                    </div>
                    {productInfo.brand && (
                      <div>
                        <span className="font-medium">Brand:</span> {productInfo.brand}
                      </div>
                    )}
                    {productInfo.category && (
                      <div>
                        <span className="font-medium">Category:</span> {productInfo.category}
                      </div>
                    )}
                    {productInfo.price > 0 && (
                      <div>
                        <span className="font-medium">Price:</span> ${productInfo.price.toFixed(2)}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Source:</span> {productInfo.source}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Last Scanned Code */}
          {lastScan && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <Package className="w-5 h-5 text-gray-500 mr-2" />
                <div>
                  <div className="text-sm text-gray-600">Last Scanned:</div>
                  <div className="font-mono text-sm font-medium">{lastScan}</div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Position the barcode within the camera frame</p>
            <p>• Ensure good lighting for better accuracy</p>
            <p>• Keep the camera steady while scanning</p>
            {allowImageUpload && <p>• Alternatively, upload an image with a barcode</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Supports: EAN, UPC, Code128, Code39, and more
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
