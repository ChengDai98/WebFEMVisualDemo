class FEMCameraController {
    constructor(camera) {
        this.camera = camera;
        this.state = {
            polar: [Math.PI / 4, Math.PI / 16, 0],
            dpolar: [0, 0, 0],
            center: [0, 0, 0]
        };
        
        // Initialize gesture controls
        this.setupGestureControls();
        
        // Start the update loop
        this.lastTime = performance.now();
        this.update = this.update.bind(this);
        requestAnimationFrame(this.update);
    }

    setupGestureControls() {
        const canvas = this.camera.getScene().getEngine().getRenderingCanvas();
        let prevX = 0;
        let prevY = 0;
        let isPointerDown = false;

        // Mouse down
        canvas.addEventListener('pointerdown', (evt) => {
            if (evt.button === 0) {  // Left click only
                isPointerDown = true;
                prevX = evt.clientX;
                prevY = evt.clientY;
            }
        });

        // Mouse move
        canvas.addEventListener('pointermove', (evt) => {
            if (!isPointerDown) return;
            
            const dx = (evt.clientX - prevX) / window.innerWidth;
            const dy = (prevY - evt.clientY) / window.innerHeight;
            
            this.state.dpolar[0] += dx;  // Theta (horizontal rotation)
            this.state.dpolar[1] -= dy;  // Phi (vertical rotation)
            
            prevX = evt.clientX;
            prevY = evt.clientY;
        });

        // Mouse up
        canvas.addEventListener('pointerup', () => {
            isPointerDown = false;
        });

        // Mouse wheel
        canvas.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            let s = evt.deltaY || 0;
            
            switch (evt.deltaMode) {
                case 1:  // LINE mode
                    s *= 16;
                    break;
                case 2:  // PAGE mode
                    s *= window.innerHeight;
                    break;
            }
            
            this.state.dpolar[2] += 0.25 * s / window.innerHeight;  // Radius (zoom)
        });
    }

    clamp(x, lo, hi) {
        return Math.max(lo, Math.min(x, hi));
    }

    integrate() {
        // Update polar coordinates with momentum
        for (let i = 0; i < 3; ++i) {
            this.state.polar[i] += 0.8 * this.state.dpolar[i];
            this.state.dpolar[i] *= 0.8;  // Decay momentum
        }

        // Clamp vertical rotation and zoom
        this.state.polar[1] = this.clamp(this.state.polar[1], -0.495 * Math.PI, 0.495 * Math.PI);
        this.state.polar[2] = this.clamp(this.state.polar[2], -5, 10);

        // Convert polar to cartesian coordinates
        const [theta, phi, logRadius] = this.state.polar;
        const radius = Math.exp(logRadius);
        
        // Update camera position
        const x = radius * Math.cos(theta) * Math.cos(phi) + this.state.center[0];
        const y = radius * Math.sin(phi) + this.state.center[1];
        const z = radius * Math.sin(theta) * Math.cos(phi) + this.state.center[2];
        
        // Update Babylon camera
        this.camera.position = new BABYLON.Vector3(x, y, z);
        this.camera.setTarget(BABYLON.Vector3.FromArray(this.state.center));
    }

    update() {
        this.integrate();
        requestAnimationFrame(this.update);
    }

    setCenter(center) {
        this.state.center = center;
    }

    setRadius(radius) {
        this.state.polar[2] = Math.log(radius);
    }
}