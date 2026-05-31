'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { School } from '@/lib/nycu';

interface GlobeProps {
  schools: School[];
  selectedId: number | null;
  onSchoolClick: (school: School) => void;
}

type GlobeControls = {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableDamping: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type GlobeApi = {
  globeImageUrl: (url: string) => GlobeApi;
  bumpImageUrl: (url: string) => GlobeApi;
  backgroundImageUrl: (url: string) => GlobeApi;
  backgroundColor: (color: string) => GlobeApi;
  showAtmosphere: (value: boolean) => GlobeApi;
  atmosphereColor: (color: string) => GlobeApi;
  atmosphereAltitude: (altitude: number) => GlobeApi;
  globeMaterial: (material: THREE.Material) => GlobeApi;
  showGlobe: (value: boolean) => GlobeApi;
  showGraticules: (value: boolean) => GlobeApi;
  pointLabel: (accessor: (school: School) => string) => GlobeApi;
  pointsData: (schools: School[]) => GlobeApi;
  customLayerData: (schools: School[]) => GlobeApi;
  customLayerLabel: (accessor: (school: School) => string) => GlobeApi;
  customThreeObject: (accessor: (school: School) => THREE.Object3D) => GlobeApi;
  customThreeObjectUpdate: (accessor: (object: THREE.Object3D, school: School) => void) => GlobeApi;
  onCustomLayerClick: (handler: (school: School) => void) => GlobeApi;
  onZoom: (handler: (pov: { lat: number; lng: number; altitude: number }) => void) => GlobeApi;
  pointOfView: () => { lat: number; lng: number; altitude: number };
  width: (value: number) => GlobeApi;
  height: (value: number) => GlobeApi;
  renderer: () => THREE.WebGLRenderer;
  controls: () => GlobeControls;
  getCoords: (lat: number, lng: number, altitude: number) => { x: number; y: number; z: number };
  _resizeObserver?: ResizeObserver;
  _destructor?: () => void;
};

const EARTH_TEXTURE =
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.0/example/img/earth-blue-marble.jpg';
const EARTH_BUMP =
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.0/example/img/earth-topology.png';
const SKY_TEXTURE =
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.0/example/img/night-sky.png';

function applyRendererQuality(
  globe: GlobeApi,
  mount: HTMLElement,
  pinTexture?: THREE.Texture | null,
) {
  const renderer = globe.renderer();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);

  if (pinTexture) {
    pinTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    pinTexture.minFilter = THREE.LinearFilter;
    pinTexture.magFilter = THREE.LinearFilter;
    pinTexture.needsUpdate = true;
  }
}

function computeMarkerScale(cameraAltitude: number, selected: boolean) {
  const altitude = Math.max(0.12, Math.min(3.2, cameraAltitude || 2.5));
  const zoomFactor = Math.pow(altitude / 2.5, 0.82);
  const baseW = selected ? 6.8 : 5.2;
  const baseH = selected ? 9.2 : 6.8;
  return {
    x: Math.max(1.1, baseW * zoomFactor),
    y: Math.max(1.5, baseH * zoomFactor),
  };
}

export default function GlobeComponent({ schools, selectedId, onSchoolClick }: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeApi | null>(null);
  const onSchoolClickRef = useRef(onSchoolClick);
  const selectedIdRef = useRef(selectedId);
  const schoolsRef = useRef(schools);
  const cameraAltitudeRef = useRef(2.5);

  useEffect(() => {
    onSchoolClickRef.current = onSchoolClick;
  }, [onSchoolClick]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (globeRef.current) {
      globeRef.current.customLayerData([...schoolsRef.current]);
    }
  }, [selectedId]);

  useEffect(() => {
    schoolsRef.current = schools;
  }, [schools]);

  useEffect(() => {
    if (!mountRef.current) return;

    let canceled = false;
    let pinTexture: THREE.Texture | null = null;
    let activeGlobe: GlobeApi | null = null;

    const refreshMarkers = () => {
      if (!activeGlobe) return;
      activeGlobe.customLayerData([...schoolsRef.current]);
    };

    import('globe.gl').then(({ default: Globe }) => {
      if (canceled || !mountRef.current) return;
      pinTexture = new THREE.TextureLoader().load('/map-pin.svg');
      pinTexture.colorSpace = THREE.SRGBColorSpace;
      const GlobeConstructor = Globe as unknown as new (
        element: HTMLElement,
        config?: { rendererConfig?: THREE.WebGLRendererParameters },
      ) => GlobeApi;

      const globeInstance = new GlobeConstructor(mountRef.current, {
        rendererConfig: {
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        },
      })
        .globeImageUrl(EARTH_TEXTURE)
        .bumpImageUrl(EARTH_BUMP)
        .backgroundImageUrl(SKY_TEXTURE)
        .backgroundColor('#020617')
        .showAtmosphere(true)
        .atmosphereColor('lightskyblue')
        .atmosphereAltitude(0.15)
        .globeMaterial(
          new THREE.MeshPhongMaterial({
            color: 0x2e4d76,
            emissive: 0x071621,
            specular: 0x88c0d0,
            shininess: 20,
          }),
        )
        .showGlobe(true)
        .showGraticules(true)
        .pointLabel((d) => `${d.name_en || d.name} · ${d.country}`)
        .pointsData([])
        .customLayerData([])
        .customLayerLabel((d) => `${d.name_en || d.name}<br/>${d.name || ''}<br/>${d.country}`)
        .customThreeObject((d) => {
          const scale = computeMarkerScale(cameraAltitudeRef.current, selectedIdRef.current === d.id);
          const marker = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: pinTexture,
              transparent: true,
              depthWrite: false,
            }),
          );
          marker.scale.set(scale.x, scale.y, 1);
          marker.renderOrder = 10;
          return marker;
        })
        .customThreeObjectUpdate((obj, d) => {
          const coords = activeGlobe?.getCoords(d.lat, d.lng, selectedIdRef.current === d.id ? 0.04 : 0.02);
          if (coords) Object.assign(obj.position, coords);
          const scale = computeMarkerScale(cameraAltitudeRef.current, selectedIdRef.current === d.id);
          obj.scale.set(scale.x, scale.y, 1);
        })
        .onCustomLayerClick((d) => onSchoolClickRef.current?.(d))
        .onZoom((pov) => {
          cameraAltitudeRef.current = pov.altitude ?? cameraAltitudeRef.current;
          refreshMarkers();
        });

      activeGlobe = globeInstance;
      globeRef.current = globeInstance;
      cameraAltitudeRef.current = globeInstance.pointOfView()?.altitude ?? 2.5;
      globeInstance.customLayerData(schoolsRef.current);
      globeInstance.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
      applyRendererQuality(globeInstance, mountRef.current, pinTexture);
      globeInstance.controls().autoRotate = true;
      globeInstance.controls().autoRotateSpeed = 0.15;
      globeInstance.controls().enableDamping = true;

      const handleControlChange = () => {
        const nextAltitude = globeInstance.pointOfView()?.altitude;
        if (nextAltitude === undefined) return;
        if (Math.abs(nextAltitude - cameraAltitudeRef.current) < 0.01) return;
        cameraAltitudeRef.current = nextAltitude;
        refreshMarkers();
      };
      globeInstance.controls().addEventListener('change', handleControlChange);

      const resizeObserver = new ResizeObserver(() => {
        if (mountRef.current && globeRef.current) {
          globeRef.current.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
          applyRendererQuality(globeRef.current, mountRef.current, pinTexture);
        }
      });
      resizeObserver.observe(mountRef.current);

      globeRef.current._resizeObserver = resizeObserver;
      (globeRef.current as GlobeApi & { _controlListener?: () => void })._controlListener = handleControlChange;
    });

    return () => {
      canceled = true;
      const resizeObserver = globeRef.current?._resizeObserver;
      if (resizeObserver) resizeObserver.disconnect();
      const controlListener = (globeRef.current as GlobeApi & { _controlListener?: () => void })?._controlListener;
      if (controlListener) globeRef.current?.controls().removeEventListener('change', controlListener);
      pinTexture?.dispose?.();
      globeRef.current?._destructor?.();
      globeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.customLayerData([...schools]);
  }, [schools]);

  return <div ref={mountRef} className="h-full w-full min-h-[640px]" />;
}
