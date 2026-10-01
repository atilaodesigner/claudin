// Step 1: decimate a rigged GLB to a crowd-friendly triangle budget; the skin (JOINTS/WEIGHTS)
// and UVs survive. Tripo meshes have very fragmented UVs, so the simplifier runs in permissive
// mode (it may collapse across UV seams, weighted by how much the UVs would stretch).
//   node src/simplify.mjs <in.glb> <out.glb> [targetTris=6000]
import { NodeIO } from '@gltf-transform/core';
import { compactPrimitive, prune, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [input, output, targetArg] = process.argv.slice(2);
const target = Number(targetArg) || 6000;
await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(input);
await doc.transform(weld());

let before = 0;
let after = 0;
let verts = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    const pos = prim.getAttribute('POSITION');
    const uv = prim.getAttribute('TEXCOORD_0');
    const idx = new Uint32Array(indices.getArray());
    before += idx.length / 3;
    const positions = new Float32Array(pos.getArray());
    const attrs = uv ? new Float32Array(uv.getArray()) : new Float32Array(pos.getCount());
    const stride = uv ? 2 : 1;
    const weights = uv ? [0.5, 0.5] : [0];
    const [out] = MeshoptSimplifier.simplifyWithAttributes(idx, positions, 3, attrs, stride, weights, null, target * 3, Number(process.env.ERR || 0.05), ['Permissive']);
    const acc = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(out)).setBuffer(indices.getBuffer());
    prim.setIndices(acc);
    compactPrimitive(prim);
    after += out.length / 3;
    verts += prim.getAttribute('POSITION').getCount();
  }
}
await doc.transform(prune());
await io.write(output, doc);
console.log(`${input.split('/').pop()}: ${Math.round(before)} → ${Math.round(after)} tris, ${verts} verts`);
