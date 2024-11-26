function drawAgents(distance, carsVao, carsBufferInfo, viewProjectionMatrix) {
    gl.bindVertexArray(carsVao);

    for(const agent of cars) {
        // Set different scales for different agent types
        const cube_trans = twgl.v3.create(...agent.position);
        const cube_scale = twgl.v3.create(0.5, 0.3, 0.8); // Car dimensions

        // Start with the view projection matrix
        agent.matrix = twgl.m4.translate(viewProjectionMatrix, cube_trans);
        
        // Rotate based on direction if available
        if(agent.direction) {
            switch(agent.direction.toLowerCase()) {
                case 'right':
                    agent.matrix = twgl.m4.rotateY(agent.matrix, 0);
                    break;
                case 'left':
                    agent.matrix = twgl.m4.rotateY(agent.matrix, Math.PI);
                    break;
                case 'up':
                    agent.matrix = twgl.m4.rotateY(agent.matrix, Math.PI / 2);
                    break;
                case 'down':
                    agent.matrix = twgl.m4.rotateY(agent.matrix, -Math.PI / 2);
                    break;
            }
        }

        // Apply scale
        agent.matrix = twgl.m4.scale(agent.matrix, cube_scale);

        // Set uniforms and draw
        let uniforms = {
            u_matrix: agent.matrix,
        }

        twgl.setUniforms(programInfo, uniforms);
        twgl.drawBufferInfo(gl, carsBufferInfo);
    }
}

function drawEnvironment(distance, renderBuild, renderRoad, renderDestination, viewProjectionMatrix) {
    // Draw buildings
    gl.bindVertexArray(renderBuild["vao"]);
    for (const build of buildings) {
        const cube_scale = twgl.v3.create(1, 2, 1); // Taller buildings
        drawObject(build, renderBuild["bufferInfo"], programInfo, viewProjectionMatrix, cube_scale);
    }

    // Draw roads
    gl.bindVertexArray(renderRoad["vao"]);
    for (const road of roads) {
        const cube_scale = twgl.v3.create(1, 0.1, 1); // Flat roads
        drawObject(road, renderRoad["bufferInfo"], programInfo, viewProjectionMatrix, cube_scale);
    }

    // Draw destinations
    gl.bindVertexArray(renderDestination["vao"]);
    for (const destination of destinations) {
        const cube_scale = twgl.v3.create(0.8, 0.8, 0.8); // Slightly smaller markers
        drawObject(destination, renderDestination["bufferInfo"], programInfo, viewProjectionMatrix, cube_scale);
    }
}

function drawObject(object, bufferInfo, programInfo, viewProjectionMatrix, scale) {
    const cube_trans = twgl.v3.create(...object.position);
    
    // Use the provided scale or default to unit scale
    const cube_scale = scale || twgl.v3.create(1, 1, 1);

    let matrix = twgl.m4.translate(viewProjectionMatrix, cube_trans);
    
    // Apply rotations based on object type and direction
    if(object.direction) {
        switch(object.direction.toLowerCase()) {
            case 'right':
                matrix = twgl.m4.rotateY(matrix, 0);
                break;
            case 'left':
                matrix = twgl.m4.rotateY(matrix, Math.PI);
                break;
            case 'up':
                matrix = twgl.m4.rotateY(matrix, Math.PI / 2);
                break;
            case 'down':
                matrix = twgl.m4.rotateY(matrix, -Math.PI / 2);
                break;
        }
    }
    
    matrix = twgl.m4.scale(matrix, cube_scale);

    let uniforms = {
        u_matrix: matrix,
    };

    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo);
}