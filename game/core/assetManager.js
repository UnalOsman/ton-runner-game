export class AssetManager {
    constructor() {
        this.models = {};
    }

    loadGLTF(name, path, loader) {
        return new Promise(resolve => {
            loader.load(path, gltf => {
                this.models[name] = gltf.scene;
                resolve();
            });
        });
    }

    getModel(name) {
        return this.models[name].clone();
    }
}
