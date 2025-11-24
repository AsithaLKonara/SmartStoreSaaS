declare module 'quagga' {
  export interface BarcodeResult {
    code: string;
    format: string;
    confidence: number;
    box: number[][];
    line: {
      angle: number;
      offset: number;
    };
  }

  export interface BarcodeConfig {
    inputStream: {
      name: string;
      type: 'LiveStream' | 'ImageStream';
      target?: HTMLElement | string;
      constraints?: {
        width: number;
        height: number;
        facing?: 'user' | 'environment';
      };
    };
    decoder: {
      readers: string[];
      debug?: {
        drawBoundingBox: boolean;
        showFrequency: boolean;
        drawScanline: boolean;
        showPattern: boolean;
      };
    };
    locate?: boolean;
    numOfWorkers?: number;
    frequency?: number;
    locator?: {
      patchSize: string;
      halfSample: boolean;
    };
    src?: string; // Added for image scanning
  }

  export interface QuaggaCanvas {
    ctx: {
      overlay: CanvasRenderingContext2D;
    };
    dom: {
      overlay: HTMLCanvasElement;
    };
  }

  export interface QuaggaImageDebug {
    drawPath(box: number[][], offset: { x: number | string; y: number | string }, ctx: CanvasRenderingContext2D, options: { color: string; lineWidth: number }): void;
  }

  export const canvas: QuaggaCanvas;
  export const ImageDebug: QuaggaImageDebug;

  export function init(config: BarcodeConfig, callback: (err: Error | null) => void): void;
  export function start(): void;
  export function stop(): void;
  export function onDetected(callback: (result: BarcodeResult) => void): void;
  export function onProcessed(callback: (result: { codeResult?: BarcodeResult; boxes?: number[][]; [key: string]: unknown }) => void): void;
  export function decodeSingle(config: BarcodeConfig, callback: (result: BarcodeResult) => void): void;
  export function offDetected(callback?: (result: BarcodeResult) => void): void;
  export function offProcessed(callback?: (result: { codeResult?: BarcodeResult; boxes?: number[][]; [key: string]: unknown }) => void): void;
} 