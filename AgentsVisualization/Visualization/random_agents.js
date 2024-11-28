'use strict';

import * as twgl from 'twgl.js';
import GUI from 'lil-gui';
import * as dataGenerator from './dataGenerator.js';

// Define the vertex shader code, using GLSL 3.00
const vsGLSL = `#version 300 es
precision highp float;
in vec4 a_position;
in vec4 a_color;

uniform mat4 u_transforms;
uniform mat4 u_matrix;
uniform vec4 u_color;

out vec4 v_color;

void main() {
  gl_Position = u_matrix * a_position;
  v_color = u_color;
}
`;

const fsGLSL = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`;

// Define the Object3D class to represent 3D objects
// Clase base para representar objetos 3D
class Object3D {
  constructor(id, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], color = [1, 1, 1, 1], shininess = 100) {
    this.id = id;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.color = color;
    this.shininess = shininess;

    // Definir material de forma genérica en el constructor base
    this.material = {
      ambientColor: color,
      diffuseColor: color,
      specularColor: [1, 1, 1, 1],
      shininess: shininess
    };

    this.matrix = twgl.m4.create();
  }

  // Método para actualizar la matriz (transformaciones)
  updateMatrix(viewProjectionMatrix) {
    this.matrix = twgl.m4.translate(viewProjectionMatrix, this.position);
    this.matrix = twgl.m4.rotateX(this.matrix, this.rotation[0]);
    this.matrix = twgl.m4.rotateY(this.matrix, this.rotation[1]);
    this.matrix = twgl.m4.rotateZ(this.matrix, this.rotation[2]);
    this.matrix = twgl.m4.scale(this.matrix, this.scale);
  }
}

class Building3D extends Object3D {
  constructor(id, position, rotation, scale, color = [0.5, 0.5, 0.5, 1], shininess = 33.0) {
    super(id, position, rotation, scale, color, shininess);
  }
}

class Road3D extends Object3D {
  constructor(id, position, rotation, scale, color = [0, 0, 0, 1], shininess) {
    super(id, position, rotation, scale, color, shininess);
    this.direction = undefined;
  }
}

class Destination3D extends Object3D {
  constructor(id, position, rotation, scale, color = [0.33, 1, 1, 1], shininess) {
    super(id, position, rotation, scale, color, shininess);
  }
}

class TrafficLight3D extends Object3D {
  constructor(id, position, rotation, scale, color, shininess) {
    super(id, position, rotation, scale, color, shininess);
    this.orientation = undefined;
    this.state = "red";
  }
}

class Car3D extends Object3D {
  constructor(id, position, rotation, scale = [0.1, 0.2, 0.2]) {
    super(id, position, rotation, scale);
    this.shininess = 100.0;
    this.wheels = [];
    this.addWheels();

    // Movimiento suave del coche con interpolación en función de los frames
    // Pt​=Po​+(Pf​−Po​)⋅Δt
    this.startPosition = [...position];
    this.endPosition = [...position];
    this.totalFrames = 30;
    this.currentFrame = 0;
  }

  // Método para actualizar la posición del coche
  updatePosition() {
    if (this.currentFrame < this.totalFrames) {
      let t = this.currentFrame / this.totalFrames;

      this.position = [
        this.startPosition[0] + (this.endPosition[0] - this.startPosition[0]) * t,
        this.startPosition[1] + (this.endPosition[1] - this.startPosition[1]) * t,
        this.startPosition[2] + (this.endPosition[2] - this.startPosition[2]) * t
      ];

      this.currentFrame++;
    } else {
      this.currentFrame = 0;
      this.position = [...this.endPosition];
    }
  }

  // Método para moverse a cierta posición
  carMovesTo(newPosition) {
    this.startPosition = [...this.position];
    this.endPosition = [...newPosition];
    this.currentFrame = 0;
  }

  // Método para asociar las ruedas al coche
  addWheels() {
    // Ruedas ubicadas respecto al coche, por ejemplo
    this.wheels.push(new Wheel3D('wheel1', [0.1, -0.1, 0.2]));
    this.wheels.push(new Wheel3D('wheel2', [-0.1, -0.1, 0.2]));
    this.wheels.push(new Wheel3D('wheel3', [0.1, -0.1, -0.2]));
    this.wheels.push(new Wheel3D('wheel4', [-0.1, -0.1, -0.2]));
  }

  // Método para actualizar las ruedas
  updateWheels() {
    for (const wheel of this.wheels) {
      wheel.updateTransforms(this.position, this.rotation);
    }
  }
}

// Clase Wheel para representar una rueda
class Wheel3D extends Object3D {
  constructor(id, position = [0, 0, 0]) {
    super(id, position);
    this.scale = [0.1, 0.1, 0.1];  // Escala de la rueda
  }

  // Actualiza las transformaciones de la rueda según la posición y rotación del coche
  updateTransforms(carPosition, carRotation) {
    // Actualizamos la posición relativa de la rueda respecto al coche
    this.position = twgl.v3.add(carPosition, this.position);
    this.rotation = carRotation;  // Asignamos la rotación del coche a la rueda

    // Actualizamos la matriz de transformación de la rueda
    this.matrix = twgl.m4.identity(this.matrix); // Resetear la matriz
    this.matrix = twgl.m4.translate(this.matrix, this.position);  // Aplica la posición
    this.matrix = twgl.m4.rotateY(this.matrix, this.rotation[1]); // Aplica la rotación en Y
    this.matrix = twgl.m4.scale(this.matrix, this.scale); // Aplica la escala
  }
}

// Define the agent server URI
const agent_server_uri = "http://localhost:8585/";

// Initialize arrays to store agents and obstacles
const cars = [];
const trafficLights = [];
const buildings = [];
const roads = [];
const destinations = [];

// Initialize WebGL-related variables
let gl, programInfo;

// Initialize the frame count
let frameCount = 0;

// Define the data object
const data = {
  mapFile: "../../public/2024_base.txt",
  mapDict: "../../public/mapDictionary.json"
};

let width = 0;
let height = 0;

// Define the camera position
const settings = {
  // Speed in degrees
  rotationSpeed: {
    x: 0,
    y: 30,
    z: 0,
  },
  cameraPosition: {
    x: 15,
    y: 30,
    z: 0,
  },
  lightPosition: {
    x: 20,
    y: 30,
    z: 20,
  },
  ambientColor: [0.5, 0.5, 0.5, 1.0],
  diffuseColor: [0.5, 0.5, 0.5, 1.0],
  specularColor: [0.5, 0.5, 0.5, 1.0],
};

// Main function to initialize and run the application
async function main() {
  console.log("Initializing WebGL...");
  const canvas = document.querySelector('canvas');
  
  gl = canvas.getContext('webgl2');
  
  programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

  // Crear los objetos con bufferInfo y VAO para los diferentes tipos de objetos
  const { bufferInfo: carsBufferInfo, vao: carsVao } = createObjectDataAndVAO(dataGenerator.createCar, gl, programInfo);
  const { bufferInfo: buildBufferInfo, vao: buildVao } = createObjectDataAndVAO(dataGenerator.createBuilding, gl, programInfo, 1, 0);
  const { bufferInfo: roadBufferInfo, vao: roadVao } = createObjectDataAndVAO(dataGenerator.createRoad, gl, programInfo, 1);
  const { bufferInfo: destinationBufferInfo, vao: destinationVao } = createObjectDataAndVAO(dataGenerator.createDestination, gl, programInfo, 1);
  const { bufferInfo: trafficLightBufferInfo, vao: trafficLightVao } = createObjectDataAndVAO(dataGenerator.createRoad, gl, programInfo, 1);
  const { bufferInfo: wheelBufferInfo, vao: wheelVao } = createObjectDataAndVAO(dataGenerator.createWheel, gl, programInfo);

  setupUI();

  await initAgentsModel();

  await getEnvironment();

  const rendering = {
    car: { bufferInfo: carsBufferInfo, vao: carsVao },
    building: { bufferInfo: buildBufferInfo, vao: buildVao },
    road: { bufferInfo: roadBufferInfo, vao: roadVao },
    destination: { bufferInfo: destinationBufferInfo, vao: destinationVao },
    trafficLight: { bufferInfo: trafficLightBufferInfo, vao: trafficLightVao },
    wheel: { bufferInfo: wheelBufferInfo, vao: wheelVao }
  };

  console.log("Starting render loop...");
  drawScene(gl, programInfo, rendering);
}

function createObjectDataAndVAO(createDataFunc, gl, programInfo, ...args) {
  const data = createDataFunc(...args);
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
  const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

  return { bufferInfo, vao };
}

/*
 * Initializes the agents model by sending a POST request to the agent server.
 */
async function initAgentsModel() {
  try {
    // Send a POST request to the agent server to initialize the model
    let response = await fetch(agent_server_uri + "init", {
      method: 'POST', 
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(data)
    })

    // Check if the response was successful
    if(response.ok){
      // Parse the response as JSON and log the message
      let result = await response.json()
      console.log(result.message)
      width = result.width;
      height = result.height;
    }
      
  } catch (error) {
    // Log any errors that occur during the request
    console.log(error)    
  }
}

/*
 * Retrieves the current positions of all agents from the agent server.
 */
async function getAgents() {
  try {
    // Send a GET request to the agent server to retrieve the agent positions
    let response = await fetch(agent_server_uri + "getAgents");

    // Check if the response was successful
    if (!response.ok) {
      throw new Error(`Error fetching agents: ${response.statusText}`);
    }

    // Parse the response as JSON
    let result = await response.json();

    // Helper function to get rotation based on agent orientation
    function getRotationForOrientation(orientation) {
      switch (orientation) {
        case "right":
          return [0, 0, 0];
        case "left":
          return [0, Math.PI, 0];
        case "up":
          return [0, Math.PI/2, 0];
        case "down":
          return [0, -Math.PI/2,0];
        default:
          return [0, 0, 0];
      }
    }
    function createRandomColor() {
      return [Math.random(), Math.random(), Math.random(), 1];
    }

    // Update cars (coches)
    for (const agent of result.agentPositions) {
      // Try to find the agent by ID in the cars array
      let currentAgent = cars.find((object3d) => object3d.id === agent.id);

      // If the agent exists, update its position and rotation
      if (currentAgent) {
        currentAgent.carMovesTo([agent.x, agent.y + 0.1, agent.z]);
        currentAgent.rotation = getRotationForOrientation(agent.orientation);
        currentAgent.updateWheels();
      } else {
        // If the agent doesn't exist, create a new one and add it to cars
        const newAgent = new Car3D(agent.id, [agent.x, agent.y + 0.1, agent.z]);
        newAgent.color = createRandomColor();
        newAgent.rotation = getRotationForOrientation(agent.orientation);
        cars.push(newAgent);
      }
      
      // Remove cars that are not in result.agentPositions
      cars.forEach((car, index) => {
        if (!result.agentPositions.find((agent) => agent.id === car.id)) {
          cars.splice(index, 1);
        }
      });
    }

    // Update traffic lights
    for (const agent of result.lightPositions) {
      // Try to find the traffic light by ID in the trafficLights array
      let currentAgent = trafficLights.find((object3d) => object3d.id === agent.id);

      // If the traffic light exists, update its position, orientation and state
      if (currentAgent) {
        currentAgent.position = [agent.x, agent.y +1, agent.z];
        currentAgent.orientation = agent.orientation;
        currentAgent.state = agent.state;
        currentAgent.color = getStateColor(agent.state);
      } else {
        // If the traffic light doesn't exist, create a new one and add it to trafficLights
        const newLight = new TrafficLight3D(agent.id, [agent.x, agent.y +1, agent.z]);
        newLight.orientation = agent.orientation;
        newLight.state = agent.state;
        newLight.color = getStateColor(agent.state);
        trafficLights.push(newLight);
      }
    }

    function getStateColor(state) {
      return state === "red" ? [1, 0, 0, 1] : [0, 1, 0, 1];
    }

  } catch (error) {
    // Log any errors that occur during the request
    console.error("Error occurred while fetching agents:", error);
  }
}

/*
 * Retrieves the current positions of all obstacles from the agent server.
 */
async function getEnvironment() {
  try {
    // Send a GET request to the agent server to retrieve the obstacle positions
    let response = await fetch(agent_server_uri + "environment"); 

    // Check if the response was successful
    if (response.ok) {
      // Parse the response as JSON
      let result = await response.json();

      // Process the positions and sort into the correct arrays

      for (const [type, obstaclesList] of Object.entries(result.positions)) {
        for (const obstacle of obstaclesList) {
          switch (type) {
            case 'road':
              const road = new Road3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              road.direction = obstacle.direction;
              roads.push(road);
              break;
            case 'building':
              const building = new Building3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              buildings.push(building);
              break;
            case 'destination':
              const destination = new Destination3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              destinations.push(destination);
              break;
            default:
              console.log("Unknown object type: " + type);
          }
        }
      }

      // Loguear los resultados para verificar que los arrays se han poblado correctamente
      console.log("Buildings:", buildings);
      console.log("Roads:", roads);
      console.log("Destinations:", destinations);
    }
  } catch (error) {
    // Log any errors that occur during the request
    console.log("Error fetching environment data:", error);
  }
}

/*
 * Updates the agent positions by sending a request to the agent server.
 */
async function update() {
  try {
    // Send a request to the agent server to update the agent positions
    let response = await fetch(agent_server_uri + "update") 

    // Check if the response was successful
    if(response.ok){
      // Retrieve the updated agent positions
      await getAgents()
    }

  } catch (error) {
    // Log any errors that occur during the request
    console.log(error) 
  }
}

/*
 * Draws the scene by rendering the agents and obstacles.
 */
async function drawScene(gl, programInfo, rendering) {
    // Resize the canvas to match the display size
    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Set the viewport to match the canvas size
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Set the clear color and enable depth testing
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.enable(gl.DEPTH_TEST);
    //gl.enable(gl.CULL_FACE);

    // Clear the color and depth buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //twgl.setBuffersAndAttributes(gl, programInfo, vao);
    //twgl.drawBufferInfo(gl, bufferInfo);

    // Use the program
    gl.useProgram(programInfo.program);

    // Set up the view-projection matrix
    const viewProjectionMatrix = setupWorldView(gl);

    // Draw the agents
    drawObjects(cars, rendering.car.vao, rendering.car.bufferInfo, programInfo, viewProjectionMatrix);
    drawObjects(buildings, rendering.building.vao, rendering.building.bufferInfo, programInfo, viewProjectionMatrix);
    drawObjects(roads, rendering.road.vao, rendering.road.bufferInfo, programInfo, viewProjectionMatrix);
    drawObjects(destinations, rendering.destination.vao, rendering.destination.bufferInfo, programInfo, viewProjectionMatrix);
    drawObjects(trafficLights, rendering.trafficLight.vao, rendering.trafficLight.bufferInfo, programInfo, viewProjectionMatrix);
    
    // Increment the frame count
    frameCount++

    // Update the scene every 30 frames
    if(frameCount%30 == 0){
      frameCount = 0
      await update()
    } 

    // Request the next frame
    requestAnimationFrame(() => drawScene(gl, programInfo, rendering));
}

function drawObjects(list, vao, bufferInfo, programInfo, viewProjectionMatrix) {
  gl.bindVertexArray(vao);
  for (const object of list) {
    if (object.updatePosition) {
      object.updatePosition();
    }
    object.updateMatrix(viewProjectionMatrix);
    object.updateMatrix(viewProjectionMatrix);

    let worldViewProjectionMatrix = twgl.m4.multiply(viewProjectionMatrix, object.matrix);
    const uniforms = {
      u_matrix: object.matrix,
      u_color: object.color
    };
  
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo);
  }
}

/*
 * Sets up the world view by creating the view-projection matrix.
 */
function setupWorldView(gl) {
  const fieldOfViewRadians = 60 * Math.PI / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 1;
  const zFar = 200;

  const projectionMatrix = twgl.m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

  const camera = {
      x: settings.cameraPosition.x,
      y: settings.cameraPosition.y,
      z: settings.cameraPosition.z
  };

  const target = { x: width / 2, y: 0, z: height / 2 };
  const up = [0, 1, 0];

  const cameraMatrix = twgl.m4.lookAt([camera.x + target.x, camera.y, camera.z + target.z], [target.x, target.y, target.z], up);
  const viewMatrix = twgl.m4.inverse(cameraMatrix);

  const viewProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrix);
  return viewProjectionMatrix;
}

/*
 * Sets up the user interface (UI) for the camera position.
 */
function setupUI() {
  // Create a new GUI instance
  const gui = new GUI();
  gui.close();

  // Create a folder for the camera position
  const posFolder = gui.addFolder('Position:')

  // Add a slider for the x-axis
  posFolder.add(settings.cameraPosition, 'x', -100, 100)
    .onChange(value => {
      // Update the camera position when the slider value changes
      settings.cameraPosition.x = value
    });

  // Add a slider for the y-axis
  posFolder.add(settings.cameraPosition, 'y', -100, 100)
    .onChange(value => {
      // Update the camera position when the slider value changes
      settings.cameraPosition.y = value
    });

  // Add a slider for the z-axis
  posFolder.add(settings.cameraPosition, 'z', -100, 100)
    .onChange(value => {
      // Update the camera position when the slider value changes
      settings.cameraPosition.z = value
    });

  const lightFolder = gui.addFolder('Light:')
  lightFolder.add(settings.lightPosition, 'x', -20, 20)
    .decimals(2)
  lightFolder.add(settings.lightPosition, 'y', -20, 30)
    .decimals(2)
  lightFolder.add(settings.lightPosition, 'z', -20, 20)
    .decimals(2)
  lightFolder.addColor(settings, 'ambientColor')
  lightFolder.addColor(settings, 'diffuseColor')
  lightFolder.addColor(settings, 'specularColor')
}

main()
