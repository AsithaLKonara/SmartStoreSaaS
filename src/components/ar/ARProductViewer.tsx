'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';

interface ARProductViewerProps {
  productId: string;
  modelUrl: string;
  modelType: 'gltf' | 'glb' | 'obj';
}

export function ARProductViewer({ productId, modelUrl, modelType }: ARProductViewerProps) {
  const [isARSupported, setIsARSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for WebXR support
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      (navigator as any).xr.isSessionSupported('immersive-ar').then((supported: boolean) => {
        setIsARSupported(supported);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

<<<<<<< HEAD
  const startAR = async () => {
    if (!isARSupported) {
      alert('AR is not supported in this browser. Please use a compatible device.');
=======
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
                (progress: { loaded: number; total: number }) => {
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
      model.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).castShadow = true;
          (child as THREE.Mesh).receiveShadow = true;
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
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
      return;
    }

    try {
<<<<<<< HEAD
      const session = await (navigator as any).xr.requestSession('immersive-ar');
      // AR session would be initialized here
      // In production, this would use a 3D library like Three.js with AR capabilities
      console.log('AR session started:', session);
=======
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
        const session = rendererRef.current?.xr.getSession();
        if (session) {
          await session.end();
          setIsARMode(false);
        }
      }
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
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
