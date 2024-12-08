class FEMMesh {
    // Helper functions defined first as static methods
    static W8(a, b) {
        return [
            0.25 * (1 - a) * (b - 1) * (a + b + 1),
            0.5 * (1 - b) * (1 - a * a),
            0.25 * (1 + a) * (b - 1) * (b - a + 1),
            0.5 * (1 + a) * (1 - b * b),
            0.25 * (1 + a) * (1 + b) * (a + b - 1),
            0.5 * (1 + b) * (1 - a * a),
            0.25 * (a - 1) * (b + 1) * (a - b + 1),
            0.5 * (1 - a) * (1 - b * b)
        ];
    }

    static W6(a, b) {
        const c = 1 - a - b;
        return [
            a * (2 * a - 1),
            4 * a * b,
            b * (2 * b - 1),
            4 * b * c,
            c * (2 * c - 1),
            4 * c * a
        ];
    }

    static dot3(values, weights) {
        const result = [0, 0, 0];
        for (let i = 0; i < values.length; ++i) {
            const v = values[i];
            const w = weights[i];
            for (let j = 0; j < 3; ++j) {
                result[j] += w * v[j];
            }
        }
        return result;
    }

    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.material = null;
        this.center = [0, 0, 0];
        this.radius = 0;

        // Bind the static methods to the instance
        this.W8 = FEMMesh.W8;
        this.W6 = FEMMesh.W6;
        this.dot3 = FEMMesh.dot3;

        this.setupMaterials();
    }

    // Add this method to the FEMMesh class
    setupWireframe() {
        // Create wireframe material
        const wireMaterial = new BABYLON.StandardMaterial("wireMaterial", this.scene);
        wireMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);  // Black lines
        wireMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        wireMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
        wireMaterial.wireframe = true;
        wireMaterial.backFaceCulling = false;

        // Create wireframe mesh
        if (this.wireframeMesh) {
            this.wireframeMesh.dispose();
        }
        this.wireframeMesh = this.mesh.clone("wireframe");
        this.wireframeMesh.material = wireMaterial;
        this.wireframeMesh.position = this.mesh.position;
        
        // Slightly offset wireframe to prevent z-fighting
        this.wireframeMesh.scaling = new BABYLON.Vector3(1.001, 1.001, 1.001);
    }

    // Update the setupMaterials method in FEMMesh class
    setupMaterials() {
        const shaderMaterial = new BABYLON.ShaderMaterial(
            "customShader",
            this.scene,
            {
                vertex: "custom",
                fragment: "custom",
            },
            {
                attributes: ["position", "normal", "femDisplacement", "femStress"],
                uniforms: ["world", "worldView", "worldViewProjection", "displacementMag", "viewMode"]
            }
        );

        // Disable face culling to show all faces
        shaderMaterial.backFaceCulling = false;
        shaderMaterial.twoSidedLighting = true;

        // Update shaders with proper face handling
        BABYLON.Effect.ShadersStore["customVertexShader"] = `
            precision highp float;
            attribute vec3 position;
            attribute vec3 normal;
            attribute vec3 femDisplacement;
            attribute float femStress;
            uniform mat4 world;
            uniform mat4 worldViewProjection;
            uniform float displacementMag;
            uniform int viewMode;
            varying float vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vec3 displaced = position + femDisplacement * displacementMag;
                gl_Position = worldViewProjection * vec4(displaced, 1.0);
                vNormal = (world * vec4(normal, 0.0)).xyz;
                vPosition = (world * vec4(displaced, 1.0)).xyz;
                if (viewMode == 0) {
                    vColor = femStress;
                } else {
                    vColor = length(femDisplacement) * 5.0;
                }
            }
        `;

        // Update the fragment shader in setupMaterials
BABYLON.Effect.ShadersStore["customFragmentShader"] = `
precision highp float;
varying float vColor;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float light = max(0.3, dot(abs(normal), lightDir));
    
    vec3 baseColor;
    if (vColor < 0.5) {
        baseColor = mix(
            vec3(0.2, 0.2, 1.0),  // Lighter blue
            vec3(0.2, 1.0, 0.2),  // Lighter green
            vColor * 2.0
        );
    } else {
        baseColor = mix(
            vec3(0.2, 1.0, 0.2),  // Lighter green
            vec3(1.0, 0.2, 0.2),  // Lighter red
            (vColor - 0.5) * 2.0
        );
    }
    
    // Add slight transparency to make lines more visible
    vec3 finalColor = baseColor * light;
    gl_FragColor = vec4(finalColor, 0.95);
}
`;

        this.material = shaderMaterial;
    }

    processP8Element(cell, coordinates, displacements, stress, N, vertexBuilder) {
        // Define faces with correct winding order
        const faces = [
            [0, 3, 2, 1], // front
            [4, 5, 6, 7], // back
            [0, 1, 5, 4], // bottom
            [2, 3, 7, 6], // top
            [0, 4, 7, 3], // left
            [1, 2, 6, 5]  // right
        ];

        const cellCoords = cell.map(idx => coordinates[idx]);
        const cellDisp = cell.map(idx => displacements[idx]);
        const baseIndex = vertexBuilder.currentIndex;

        // Add vertices
        cellCoords.forEach((coord, i) => {
            vertexBuilder.positions.push(...coord);
            vertexBuilder.displacements.push(...cellDisp[i]);
            vertexBuilder.stresses.push(stress);
        });

        // Add faces with correct triangulation
        faces.forEach(face => {
            // First triangle
            vertexBuilder.indices.push(
                baseIndex + face[0],
                baseIndex + face[1],
                baseIndex + face[2]
            );
            // Second triangle
            vertexBuilder.indices.push(
                baseIndex + face[2],
                baseIndex + face[3],
                baseIndex + face[0]
            );
        });

        vertexBuilder.currentIndex += 8;
    }

    createFromData(data, subdivisions) {
        // ... (beginning remains the same)

        try {
            // ... (previous code remains the same)

            // Compute normals with proper orientation
            const normals = [];
            BABYLON.VertexData.ComputeNormals(
                vertexBuilder.positions,
                vertexBuilder.indices,
                normals
            );

            const vertexData = new BABYLON.VertexData();
            vertexData.positions = new Float32Array(vertexBuilder.positions);
            vertexData.indices = new Uint32Array(vertexBuilder.indices);
            vertexData.normals = normals;

            // Create mesh with proper settings
            if (this.mesh) {
                this.mesh.dispose();
            }
            
            this.mesh = new BABYLON.Mesh("femMesh", this.scene);
            vertexData.applyToMesh(this.mesh);

            // Enable both sides rendering
            this.mesh.material = this.material;
            this.mesh.isVisible = true;

            this.setupWireframe();

            // ... (rest remains the same)
        } catch (error) {
            console.error("Error in createFromData:", error);
            throw error;
        }
    }

// Update the processP6Element method similarly
processP6Element(cell, coordinates, displacements, stress, N, vertexBuilder) {
    // For P6 (prismatic) elements
    const faces = [
        [0, 1, 2],     // bottom
        [3, 4, 5],     // top
        [0, 1, 4, 3],  // front
        [1, 2, 5, 4],  // right
        [0, 2, 5, 3]   // back
    ];

    const cellCoords = cell.map(idx => coordinates[idx]);
    const cellDisp = cell.map(idx => displacements[idx]);

    // Add vertices
    for (let i = 0; i < 6; i++) {
        vertexBuilder.positions.push(...cellCoords[i]);
        vertexBuilder.displacements.push(...cellDisp[i]);
        vertexBuilder.stresses.push(stress);
    }

    // Add indices for each face
    faces.forEach(face => {
        if (face.length === 3) {
            // Triangle face
            vertexBuilder.indices.push(
                vertexBuilder.currentIndex + face[0],
                vertexBuilder.currentIndex + face[1],
                vertexBuilder.currentIndex + face[2]
            );
        } else {
            // Quad face - split into two triangles
            const baseIndex = vertexBuilder.currentIndex;
            vertexBuilder.indices.push(
                baseIndex + face[0],
                baseIndex + face[1],
                baseIndex + face[2],
                baseIndex + face[0],
                baseIndex + face[2],
                baseIndex + face[3]
            );
        }
    });

    vertexBuilder.currentIndex += 6; // 6 vertices per element
}


    processElement(type, cell, coordinates, displacements, stress, N, vertexBuilder) {
        if (type === 'P6') {
            this.processP6Element(cell, coordinates, displacements, stress, N, vertexBuilder);
        } else if (type === 'P8') {
            this.processP8Element(cell, coordinates, displacements, stress, N, vertexBuilder);
        } else {
            console.warn('Unsupported element type:', type);
        }
    }

    createFromData(data, subdivisions) {
        if (!data || !data.coordinates || !data.displacements || !data.elements) {
            throw new Error("Invalid mesh data: missing required fields");
        }

        try {
            const vertexBuilder = {
                positions: [],
                displacements: [],
                stresses: [],
                indices: [],
                currentIndex: 0
            };

            data.elements.forEach(({type, cells, stresses}) => {
                cells.forEach((cell, idx) => {
                    this.processElement(
                        type,
                        cell,
                        data.coordinates,
                        data.displacements,
                        stresses[idx],
                        subdivisions,
                        vertexBuilder
                    );
                });
            });

            if (this.mesh) {
                this.mesh.dispose();
            }

            // Create mesh
            this.mesh = new BABYLON.Mesh("femMesh", this.scene);

            // Apply basic vertex data
            const vertexData = new BABYLON.VertexData();
            vertexData.positions = new Float32Array(vertexBuilder.positions);
            vertexData.indices = new Uint32Array(vertexBuilder.indices);

            // Compute normals
            const normals = [];
            BABYLON.VertexData.ComputeNormals(
                vertexBuilder.positions,
                vertexBuilder.indices,
                normals
            );
            vertexData.normals = normals;

            vertexData.applyToMesh(this.mesh);

            // Create custom vertex buffers
            const engine = this.scene.getEngine();

            // Create displacement buffer
            const displacementBuffer = new BABYLON.Buffer(
                engine,
                new Float32Array(vertexBuilder.displacements),
                false,
                3,
                false,
                false
            );
            this.mesh.setVerticesBuffer(displacementBuffer.createVertexBuffer(
                "femDisplacement",
                0,
                3
            ));

            // Create stress buffer
            const stressBuffer = new BABYLON.Buffer(
                engine,
                new Float32Array(vertexBuilder.stresses),
                false,
                1,
                false,
                false
            );
            this.mesh.setVerticesBuffer(stressBuffer.createVertexBuffer(
                "femStress",
                0,
                1
            ));

            // Apply material
            this.mesh.material = this.material;
            this.material.setFloat("displacementMag", 0);
            this.material.setInt("viewMode", 0);

            this.calculateBounds(vertexBuilder.positions);
            
            console.log("Mesh created successfully");
            return true;
        } catch (error) {
            console.error("Error in createFromData:", error);
            throw error;
        }
    }

    calculateBounds(positions) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < positions.length; i += 3) {
            minX = Math.min(minX, positions[i]);
            maxX = Math.max(maxX, positions[i]);
            minY = Math.min(minY, positions[i + 1]);
            maxY = Math.max(maxY, positions[i + 1]);
            minZ = Math.min(minZ, positions[i + 2]);
            maxZ = Math.max(maxZ, positions[i + 2]);
        }

        this.center = [
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        ];

        this.radius = Math.sqrt(
            Math.pow(maxX - minX, 2) +
            Math.pow(maxY - minY, 2) +
            Math.pow(maxZ - minZ, 2)
        ) / 2;
    }

    draw(options) {
        if (!this.mesh || !this.material) return;
    
        const {displacement = 0, mode = 'stress', lines = true} = options;
        
        // Update main mesh
        this.material.setFloat("displacementMag", displacement * 0.01);
        this.material.setInt("viewMode", mode === 'stress' ? 0 : 1);
        this.mesh.isVisible = true;
    
        // Update wireframe visibility
        if (this.wireframeMesh) {
            this.wireframeMesh.isVisible = lines;
            if (lines) {
                // Update wireframe position to match main mesh deformation
                this.wireframeMesh.setVerticesData(
                    BABYLON.VertexBuffer.PositionKind,
                    this.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)
                );
            }
        }
    }
}