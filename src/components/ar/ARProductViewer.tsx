'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Camera, X, RotateCcw, ZoomIn, ZoomOut, Move3D, Maximize } from 'lucide-react';

interface ARProductViewerProps {
  productId: string;
  modelUrl?: string;
  images: string[];
  onClose: () => void;
  className?: string;
}

interface ARCapabilities {
  webXR: boolean;
  webGL: boolean;
  deviceMotion: boolean;
  camera: boolean;
}

export const ARProductViewer: React.FC<ARProductViewerProps> = ({
  productId,
  modelUrl,
  images,
  onClose,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arCapabilities, setARCapabilities] = useState<ARCapabilities>({
    webXR: false,
    webGL: false,
    deviceMotion: false,
    camera: false,
  });
  const [isARMode, setIsARMode] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    checkARCapabilities();
    initializeScene();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (modelUrl && sceneRef.current) {
      loadModel(modelUrl);
    } else if (images.length > 0) {
      createImagePlane(images[0]);
    }
  }, [modelUrl, images]);

  const checkARCapabilities = async () => {
    const capabilities: ARCapabilities = {
      webXR: 'xr' in navigator && 'requestSession' in (navigator as any).xr,
      webGL: !!window.WebGLRenderingContext,
      deviceMotion: 'DeviceMotionEvent' in window,
      camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    };

    setARCapabilities(capabilities);
  };

  const initializeScene = () => {
    if (!mountRef.current) return;

    try {
      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(
        75,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 5);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      mountRef.current.appendChild(renderer.domElement);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = true;
      controlsRef.current = controls;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      const pointLight = new THREE.PointLight(0xffffff, 0.5);
      pointLight.position.set(-10, -10, -5);
      scene.add(pointLight);

      // Ground plane (for shadows)
      const groundGeometry = new THREE.PlaneGeometry(20, 20);
      const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!mountRef.current || !camera || !renderer) return;
        
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      };

      window.addEventListener('resize', handleResize);
      setIsLoading(false);

    } catch (err) {
      console.error('Error initializing 3D scene:', err);
      setError('Failed to initialize 3D viewer');
      setIsLoading(false);
    }
  };

  const loadModel = async (url: string) => {
    if (!sceneRef.current) return;

    setIsLoading(true);
    
    try {
      const loader = new GLTFLoader();
      
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          url,
          resolve,
          (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total) * 100 + '%');
          },
          reject
        );
      });

      // Remove existing model
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
      }

      const model = gltf.scene;
      
      // Center and scale the model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDimension;
      
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      
      // Enable shadows
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      sceneRef.current.add(model);
      modelRef.current = model;
      setModelLoaded(true);
      setIsLoading(false);

    } catch (err) {
      console.error('Error loading 3D model:', err);
      setError('Failed to load 3D model');
      setIsLoading(false);
    }
  };

  const createImagePlane = (imageUrl: string) => {
    if (!sceneRef.current) return;

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        // Remove existing model
        if (modelRef.current) {
          sceneRef.current!.remove(modelRef.current);
        }

        const geometry = new THREE.PlaneGeometry(4, 4);
        const material = new THREE.MeshBasicMaterial({ 
          map: texture,
          transparent: true,
        });
        const plane = new THREE.Mesh(geometry, material);
        
        sceneRef.current!.add(plane);
        modelRef.current = plane;
        setModelLoaded(true);
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading image:', err);
        setError('Failed to load product image');
        setIsLoading(false);
      }
    );
  };

  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    cameraRef.current.position.set(0, 0, 5);
    controlsRef.current.reset();
  };

  const zoomIn = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.multiplyScalar(0.8);
  };

  const zoomOut = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.multiplyScalar(1.2);
  };

  const toggleARMode = async () => {
    if (!arCapabilities.webXR) {
      alert('WebXR not supported on this device');
      return;
    }

    try {
      if (!isARMode) {
        // Enter AR mode
        const session = await (navigator as any).xr.requestSession('immersive-ar', {
          requiredFeatures: ['local', 'hit-test'],
        });
        
        if (rendererRef.current) {
          await rendererRef.current.xr.setSession(session);
          setIsARMode(true);
        }
      } else {
        // Exit AR mode
        if (rendererRef.current?.xr.getSession()) {
          await rendererRef.current.xr.getSession().end();
          setIsARMode(false);
        }
      }
    } catch (error) {
      console.error('Error toggling AR mode:', error);
      alert('Failed to enter AR mode');
    }
  };

  const takeScreenshot = () => {
    if (!rendererRef.current) return;

    const canvas = rendererRef.current.domElement;
    const link = document.createElement('a');
    link.download = `product-${productId}-ar-view.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const cleanup = () => {
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
    
    if (controlsRef.current) {
      controlsRef.current.dispose();
    }

    // Dispose of geometries and materials
    if (sceneRef.current) {
      sceneRef.current.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(material => material.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <h2 className="text-lg font-semibold">AR Product Viewer</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* AR Viewer */}
        <div className="relative">
          <div
            ref={mountRef}
            className="w-full h-96 bg-gray-100"
            style={{ minHeight: '400px' }}
          />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading 3D model...</p>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold mb-2">Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Controls */}
          {modelLoaded && (
            <div className="absolute top-4 right-4 flex flex-col space-y-2">
              <button
                onClick={resetView}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                title="Reset View"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={zoomIn}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={zoomOut}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-gray-700" />
              </button>

              <button
                onClick={takeScreenshot}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                title="Take Screenshot"
              >
                <Camera className="w-5 h-5 text-gray-700" />
              </button>

              {arCapabilities.webXR && (
                <button
                  onClick={toggleARMode}
                  className={`p-2 rounded-full shadow-lg transition-colors ${
                    isARMode 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title={isARMode ? 'Exit AR' : 'Enter AR'}
                >
                  <Move3D className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <p>Use mouse/touch to rotate, zoom, and pan</p>
              {arCapabilities.webXR && (
                <p className="text-green-600">✓ AR Ready - Click AR button to view in your space</p>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-500">
                WebGL: {arCapabilities.webGL ? '✓' : '✗'} |
                WebXR: {arCapabilities.webXR ? '✓' : '✗'} |
                Camera: {arCapabilities.camera ? '✓' : '✗'}
              </div>
              
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ARProductViewer;
