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
class Object3D {
  constructor(id, position=[0,0,0], rotation=[0,0,0], scale=[1,1,1], color=[1,1,1,1]) {
    this.id = id;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.color = color;
    this.matrix = twgl.m4.create();
    this.wheels = [];
  }

  // Método para asociar ruedas al coche
  addWheels() {
    // Hay que medir esto a ojo
    this.wheels.push(new Wheel('wheel1', [0.1, -0.1, 0.2]));
    this.wheels.push(new Wheel('wheel2', [-0.1, -0.1, 0.2]));
    this.wheels.push(new Wheel('wheel3', [0.1, -0.1, -0.2]));
    this.wheels.push(new Wheel('wheel4', [-0.1, -0.1, -0.2]));
  }

  // Método para actualizar las ruedas
  updateWheels() {
    for (const wheel of this.wheels) {
      wheel.updateTransforms(this.position, this.rotation);
    }
  }
}

class Wheel {
  constructor(id, position=[0,0,0]) {
    this.id = id;
    this.position = position;
    this.rotation = [0, 0, 0];
    this.scale = [0.1, 0.1, 0.1];
    this.color = [0, 0, 0, 1];
    this.matrix = twgl.m4.create();
  }
  
  updateTransforms(carPosition, carRotation) {
    // Posición de la rueda es la posición del coche más la posición relativa
    this.position = twgl.v3.add(carPosition, this.position);
    this.rotation = carRotation;
    
    this.matrix = twgl.m4.translate(twgl.m4.create(), this.position);
    this.matrix = twgl.m4.rotateY(this.matrix, this.rotation[1]);
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

// Define the camera position
//let cameraPosition = {x:20, y:30, z:10};
//let cameraPosition = {x:14, y:3, z:15};
let cameraPosition = {x:2, y:25, z:0};

// Initialize the frame count
let frameCount = 0;

// Define the data object
const data = {
  mapFile: "../../public/2024_base.txt",
  mapDict: "../../public/mapDictionary.json"
};

let width = 0;
let height = 0;

// Main function to initialize and run the application
async function main() {
  console.log("Initializing WebGL...");
  const canvas = document.querySelector('canvas');
  
  gl = canvas.getContext('webgl2');
  
  programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

  // Crear los objetos con bufferInfo y VAO para los diferentes tipos de objetos
  const { bufferInfo: carsBufferInfo, vao: carsVao } = createObjectDataAndVAO(dataGenerator.createCar, gl, programInfo);
  const { bufferInfo: buildBufferInfo, vao: buildVao } = createObjectDataAndVAO(dataGenerator.createBuilding, gl, programInfo, 1, 1);
  const { bufferInfo: roadBufferInfo, vao: roadVao } = createObjectDataAndVAO(dataGenerator.createRoad, gl, programInfo, 1);
  const { bufferInfo: destinationBufferInfo, vao: destinationVao } = createObjectDataAndVAO(dataGenerator.createDestination, gl, programInfo, 1);
  const { bufferInfo: trafficLightBufferInfoR, vao: trafficLightVaoR } = createObjectDataAndVAO(dataGenerator.createRoad, gl, programInfo, 1, "red");
  const { bufferInfo: trafficLightBufferInfoG, vao: trafficLightVaoG } = createObjectDataAndVAO(dataGenerator.createRoad, gl, programInfo, 1, "green");
  const { bufferInfo: wheelBufferInfo, vao: wheelVao } = createObjectDataAndVAO(dataGenerator.createWheel, gl, programInfo);

  setupUI();

  await initAgentsModel();

  await getEnvironment();

  let rendering = {
      "car": {
          "vao": carsVao,
          "bufferInfo": carsBufferInfo
      },
      "building": {
          "vao": buildVao,
          "bufferInfo": buildBufferInfo
      },
      "road": {
          "vao": roadVao,
          "bufferInfo": roadBufferInfo
      },
      "destination": { 
          "vao": destinationVao,
          "bufferInfo": destinationBufferInfo
      },
      "trafficLight": {
          "vaoR": trafficLightVaoR,
          "bufferInfoR": trafficLightBufferInfoR,
          "vaoG": trafficLightVaoG,
          "bufferInfoG": trafficLightBufferInfoG
      },
      "wheel": {
          "vao": wheelVao,
          "bufferInfo": wheelBufferInfo
      }
  }

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
          return [0, 0, 0];
        case "up":
          return [0, 0, 0];
        case "down":
          return [0, 0, 0];
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
        currentAgent.position = [agent.x, agent.y + 0.1, agent.z];
        currentAgent.rotation = getRotationForOrientation(agent.orientation);
        currentAgent.updateWheels();
      } else {
        // If the agent doesn't exist, create a new one and add it to cars
        const newAgent = new Object3D(agent.id, [agent.x, agent.y + 0.1, agent.z]);
        newAgent.scale = [0.1, 0.2, 0.2];
        newAgent.color = createRandomColor();
        newAgent.rotation = getRotationForOrientation(agent.orientation);
        newAgent.addWheels();
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
        currentAgent.position = [agent.x, agent.y, agent.z];
        currentAgent.orientation = agent.orientation;
        currentAgent.state = agent.state;
        currentAgent.color = getStateColor(agent.state);
      } else {
        // If the traffic light doesn't exist, create a new one and add it to trafficLights
        const newLight = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
        newLight.orientation = agent.orientation;
        newLight.state = agent.state;
        newLight.color = getStateColor(agent.state);
        trafficLights.push(newLight);
      }
    }

    function getStateColor(state) {
      switch (state) {
        case "red":
          return [1, 0, 0, 1];
        case "green":
          return [0, 1, 0, 1];
      }
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
              const road = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              road.direction = obstacle.direction; //para darle orientación a la carretera
              road.color = [0, 0, 0, 1];
              roads.push(road);
              break;
            case 'building':
              const building = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              building.color = [0.5, 0.5, 0.5, 1];
              buildings.push(building);
              break;
            case 'destination':
              const destination = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              destination.color = [0.33, 1, 1, 1];
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

    // Set the distance for rendering
    const distance = 1

    // Draw the agents
    drawCarsWithWheels(distance, rendering["car"], rendering["wheel"], viewProjectionMatrix)
    drawLights(distance, rendering["trafficLight"], viewProjectionMatrix)
    // Draw the obstacles
    drawEnvironment(distance, rendering["building"], rendering["road"], rendering["destination"], viewProjectionMatrix)
    
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

/*
 * Draws the agents, objects and environment.
 */
function drawCarsWithWheels(distance, carRender, wheelRender, viewProjectionMatrix){
    // Bind the vertex array object for agents
    gl.bindVertexArray(carRender["vao"]);

    // Iterate over the agents
    for(const car of cars){
        car.updateWheels();
        drawObject(car, carRender["bufferInfo"], programInfo, viewProjectionMatrix);
        /*for (const wheel of car.wheels) {
          gl.bindVertexArray(wheelRender["vao"]);
          drawObject(wheel, wheelRender["bufferInfo"], programInfo, viewProjectionMatrix);
        }*/
    }
}

function drawLights(distance, trafficLightRender, viewProjectionMatrix){
    // Bind the vertex array object for agents
    for (const agent of trafficLights) {
      if (agent.state == "red") {
        gl.bindVertexArray(trafficLightRender["vaoR"]);
        drawObject(agent, trafficLightRender["bufferInfoR"], programInfo, viewProjectionMatrix);
      } else if (agent.state == "green") {
        gl.bindVertexArray(trafficLightRender["vaoG"]);
        drawObject(agent, trafficLightRender["bufferInfoG"], programInfo, viewProjectionMatrix);
      }
    }
}

function drawObject(object, bufferInfo, programInfo, viewProjectionMatrix) {
  const cube_trans = twgl.v3.create(...object.position);
  const cube_scale = twgl.v3.create(...object.scale);

  object.matrix = twgl.m4.translate(viewProjectionMatrix, cube_trans);
  object.matrix = twgl.m4.rotateX(object.matrix, object.rotation[0]);
  object.matrix = twgl.m4.rotateY(object.matrix, object.rotation[1]);
  object.matrix = twgl.m4.rotateZ(object.matrix, object.rotation[2]);
  object.matrix = twgl.m4.scale(object.matrix, cube_scale);

  const uniforms = {
    u_matrix: object.matrix,
    u_color: object.color
  };

  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);
}

function drawEnvironment(distance, renderBuild, renderRoad, renderDestination, viewProjectionMatrix) {
  // Dibujar los edificios
  gl.bindVertexArray(renderBuild["vao"]);
  for (const build of buildings) {
      drawObject(build, renderBuild["bufferInfo"], programInfo, viewProjectionMatrix);
  }

  // Dibujar las carreteras
  gl.bindVertexArray(renderRoad["vao"]);
  for (const road of roads) {
      drawObject(road, renderRoad["bufferInfo"], programInfo, viewProjectionMatrix);
  }

  // Dibujar los destinos
  gl.bindVertexArray(renderDestination["vao"]);
  for (const destination of destinations) {
      drawObject(destination, renderDestination["bufferInfo"], programInfo, viewProjectionMatrix);
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
      x: cameraPosition.x,
      y: cameraPosition.y,
      z: cameraPosition.z
  };

  const target = { x: width / 2, y: 0, z: height / 2 };
  const up = [0, 1, 0];

  const cameraMatrix = twgl.m4.lookAt([camera.x + target.x, camera.y, camera.z + target.z], [target.x, target.y, target.z], up);
  const viewMatrix = twgl.m4.inverse(cameraMatrix);

  // Calcular la dirección de la cámara
  const cameraDirection = twgl.v3.subtract([target.x, target.y, target.z], [camera.x, camera.y, camera.z]);
  twgl.v3.normalize(cameraDirection, cameraDirection);

  const viewProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrix);

  return viewProjectionMatrix;
}

/*
 * Sets up the user interface (UI) for the camera position.
 */
const camera = {
  position: { x: 2, y: 25, z: 0 }
};

function setupUI() {
  const gui = new GUI();
  const posFolder = gui.addFolder('Camera:');

  posFolder.add(camera.position, 'x', -200, 200).onChange(updateCamera);
  posFolder.add(camera.position, 'y', -200, 200).onChange(updateCamera);
  posFolder.add(camera.position, 'z', -200, 200).onChange(updateCamera);
}

function updateCamera() {
  cameraPosition = camera.position;  // Actualiza la posición de la cámara
}

main()
