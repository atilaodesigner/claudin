import { BackSide, BufferAttribute, Color, Mesh, MeshBasicMaterial, PMREMGenerator, Scene, SphereGeometry, type Texture, type WebGLRenderer } from 'three';

/** Small procedural environment map so metallic surfaces (UFO, jets) have something to reflect. */
export function createEnvironmentMap(renderer: WebGLRenderer): Texture {
  const scene = new Scene();
  const geo = new SphereGeometry(10, 32, 16);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const top = new Color(0x3d8be0);
  const horizon = new Color(0xfff0d8);
  const ground = new Color(0x5d6b45);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) c.copy(horizon).lerp(top, Math.pow(y, 0.6));
    else c.copy(horizon).lerp(ground, Math.min(1, -y * 3));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  scene.add(new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
  const sun = new Mesh(new SphereGeometry(1.2, 12, 8), new MeshBasicMaterial({ color: new Color(8, 7.2, 6) }));
  sun.position.set(-5, 6, 4);
  scene.add(sun);
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  geo.dispose();
  return rt.texture;
}
