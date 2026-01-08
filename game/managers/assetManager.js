export class AssetManager {
    constructor() {
        this.manager = new THREE.LoadingManager();
        this.fbxLoader = new THREE.FBXLoader(this.manager);
        this.assets = {};
        this.isLoaded = false;

        // Setup default loading manager events
        this.manager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`Started loading: ${url}.nLoaded ${itemsLoaded} of ${itemsTotal} files.`);
        };

        this.manager.onLoad = () => {
            console.log('Loading complete!');
            this.isLoaded = true;
            if (this.onLoadCallback) this.onLoadCallback();
        };

        this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            console.log(`Loading file: ${url}.nLoaded ${itemsLoaded} of ${itemsTotal} files.`);
        };

        this.manager.onError = (url) => {
            console.log('There was an error loading ' + url);
        };
    }

    loadAll(onLoadCallback, onProgressCallback) {
        this.onLoadCallback = onLoadCallback;
        this.onProgressCallback = onProgressCallback;

        this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            console.log(`Loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`);
            if (this.onProgressCallback) {
                this.onProgressCallback(itemsLoaded, itemsTotal);
            }
        };

        // KARAKTER
        this.loadFBX('player', 'assets/karakterler/blup3run.fbx');
        this.loadFBX('animJump', 'assets/karakterler/blup3jump.fbx', true);
        this.loadFBX('animRoll', 'assets/karakterler/blup3rolling.fbx', true);

        // ENGELLER
        this.loadFBX('car1', 'assets/engeller/araba1.fbx');
        this.loadFBX('car2', 'assets/engeller/araba2.fbx');
        this.loadFBX('log', 'assets/engeller/kütük.fbx');
        this.loadFBX('barrier', 'assets/engeller/engel1.fbx');

        // TOPLANABİLİR
        this.loadFBX('turtle', 'assets/karakterler/blupturta.fbx');

        // YOL
        this.loadFBX('road', 'assets/zeminler/blupyol.fbx');

        // BÜYÜK YAPILAR
        const buildings = [
            'blupHouse1', 'blupHouse2', 'blupHouse3',
            'blupHouse4', 'blupHouse5', 'blupHouse6',
            'blupotopark'
        ];
        buildings.forEach(name => {
            this.loadFBX(name, `assets/yapilar/${name}.fbx`);
        });

        // DOLDURUCU OBJELER
        const fillers = ['bluplamba', 'blupTree1', 'blupTree2'];
        fillers.forEach(name => {
            this.loadFBX(name, `assets/yapilar/${name}.fbx`);
        });

        // ÜST GEÇİT
        this.loadFBX('overpass', 'assets/yapilar/blupgecit.fbx');
    }

    loadFBX(key, path, isAnimationOnly = false) {
        this.fbxLoader.load(path, (object) => {
            if (isAnimationOnly) {
                // Sadece animasyonu al
                if (object.animations && object.animations.length > 0) {
                    this.assets[key] = object.animations[0];
                }
            } else {
                // Modele gölge özelliklerini ekle
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.assets[key] = object;
            }
        });
    }

    get(key) {
        return this.assets[key];
    }

    clone(key) {
        const asset = this.assets[key];
        if (!asset) {
            console.warn(`Asset not found: ${key}`);
            return null;
        }
        // Animation Clip: Direct return
        if (asset instanceof THREE.AnimationClip) return asset;

        // Skinned Mesh: Use SkeletonUtils for proper bone cloning
        if (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) {
            return THREE.SkeletonUtils.clone(asset);
        }

        // Fallback (might break animations/skinning)
        return asset.clone();
    }
}
