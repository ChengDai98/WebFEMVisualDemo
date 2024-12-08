// Main application state
const state = {
    displacement: 0,
    mode: 'stress',
    elements: true,
    lines: true,
    ortho: true,
    subdivisions: 3
};

let canvas, engine, scene, camera, femMesh, cameraController;

// Initialize Babylon.js scene
function createScene() {
    canvas = document.getElementById('renderCanvas');
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);

    // Create camera
    camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI / 4,
        Math.PI / 4,
        10,
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);

    // Create light
    const light = new BABYLON.HemisphericLight(
        'light',
        new BABYLON.Vector3(0, 1, 0),
        scene
    );

    // Initialize camera controller
    cameraController = new FEMCameraController(camera);

    // Initialize FEM mesh handler
    femMesh = new FEMMesh(scene);

    return scene;
}

// Setup UI controls
function setupControls() {
    // Displacement slider
    const displacementSlider = document.getElementById('displacementSlider');
    if (displacementSlider) {
        displacementSlider.addEventListener('input', (e) => {
            state.displacement = parseFloat(e.target.value);
            updateMesh();
        });
    }

    // Mode selector
    const modeSelect = document.getElementById('modeSelect');
    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            state.mode = e.target.value;
            updateMesh();
        });
    }

    // Ortho checkbox
    const orthoCheckbox = document.getElementById('orthoCheckbox');
    if (orthoCheckbox) {
        orthoCheckbox.addEventListener('change', (e) => {
            state.ortho = e.target.checked;
            updateCamera();
        });
    }

    // Elements checkbox
    const elementsCheckbox = document.getElementById('elementsCheckbox');
    if (elementsCheckbox) {
        elementsCheckbox.addEventListener('change', (e) => {
            state.elements = e.target.checked;
            updateMesh();
        });
    }

    // Lines checkbox
    const linesCheckbox = document.getElementById('linesCheckbox');
    if (linesCheckbox) {
        linesCheckbox.addEventListener('change', (e) => {
            state.lines = e.target.checked;
            updateMesh();
        });
    }

    // Subdivisions slider
    const subdivisionsSlider = document.getElementById('subdivisionsSlider');
    if (subdivisionsSlider) {
        subdivisionsSlider.addEventListener('input', (e) => {
            state.subdivisions = parseInt(e.target.value);
            rebuildMesh();
        });
    }

    // File input
    const fileInput = document.getElementById('fileInput');
    const openFileButton = document.getElementById('openFileButton');
    if (fileInput && openFileButton) {
        openFileButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', handleFileUpload);
    }
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const meshData = JSON.parse(e.target.result);
            loadMeshData(meshData);
        } catch (error) {
            console.error('Error loading mesh file:', error);
            alert('Invalid mesh file format');
        }
    };
    reader.readAsText(file);
}

// Load mesh data
function loadMeshData(meshData) {
    try {
        femMesh.createFromData(meshData, state.subdivisions);
        updateMesh();
    } catch (error) {
        console.error('Error creating mesh:', error);
        alert('Error creating mesh from data');
    }
}

// Update mesh visualization
function updateMesh() {
    if (femMesh) {
        femMesh.draw({
            mode: state.mode,
            displacement: state.displacement,
            elements: state.elements,
            lines: state.lines
        });
    }
}

// Update camera settings
function updateCamera() {
    if (camera) {
        camera.mode = state.ortho ? 
            BABYLON.Camera.ORTHOGRAPHIC_CAMERA : 
            BABYLON.Camera.PERSPECTIVE_CAMERA;
    }
}

// Initialize everything
function init() {
    const scene = createScene();
    setupControls();

    // Start render loop
    engine.runRenderLoop(() => {
        scene.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        engine.resize();
    });

    const testMesh = {
        coordinates: [
            // Bottom face
            [-1, -1, -1],
            [1, -1, -1],
            [1, 1, -1],
            [-1, 1, -1],
            // Top face
            [-1, -1, 1],
            [1, -1, 1],
            [1, 1, 1],
            [-1, 1, 1]
        ],
        displacements: [
            [0, 0, 0],
            [0.1, 0, 0],
            [0.1, 0.1, 0],
            [0, 0.1, 0],
            [0, 0, 0.1],
            [0.1, 0, 0.1],
            [0.1, 0.1, 0.1],
            [0, 0.1, 0.1]
        ],
        elements: [{
            type: "P8",
            cells: [[0, 1, 2, 3, 4, 5, 6, 7]],
            stresses: [0.5]
        }],
        palette: [
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
            [1, 1, 0],
            [1, 0, 0]
        ]
    };
    
    loadMeshData(testMesh);
}

// Wait for DOM to load before initializing
window.addEventListener('DOMContentLoaded', init);