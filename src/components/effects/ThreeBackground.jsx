import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeBackground({ effect = 'particles' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 5;

    let animId;
    let objects = [];

    if (effect === 'particles') {
      // Floating particle field
      const geometry = new THREE.BufferGeometry();
      const count = 1200;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        const t = Math.random();
        colors[i * 3] = t < 0.5 ? 0.1 : 0.6;
        colors[i * 3 + 1] = t < 0.5 ? 0.8 : 0.1;
        colors[i * 3 + 2] = t < 0.5 ? 0.9 : 0.9;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.7 });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
      objects.push(points);

      const animate = () => {
        animId = requestAnimationFrame(animate);
        points.rotation.x += 0.0003;
        points.rotation.y += 0.0005;
        renderer.render(scene, camera);
      };
      animate();

    } else if (effect === 'dna') {
      // DNA helix
      const helixGroup = new THREE.Group();
      const count = 80;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 6;
        const r = 1.2;
        // Strand 1
        const geo1 = new THREE.SphereGeometry(0.08, 8, 8);
        const mat1 = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
        const s1 = new THREE.Mesh(geo1, mat1);
        s1.position.set(Math.cos(t) * r, (i / count) * 8 - 4, Math.sin(t) * r);
        helixGroup.add(s1);
        // Strand 2
        const geo2 = new THREE.SphereGeometry(0.08, 8, 8);
        const mat2 = new THREE.MeshBasicMaterial({ color: 0x9b59b6 });
        const s2 = new THREE.Mesh(geo2, mat2);
        s2.position.set(Math.cos(t + Math.PI) * r, (i / count) * 8 - 4, Math.sin(t + Math.PI) * r);
        helixGroup.add(s2);
        // Connector
        if (i % 5 === 0) {
          const dir = new THREE.Vector3(
            Math.cos(t + Math.PI) * r - Math.cos(t) * r,
            0,
            Math.sin(t + Math.PI) * r - Math.sin(t) * r
          );
          const len = dir.length();
          const lineGeo = new THREE.CylinderGeometry(0.015, 0.015, len * 2, 4);
          const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
          const line = new THREE.Mesh(lineGeo, lineMat);
          line.position.set(0, (i / count) * 8 - 4, 0);
          line.rotation.z = Math.PI / 2;
          helixGroup.add(line);
        }
      }
      scene.add(helixGroup);
      objects.push(helixGroup);
      const animate = () => {
        animId = requestAnimationFrame(animate);
        helixGroup.rotation.y += 0.008;
        renderer.render(scene, camera);
      };
      animate();

    } else if (effect === 'grid') {
      // Neon grid plane
      const gridHelper = new THREE.GridHelper(30, 30, 0x00d4ff, 0x1a2540);
      gridHelper.position.y = -2;
      scene.add(gridHelper);
      // Floating cubes
      for (let i = 0; i < 20; i++) {
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const mat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0x00d4ff : 0x9b59b6,
          wireframe: true,
        });
        const cube = new THREE.Mesh(geo, mat);
        cube.position.set((Math.random() - 0.5) * 10, Math.random() * 4 - 1, (Math.random() - 0.5) * 10);
        scene.add(cube);
        objects.push(cube);
      }
      camera.position.set(0, 2, 8);
      camera.lookAt(0, 0, 0);
      let t = 0;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        t += 0.01;
        objects.forEach((obj, i) => {
          obj.rotation.x += 0.01 + i * 0.001;
          obj.rotation.y += 0.008;
          obj.position.y = Math.sin(t + i) * 0.5 + (i % 3) - 0.5;
        });
        renderer.render(scene, camera);
      };
      animate();

    } else if (effect === 'nebula') {
      // Nebula-like sphere cloud
      const count = 2000;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2 + Math.random() * 3;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        // Cyan to purple gradient
        col[i * 3] = 0.1 + Math.random() * 0.3;
        col[i * 3 + 1] = 0.3 + Math.random() * 0.5;
        col[i * 3 + 2] = 0.7 + Math.random() * 0.3;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.8 });
      const cloud = new THREE.Points(geo, mat);
      scene.add(cloud);
      const animate = () => {
        animId = requestAnimationFrame(animate);
        cloud.rotation.y += 0.001;
        cloud.rotation.x += 0.0005;
        renderer.render(scene, camera);
      };
      animate();
    }

    const handleResize = () => {
      const w2 = mount.clientWidth;
      const h2 = mount.clientHeight;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [effect]);

  return <div ref={mountRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}
