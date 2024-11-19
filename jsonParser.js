/*
 * JavaScript program to generate a 3D model of a wheel
 * The model is saved in the Wavefront OBJ format
 * The number of sides, radius, and width of the wheel can be specified as arguments
 * 
 * Do Kyu Han
 * 2024-11-06
 */

//const fs = require('fs');  // Importamos el módulo de sistema de archivos
import fs from 'fs';

function loadObj(objContent) {
    const vertices = [];
    const normals = [];
    const texCoords = [];
    const result = {
        a_position: { numComponents: 3, data: [] },
        a_color: { numComponents: 4, data: [] },
        a_normal: { numComponents: 3, data: [] },
        a_texCoord: { numComponents: 2, data: [] }
    };

    const lines = objContent.split('\n');
    for (const line of lines) {
        const tokens = line.trim().split(/\s+/);
        if (!tokens.length) continue;

        switch (tokens[0]) {
            case 'v':
                vertices.push([
                    parseFloat(tokens[1]),
                    parseFloat(tokens[2]),
                    parseFloat(tokens[3])
                ]);
                break;
            case 'vn':
                normals.push([
                    parseFloat(tokens[1]),
                    parseFloat(tokens[2]),
                    parseFloat(tokens[3])
                ]);
                break;
            case 'vt':
                texCoords.push([
                    parseFloat(tokens[1]),
                    parseFloat(tokens[2])
                ]);
                break;
            case 'f':
                const faceIndices = tokens.slice(1).map(vertex => {
                    const indices = vertex.split('/');
                    return {
                        vertex: parseInt(indices[0]) - 1,
                        texCoord: indices[1] ? parseInt(indices[1]) - 1 : undefined,
                        normal: indices[2] ? parseInt(indices[2]) - 1 : undefined
                    };
                });

                for (const index of faceIndices) {
                    const vertex = vertices[index.vertex];
                    result.a_position.data.push(...vertex);
                    result.a_color.data.push(0.4, 0.4, 0.4, 1.0);
                    
                    if (index.normal !== undefined) {
                        const normal = normals[index.normal];
                        result.a_normal.data.push(...normal);
                    }
                    
                    if (index.texCoord !== undefined) {
                        const texCoord = texCoords[index.texCoord];
                        result.a_texCoord.data.push(...texCoord);
                    }
                }
                break;
        }
    }

    return result;
}

export { loadObj };

// Lee el archivo generado
const generatedObjContent = fs.readFileSync('cubo.obj', 'utf8');

// Procesa el contenido usando loadObj
const jsonResult = loadObj(generatedObjContent);

// Guarda el resultado en un archivo JSON
fs.writeFileSync('objeto.json', JSON.stringify(jsonResult, null, 2));

console.log('JSON data saved to wheel_data.json');
