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

out vec4 v_color;

void main() {
  gl_Position = u_matrix * a_position;
  v_color = a_color;
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
  constructor(id, position=[0,0,0], rotation=[0,0,0], scale=[1,1,1]){
    this.id = id;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.matrix = twgl.m4.create();
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
let gl, programInfo, 
carArrays, carsBufferInfo, carsVao, 
buildArrays, buildBufferInfo, buildVao, 
roadArrays, roadBufferInfo, roadVao, 
destinationArrays, destinationBufferInfo, destinationVao, 
trafficLightArraysR, trafficLightBufferInfoR, trafficLightVaoR,
trafficLightArraysG, trafficLightBufferInfoG, trafficLightVaoG;

// Define the camera position
//let cameraPosition = {x:20, y:30, z:10};
let cameraPosition = {x:14, y:3, z:15};

// Initialize the frame count
let frameCount = 0;

// Define the data object
const data = {
  mapFile: "../../public/2021_base.txt",
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

  carArrays = dataGenerator.createCar();
  buildArrays = dataGenerator.createBuilding(1, 5);
  roadArrays = dataGenerator.createRoad(1);
  destinationArrays = dataGenerator.createDestination(1);
  trafficLightArraysR = dataGenerator.createRoad(1, "red");
  trafficLightArraysG = dataGenerator.createRoad(1, "green");

  carsBufferInfo = twgl.createBufferInfoFromArrays(gl, carArrays);
  buildBufferInfo = twgl.createBufferInfoFromArrays(gl, buildArrays);
  roadBufferInfo = twgl.createBufferInfoFromArrays(gl, roadArrays);
  destinationBufferInfo = twgl.createBufferInfoFromArrays(gl, destinationArrays);
  trafficLightBufferInfoR = twgl.createBufferInfoFromArrays(gl, trafficLightArraysR);
  trafficLightBufferInfoG = twgl.createBufferInfoFromArrays(gl, trafficLightArraysG);

  carsVao = twgl.createVAOFromBufferInfo(gl, programInfo, carsBufferInfo);
  buildVao = twgl.createVAOFromBufferInfo(gl, programInfo, buildBufferInfo);
  roadVao = twgl.createVAOFromBufferInfo(gl, programInfo, roadBufferInfo);
  destinationVao = twgl.createVAOFromBufferInfo(gl, programInfo, destinationBufferInfo);
  trafficLightVaoR = twgl.createVAOFromBufferInfo(gl, programInfo, trafficLightBufferInfoR);
  trafficLightVaoG = twgl.createVAOFromBufferInfo(gl, programInfo, trafficLightBufferInfoG);

  setupUI();

  await initAgentsModel();

  await getEnvironment();

  let rendering = {
      "cars": {
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
      }
  }

  console.log("Starting render loop...");
  drawScene(gl, programInfo, rendering);
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
    let response = await fetch(agent_server_uri + "getAgents") 

    // Check if the response was successful
    if(response.ok){
      // Parse the response as JSON
      let result = await response.json()

      // Check if the agents array is empty
      if(cars.length == 0 && trafficLights.length == 0){
        for (const agent of result.agentPositions) {
          const newAgent = new Object3D(agent.id, [agent.x, agent.y+0.1, agent.z])
          newAgent.scale = [0.1, 0.2, 0.2]
          cars.push(newAgent)
        }
        for (const agent of result.lightPositions) {
          const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z])
          newAgent.orientation = agent.orientation
          newAgent.state = agent.state
          trafficLights.push(newAgent)
        }
        console.log("Luces:", trafficLights)
        // Log the agents array
      } else {
        // Update the positions of existing agents
        for (const agent of result.agentPositions) {
          const current_agent = cars.find((object3d) => object3d.id == agent.id)

          // Check if the agent exists in the agents array
          if(current_agent != undefined){
            // Update the agent's position
            current_agent.position = [agent.x, agent.y+0.1, agent.z]
          }
        }
        for (const agent of result.lightPositions) {
          const current_agent = trafficLights.find((object3d) => object3d.id == agent.id)

          // Check if the agent exists in the agents array
          if(current_agent != undefined){
            // Update the agent's position
            current_agent.position = [agent.x, agent.y, agent.z]
            current_agent.orientation = agent.orientation
            current_agent.state = agent.state
          }
        }
      }
    }

  } catch (error) {
    // Log any errors that occur during the request
    console.log(error) 
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
              roads.push(road);
              break;
            case 'building':
              const building = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
              buildings.push(building);
              break;
            case 'destination':
              const destination = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
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
    drawAgents(distance, rendering["cars"]["vao"], rendering["cars"]["bufferInfo"], viewProjectionMatrix)   
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
function drawAgents(distance, carsVao, carsBufferInfo, viewProjectionMatrix){
    // Bind the vertex array object for agents
    gl.bindVertexArray(carsVao);

    // Iterate over the agents
    for(const agent of cars){
        drawObject(agent, carsBufferInfo, programInfo, viewProjectionMatrix);
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
function setupUI() {
    // Create a new GUI instance
    const gui = new GUI();

    // Create a folder for the camera position
    const posFolder = gui.addFolder('Position:')

    // Add a slider for the x-axis
    posFolder.add(cameraPosition, 'x', -200, 200)
        .onChange( value => {
            // Update the camera position when the slider value changes
            cameraPosition.x = value
        });

    // Add a slider for the y-axis
    posFolder.add( cameraPosition, 'y', -200, 200)
        .onChange( value => {
            // Update the camera position when the slider value changes
            cameraPosition.y = value
        });

    // Add a slider for the z-axis
    posFolder.add( cameraPosition, 'z', -200, 200)
        .onChange( value => {
            // Update the camera position when the slider value changes
            cameraPosition.z = value
        });
}

main()
