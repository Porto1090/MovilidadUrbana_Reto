/*
 * Nombre: Eduardo Porto Morales A01027893
 * 
 * Este archivo contiene la función loadOBJ que recibe un archivo .obj y lo convierte a un objeto con los datos necesarios para
 * renderizarlo en WebGL. El objeto de retorno tiene la siguiente estructura como se nos indico en el ejercicio:
 * {
 *     a_position: { numComponents: 3, data: [] },
 *     a_color: { numComponents: 4, data: [] },
 *     a_normal: { numComponents: 3, data: [] }
 * }
 * 
 * NOTE: Tuve que cambiar por como genere mi archivo .obj tuve que hacer unas modificaciones en el código pasado para que
 * pudiera leerlo correctamente, y ayudo a que se lea mejor el modelo.
 */
async function loadOBJ(filePathOrContent) {
    let content;
    // Esta parte del código me permite cargar el archivo .obj ya sea desde una URL o una dirección, o si bien es un string
    if (typeof filePathOrContent === 'string') {
        console.log('Loading OBJ file:', filePathOrContent);
        if (filePathOrContent.startsWith('http') || filePathOrContent.startsWith('./')) {
            const response = await fetch(filePathOrContent);
            content = await response.text();
        } else {
            content = filePathOrContent;
        }
    }

    // Divido el contenido del archivo en líneas para poder procesarlas
    const lines = content.split('\n');
    const webglData = {
        a_position: { numComponents: 3, data: [] },
        a_color: { numComponents: 4, data: [] },
        a_normal: { numComponents: 3, data: [] }
    };
    const vertices = [];
    const normals = [];

    // Por el momento solo se están considerando las posiciones y las normales, por lo que se ignoran las texturas
    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') {
            // Separar los vectores de posición
            vertices.push(
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            );
            // Haremos que cada vértice tenga un color blanco por default
            webglData.a_color.data.push(1, 1, 1, 1);
        }
        if (parts[0] === 'vn') {
            // Separar los vectores normales
            normals.push(
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            );
        }
    });

    // Ahora se procesan las caras para obtener los índices de los vértices y las normales
    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'f') {
            parts.slice(1).forEach(faceVertex => {
                const indices = faceVertex.split('/').map(i => parseInt(i) - 1);
                
                // Posiciones de los vértices
                webglData.a_position.data.push(
                    vertices[indices[0] * 3],
                    vertices[indices[0] * 3 + 1],
                    vertices[indices[0] * 3 + 2]
                );
                
                // Si se proporcionaron normales, se añaden
                if (indices[2] !== undefined && normals.length > 0) {
                    webglData.a_normal.data.push(
                        normals[indices[2] * 3],
                        normals[indices[2] * 3 + 1],
                        normals[indices[2] * 3 + 2]
                    );
                } else {
                    // Normales por default en caso de que no se proporcionen
                    webglData.a_normal.data.push(0, 1, 0);
                }

                webglData.a_color.data.push(1, 1, 1, 1);  // Default color blanco
            });
        }
    });

    webglData.a_position.numComponents = 3;
    webglData.a_color.numComponents = 4;
    webglData.a_normal.numComponents = 3;

    // Asegurarse de que todos los vértices tengan un color, esto es por que me di cuenta que en algunos casos no se les asignaba
    // esa fue la razón por la que se puso un color por default en cada vértice
    const numVertices = webglData.a_position.data.length / 3;
    while (webglData.a_color.data.length < numVertices * 4) {
        webglData.a_color.data.push(1, 1, 1, 1);
    }

    return webglData;
}

export { loadOBJ };
