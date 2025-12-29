import { STRUCTURE_SCALE } from '../config/constants.js';

export function createHouse() {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const mesh = new THREE.Mesh(geo, mat);

    //mesh.scale.setScalar(STRUCTURE_SCALE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}
