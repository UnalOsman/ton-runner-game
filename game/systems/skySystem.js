export class SkySystem {
    constructor(scene, light) {
        this.scene = scene;
        this.light = light; // Directional Light (Sun)

        this.sky = new THREE.Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        this.sun = new THREE.Vector3();

        // Sky Parameters
        this.effectController = {
            turbidity: 0.1, // Very clear air (removed whiteness)
            rayleigh: 1.0, // Authentic blue scattering
            mieCoefficient: 0.005,
            mieDirectionalG: 0.7,
            elevation: 50, // Mid-day sun
            azimuth: 180,
            exposure: 0.5
        };

        this.updateSky();
    }

    updateSky() {
        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = this.effectController.turbidity;
        uniforms['rayleigh'].value = this.effectController.rayleigh;
        uniforms['mieCoefficient'].value = this.effectController.mieCoefficient;
        uniforms['mieDirectionalG'].value = this.effectController.mieDirectionalG;

        const phi = THREE.MathUtils.degToRad(90 - this.effectController.elevation);
        const theta = THREE.MathUtils.degToRad(this.effectController.azimuth);

        this.sun.setFromSphericalCoords(1, phi, theta);

        uniforms['sunPosition'].value.copy(this.sun);

        // Match Directional Light to Sun Position
        if (this.light) {
            this.light.position.copy(this.sun).normalize().multiplyScalar(50);
        }

        // Adjust Fog to match sky
        if (this.scene.fog) {
            // this.scene.fog.color.setHSL( 0.6, 0.75, 0.95 ); // Optional
        }
    }
}
