'use client';

import * as React from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { useApariencia } from '@/lib/store/apariencia';

/**
 * Logo 3D extrudido a partir de un SVG (editable desde Configuración).
 * Sigue el patrón del componente bienvenida de DIH: extrude geometry,
 * 3 grupos de color por ubicación de paths, rotación con mouse, flotar
 * vertical sinusoidal.
 *
 * Reglas de coloreado en función del bounding box del path:
 *  - maxX <= 520           → color "primary" (--brand-primary)
 *  - minY < 65             → color "muted" (texto secundario)
 *  - resto                 → color "accent" (--brand-accent)
 */
export function Logo3D({ className = '' }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const logoSvg = useApariencia(s => s.logoSvg);
  const tema = useApariencia(s => s.tema);
  const paleta = useApariencia(s => s.paleta);

  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;

    // Helper: leer var CSS a hex (Three.js usa números hex)
    const hslToHex = (cssVar: string): number => {
      const styles = getComputedStyle(document.documentElement);
      const hslStr = styles.getPropertyValue(cssVar).trim();
      if (!hslStr) return 0xffffff;
      const m = hslStr.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
      if (!m) return 0xffffff;
      const [h, s, l] = [parseFloat(m[1]!), parseFloat(m[2]!) / 100, parseFloat(m[3]!) / 100];
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = h / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      let r = 0, g = 0, b = 0;
      if (hp <= 1) { r = c; g = x; }
      else if (hp <= 2) { r = x; g = c; }
      else if (hp <= 3) { g = c; b = x; }
      else if (hp <= 4) { g = x; b = c; }
      else if (hp <= 5) { r = x; b = c; }
      else { r = c; b = x; }
      const m2 = l - c / 2;
      const toHex = (v: number) => Math.round((v + m2) * 255);
      return (toHex(r) << 16) | (toHex(g) << 8) | toHex(b);
    };

    const colorPrimary = hslToHex('--brand-primary');
    const colorAccent = hslToHex('--brand-accent');
    const colorMuted = tema === 'dark' ? 0xf1f3f5 : 0x222033;

    let logoGroup: THREE.Group | undefined;
    let logoSize: THREE.Vector3 | undefined;
    let mats: THREE.MeshStandardMaterial[] = [];
    let animationId = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const { clientWidth: w0, clientHeight: h0 } = host;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, Math.max(w0, 1) / Math.max(h0, 1), 0.1, 2000);
    camera.position.set(0, 0, 520);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w0, h0);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, tema === 'dark' ? 0.9 : 1.1);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, tema === 'dark' ? 1.0 : 0.9);
    key.position.set(180, 220, 340);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-200, -100, 120);
    scene.add(rim);

    // Construir logo desde SVG
    try {
      const loader = new SVGLoader();
      const data = loader.parse(logoSvg);

      const base = { metalness: 0.1, roughness: 0.45, side: THREE.DoubleSide as THREE.Side };
      const matPrimary = new THREE.MeshStandardMaterial({
        ...base, color: colorPrimary, emissive: colorPrimary, emissiveIntensity: 0.22,
      });
      const matMuted = new THREE.MeshStandardMaterial({
        ...base, color: colorMuted, emissive: 0x000000, emissiveIntensity: 0,
      });
      const matAccent = new THREE.MeshStandardMaterial({
        ...base, color: colorAccent, emissive: colorAccent, emissiveIntensity: 0.28,
      });
      mats = [matPrimary, matMuted, matAccent];

      const grupo = new THREE.Group();
      for (const path of data.paths) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 32,
            bevelEnabled: true,
            bevelThickness: 1.4,
            bevelSize: 0.9,
            bevelSegments: 3,
            curveSegments: 12,
          });
          geo.computeBoundingBox();
          const bb = geo.boundingBox!;
          let mat: THREE.MeshStandardMaterial;
          if (bb.max.x <= 520) mat = matPrimary;
          else if (bb.min.y < 65) mat = matMuted;
          else mat = matAccent;
          grupo.add(new THREE.Mesh(geo, mat));
        }
      }
      grupo.scale.y = -1;
      grupo.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(grupo);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      logoSize = size.clone();

      const wrapper = new THREE.Group();
      grupo.position.sub(center);
      wrapper.add(grupo);
      scene.add(wrapper);
      logoGroup = wrapper;
      ajustarEscala();
    } catch (err) {
      console.error('Error parseando SVG del logo:', err);
    }

    function ajustarEscala() {
      if (!logoGroup || !logoSize || !camera || !host) return;
      const { clientWidth: w, clientHeight: h } = host;
      if (w === 0 || h === 0 || logoSize.x === 0) return;
      const fovRad = (camera.fov * Math.PI) / 180;
      const distancia = camera.position.z;
      const anchoMundo = 2 * Math.tan(fovRad / 2) * distancia * (w / h);
      const altoMundo = 2 * Math.tan(fovRad / 2) * distancia;
      const margen = 0.88;
      const escalaPorAncho = (anchoMundo * margen) / logoSize.x;
      const escalaPorAlto = (altoMundo * margen) / Math.max(logoSize.y, 1);
      logoGroup.scale.setScalar(Math.min(escalaPorAncho, escalaPorAlto));
    }

    const onResize = () => {
      if (!renderer || !camera || !host) return;
      const { clientWidth: w, clientHeight: h } = host;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      ajustarEscala();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);
      targetRotY = Math.max(-1, Math.min(1, nx)) * 0.45;
      targetRotX = Math.max(-1, Math.min(1, ny)) * 0.25;
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const loop = () => {
      animationId = requestAnimationFrame(loop);
      if (!renderer || !scene || !camera || !logoGroup) return;
      const t = performance.now() * 0.001;
      logoGroup.position.y = Math.sin(t * 0.9) * 8;
      logoGroup.rotation.x += (targetRotX - logoGroup.rotation.x) * 0.05;
      logoGroup.rotation.y += (targetRotY - logoGroup.rotation.y) * 0.05;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(animationId);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      scene?.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach(m => m.dispose());
      if (renderer) {
        renderer.dispose();
        const dom = renderer.domElement;
        if (dom.parentElement) dom.parentElement.removeChild(dom);
      }
    };
  }, [logoSvg, tema, paleta]);

  return <div ref={ref} className={`${className} cursor-grab active:cursor-grabbing`} />;
}
