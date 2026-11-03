'use client';
import dynamic from 'next/dynamic';
import { useApp } from '@/lib/store';

const Canvas = dynamic(() => import('@shadergradient/react').then((m) => m.ShaderGradientCanvas), { ssr: false });
const Gradient = dynamic(() => import('@shadergradient/react').then((m) => m.ShaderGradient), { ssr: false });

// Your settings. Tweak any value here and save to see it change.
export const SHADER = {
  animate: 'on', axesHelper: 'off', bgColor1: '#000000', bgColor2: '#000000', brightness: 0.6,
  cAzimuthAngle: 180, cDistance: 3.6, cPolarAngle: 90, cameraZoom: 1,
  color1: '#ff0400', color2: '#db1c20', color3: '#211515', envPreset: 'city',
  gizmoHelper: 'hide', grain: 'on', lightType: '3d',
  positionX: -1.4, positionY: 0, positionZ: 0, range: 'disabled', rangeEnd: 40, rangeStart: 0,
  reflection: 0.1, rotationX: 0, rotationY: 10, rotationZ: 50, shader: 'defaults', type: 'plane',
  uAmplitude: 1, uDensity: 1.3, uFrequency: 5.5, uSpeed: 0.4, uStrength: 4, uTime: 0, wireframe: false,
};

export default function ShaderBg() {
  // alertHue: the captain's chosen color (38 is amber). preview: shown live while picking a color.
  const { attention, alertHue, preview } = useApp();
  const on = attention > 0 || preview;
  return (
    <div className={`shader${preview ? ' fast' : ''}`} aria-hidden="true" style={{ filter: `hue-rotate(${on ? alertHue : 0}deg)` }}>
      <Canvas style={{ position: 'absolute', inset: 0 }} pixelDensity={0.75} fov={40}>
        <Gradient control="props" {...SHADER} />
      </Canvas>
      <div className="shade" />
    </div>
  );
}
