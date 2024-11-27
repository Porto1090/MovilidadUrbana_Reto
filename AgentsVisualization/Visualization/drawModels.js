function drawScene(gl, programInfo, rendering) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
    const projectionMatrix = twgl.m4.perspective(Math.PI / 3, width / height, 0.1, 1000);
    const viewMatrix = twgl.m4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0]);
    const matrix = twgl.m4.multiply(projectionMatrix, viewMatrix);
  
    // Render the cars, buildings, roads, traffic lights, and destinations
    renderObject(rendering.car, cars, matrix);
    renderObject(rendering.building, buildings, matrix);
    renderObject(rendering.road, roads, matrix);
    renderObject(rendering.destination, destinations, matrix);
    renderObject(rendering.trafficLight, trafficLights, matrix);
    renderObject(rendering.wheel, cars.flatMap(car => car.wheels), matrix);
  
    requestAnimationFrame(() => drawScene(gl, programInfo, rendering));
  }
  
  function renderObject(rendering, objects, matrix) {
    twgl.setBuffersAndAttributes(gl, programInfo, rendering.vao);
    objects.forEach((object) => {
      twgl.setUniforms(programInfo, {
        u_matrix: twgl.m4.multiply(matrix, object.matrix),
        u_color: object.color
      });
      twgl.drawBufferInfo(gl, rendering.bufferInfo);
    });
  }