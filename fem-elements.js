class FEMElementProcessor {
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

    static processP6Element(cell, coordinates, displacements, stress, N, vertexData) {
        const QUAD_TRIS = [
            [0, 0], [0, 1], [1, 0],
            [1, 0], [0, 1], [1, 1]
        ];

        const vertices = [];
        const dispVectors = [];
        const stresses = [];
        const indices = [];

        // Get cell coordinates and displacements
        const cellCoords = cell.map(idx => coordinates[idx]);
        const cellDisp = cell.map(idx => displacements[idx]);

        // Generate vertices for subdivided element
        for (let i = 0; i < N; ++i) {
            for (let j = 0; i + j < N; ++j) {
                const COUNT = (i + j === N - 1) ? 3 : 6;
                
                for (let v = 0; v < COUNT; ++v) {
                    const a = (i + QUAD_TRIS[v][0]) / N;
                    const b = (j + QUAD_TRIS[v][1]) / N;
                    
                    const W = this.W6(a, b);
                    const pos = this.dot3(cellCoords, W);
                    const disp = this.dot3(cellDisp, W);
                    
                    vertices.push(...pos);
                    dispVectors.push(...disp);
                    stresses.push(stress);
                    indices.push(vertexData.currentIndex++);
                }
            }
        }

        return {
            positions: vertices,
            displacements: dispVectors,
            stresses: stresses,
            indices: indices
        };
    }

    static processP8Element(cell, coordinates, displacements, stress, N, vertexData) {
        const vertices = [];
        const dispVectors = [];
        const stresses = [];
        const indices = [];

        // Get cell coordinates and displacements
        const cellCoords = cell.map(idx => coordinates[idx]);
        const cellDisp = cell.map(idx => displacements[idx]);

        // Generate vertices for subdivided element
        for (let i = 0; i < N; ++i) {
            for (let j = 0; j < N; ++j) {
                for (let v = 0; v < 6; ++v) {
                    const a = 2 * (i + QUAD_TRIS[v][0]) / N - 1;
                    const b = 2 * (j + QUAD_TRIS[v][1]) / N - 1;
                    
                    const W = this.W8(a, b);
                    const pos = this.dot3(cellCoords, W);
                    const disp = this.dot3(cellDisp, W);
                    
                    vertices.push(...pos);
                    dispVectors.push(...disp);
                    stresses.push(stress);
                    indices.push(vertexData.currentIndex++);
                }
            }
        }

        return {
            positions: vertices,
            displacements: dispVectors,
            stresses: stresses,
            indices: indices
        };
    }
}

// Helper class for managing vertex data
class VertexDataBuilder {
    constructor() {
        this.positions = [];
        this.displacements = [];
        this.stresses = [];
        this.indices = [];
        this.currentIndex = 0;
    }

    addElement(elementData) {
        this.positions.push(...elementData.positions);
        this.displacements.push(...elementData.displacements);
        this.stresses.push(...elementData.stresses);
        this.indices.push(...elementData.indices);
    }

    createVertexData() {
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = new Float32Array(this.positions);
        vertexData.indices = new Uint32Array(this.indices);
        return {
            vertexData,
            displacements: new Float32Array(this.displacements),
            stresses: new Float32Array(this.stresses)
        };
    }
}