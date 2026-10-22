/**
 * ClearBill AI - Three.js 3D Terminal & Barcode Scanner Showcase
 * Compliant with Three.js skill: PBR RoomEnvironment, procedural composite model,
 * contact shadow, damped animation loop, and collapsible bottom dock.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface ThreeScannerProps {
  onScanSimulated?: (barcode: string) => void;
}

export const ThreeScannerShowcase: React.FC<ThreeScannerProps> = ({ onScanSimulated }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [selectedFinish, setSelectedFinish] = useState<'white' | 'navy' | 'emerald'>('white');
  const [laserActive, setLaserActive] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  const sceneRefs = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    scannerGroup?: THREE.Group;
    laserMesh?: THREE.Mesh;
    displayTexture?: THREE.CanvasTexture;
    casingMaterials?: THREE.MeshStandardMaterial[];
    frameId?: number;
    targetRotationY: number;
    currentRotationY: number;
  }>({
    targetRotationY: 0,
    currentRotationY: 0,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // 1. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Scene & Environment
    const scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.8, 3.8);
    camera.lookAt(0, 0.6, 0);

    // 4. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(3, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(-3, 2, -3);
    scene.add(rimLight);

    // 5. Contact Shadow Ground Plane
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.18)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.002;
    scene.add(shadowMesh);

    // 6. Composite 8-Part Procedural Model: ClearBill Smart Scanner Terminal
    const scannerGroup = new THREE.Group();
    const casingMaterials: THREE.MeshStandardMaterial[] = [];

    // Part 1: Heavy Base Stand
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.62, 0.12, 36);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.25,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.06;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    scannerGroup.add(baseMesh);

    // Part 2: Articulated Swivel Neck Arm
    const neckGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.55, 24);
    const neckMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.2,
    });
    const neckMesh = new THREE.Mesh(neckGeo, neckMat);
    neckMesh.position.set(0, 0.38, 0);
    neckMesh.rotation.x = 0.15;
    neckMesh.castShadow = true;
    scannerGroup.add(neckMesh);

    // Part 3: Main Scanner Head Housing
    const headGeo = new THREE.BoxGeometry(0.75, 0.65, 0.55);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.15,
      roughness: 0.18,
    });
    casingMaterials.push(casingMat);
    const headMesh = new THREE.Mesh(headGeo, casingMat);
    headMesh.position.set(0, 0.78, 0.06);
    headMesh.rotation.x = 0.18;
    headMesh.castShadow = true;
    scannerGroup.add(headMesh);

    // Part 4: Beveled Optical Front Bezel
    const bezelGeo = new THREE.BoxGeometry(0.68, 0.48, 0.08);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.5,
      roughness: 0.4,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 0.76, 0.34);
    bezelMesh.rotation.x = 0.18;
    scannerGroup.add(bezelMesh);

    // Part 5: Optical Glass Window
    const glassGeo = new THREE.PlaneGeometry(0.58, 0.38);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.9,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(0, 0.76, 0.385);
    glassMesh.rotation.x = 0.18;
    scannerGroup.add(glassMesh);

    // Part 6: Procedural Digital OLED Display on Top
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = 512;
    displayCanvas.height = 256;
    const dCtx = displayCanvas.getContext('2d');
    if (dCtx) {
      dCtx.fillStyle = '#0F172A';
      dCtx.fillRect(0, 0, 512, 256);
      dCtx.fillStyle = '#16A34A';
      dCtx.font = 'bold 32px sans-serif';
      dCtx.fillText('CLEARBILL AI · READY', 36, 75);
      dCtx.fillStyle = '#94A3B8';
      dCtx.font = '24px monospace';
      dCtx.fillText('SCANNER: MULTI-FORMAT', 36, 125);
      dCtx.fillText('EAN13 / EAN8 / UPC / C128', 36, 165);
      dCtx.fillStyle = '#38BDF8';
      dCtx.fillText('PAPERLESS: 100% ACTIVE', 36, 210);
    }
    const displayTexture = new THREE.CanvasTexture(displayCanvas);
    displayTexture.colorSpace = THREE.SRGBColorSpace;
    const displayGeo = new THREE.PlaneGeometry(0.52, 0.26);
    const displayMat = new THREE.MeshBasicMaterial({ map: displayTexture });
    const displayMesh = new THREE.Mesh(displayGeo, displayMat);
    displayMesh.position.set(0, 1.11, 0.02);
    displayMesh.rotation.x = -Math.PI / 2.3;
    scannerGroup.add(displayMesh);

    // Part 7: LED Status Light Ring
    const ringGeo = new THREE.TorusGeometry(0.09, 0.015, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x16a34a });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0.96, 0.35);
    ringMesh.rotation.x = 0.18;
    scannerGroup.add(ringMesh);

    // Part 8: Laser Scan Plane / Beam (Activated on simulation)
    const laserGeo = new THREE.PlaneGeometry(0.7, 0.04);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.position.set(0, 0.76, 0.45);
    laserMesh.rotation.x = 0.18;
    scannerGroup.add(laserMesh);

    scene.add(scannerGroup);

    sceneRefs.current = {
      renderer,
      scene,
      camera,
      scannerGroup,
      laserMesh,
      displayTexture,
      casingMaterials,
      targetRotationY: 0,
      currentRotationY: 0,
    };

    // 7. Animation Loop with Exponential Damping
    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (isRotating) {
        sceneRefs.current.targetRotationY += dt * 0.45;
      }

      // Smooth damping (1 - Math.exp(-k * dt))
      const k = 6.0;
      const factor = 1 - Math.exp(-k * dt);
      sceneRefs.current.currentRotationY += (sceneRefs.current.targetRotationY - sceneRefs.current.currentRotationY) * factor;

      if (scannerGroup) {
        scannerGroup.rotation.y = sceneRefs.current.currentRotationY;
      }

      // Laser sweep pulse if active
      if (laserMesh && laserMesh.material instanceof THREE.MeshBasicMaterial) {
        if (laserActive) {
          laserMesh.material.opacity = 0.85 + Math.sin(time * 0.02) * 0.15;
          laserMesh.position.y = 0.76 + Math.sin(time * 0.01) * 0.12;
        } else {
          laserMesh.material.opacity = 0;
        }
      }

      renderer.render(scene, camera);
      sceneRefs.current.frameId = requestAnimationFrame(animate);
    };

    sceneRefs.current.frameId = requestAnimationFrame(animate);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRefs.current.frameId) {
        cancelAnimationFrame(sceneRefs.current.frameId);
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRotating, laserActive]);

  // Handle Finish Color change
  useEffect(() => {
    const mats = sceneRefs.current.casingMaterials;
    if (!mats) return;

    let targetColor = 0xffffff;
    let targetRoughness = 0.18;
    let targetMetalness = 0.15;

    if (selectedFinish === 'navy') {
      targetColor = 0x172033;
      targetRoughness = 0.3;
      targetMetalness = 0.4;
    } else if (selectedFinish === 'emerald') {
      targetColor = 0x16a34a;
      targetRoughness = 0.25;
      targetMetalness = 0.3;
    }

    mats.forEach(m => {
      m.color.setHex(targetColor);
      m.roughness = targetRoughness;
      m.metalness = targetMetalness;
    });
  }, [selectedFinish]);

  const triggerLaserScan = () => {
    setLaserActive(true);
    // Beep synthesis via Web Audio API (procedural audio)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1480, audioCtx.currentTime); // 1.48kHz scan beep
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext fallback
    }

    setTimeout(() => {
      setLaserActive(false);
      if (onScanSimulated) {
        onScanSimulated('8901030383786'); // Tata Tea Gold test barcode
      }
    }, 900);
  };

  return (
    <div className="relative w-full h-[400px] md:h-[460px] bg-gradient-to-b from-slate-50 to-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col items-center justify-between">
      {/* Top Spec Header */}
      <div className="absolute top-4 left-6 z-10 flex items-center gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">ClearBill OmniScan 3D Terminal</h4>
          <p className="text-xs text-slate-500">Interactive Procedural Hardware View</p>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Collapsible Unified Bottom Control Dock (<= 15% Viewport footprint) */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center max-w-[94%]">
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="text-[11px] font-medium text-slate-600 bg-white/90 hover:bg-white border border-slate-200 px-3 py-0.5 rounded-t-md shadow-xs transition-colors"
        >
          {isDockCollapsed ? '▴ Show 3D Controls' : '▾ Hide Controls'}
        </button>

        {!isDockCollapsed && (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-md flex items-center flex-wrap gap-4 text-xs text-slate-700">
            {/* Rotation Toggle */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500">Orbit:</span>
              <button
                onClick={() => setIsRotating(!isRotating)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  isRotating ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isRotating ? 'Auto-Rotate' : 'Paused'}
              </button>
            </div>

            {/* Casing Finish Swatches */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500">Finish:</span>
              <div className="flex items-center gap-1.5">
                <button
                  title="Industrial White"
                  onClick={() => setSelectedFinish('white')}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    selectedFinish === 'white' ? 'border-emerald-600 scale-110 shadow-xs' : 'border-slate-300'
                  } bg-white`}
                />
                <button
                  title="Matte Navy"
                  onClick={() => setSelectedFinish('navy')}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    selectedFinish === 'navy' ? 'border-emerald-600 scale-110 shadow-xs' : 'border-slate-300'
                  } bg-[#172033]`}
                />
                <button
                  title="Emerald Tech"
                  onClick={() => setSelectedFinish('emerald')}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    selectedFinish === 'emerald' ? 'border-slate-900 scale-110 shadow-xs' : 'border-slate-300'
                  } bg-emerald-600`}
                />
              </div>
            </div>

            {/* Simulated Scan Trigger */}
            <button
              onClick={triggerLaserScan}
              disabled={laserActive}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-xs active:scale-95 flex items-center gap-1.5"
            >
              <span>{laserActive ? 'Beam Active...' : 'Simulate Laser Scan'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
