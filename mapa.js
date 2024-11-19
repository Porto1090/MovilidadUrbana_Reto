'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { loadWheel } from './00_common/shapes';
import { v3, m4 } from './libs/starter_3D_lib';

import vsGLSL from './assets/shaders/vs_color.glsl?raw';
import fsGLSL from './assets/shaders/fs_color.glsl?raw';

let programInfo = undefined;
let gl = undefined;

// Variable with the data for the object transforms, controlled by the UI
const objects = {
    wheel: {
        transforms: {
            t: { x: 0, y: 0, z: 0 },
            rd: { x: 0, y: 0, z: 0 },
            rr: { x: 0, y: 0, z: 0 },
            s: { x: 1, y: 1, z: 1 },
        },
        pivotPoint: { x: 0, y: 0, z: 0 },
        arrays: undefined,
        bufferInfo: undefined,
        vao: undefined,
    }
};

async function loadWheelData() {
    const response = await fetch('objeto.json');
    return await response.json();
}

async function main() {
    const canvas = document.querySelector('canvas');
    gl = canvas.getContext('webgl2');
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    setupUI();
    
    programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    try {
        const wheelData = await loadWheelData();
        const wheelArrays = loadWheel(wheelData);
        
        objects.wheel.arrays = wheelArrays;
        objects.wheel.bufferInfo = twgl.createBufferInfoFromArrays(gl, objects.wheel.arrays);
        objects.wheel.vao = twgl.createVAOFromBufferInfo(gl, programInfo, objects.wheel.bufferInfo);

        drawScene();
    } catch (error) {
        console.error('Error loading wheel:', error);
    }
}

function drawScene() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    const viewProjectionMatrix = setupViewProjection(gl);
    
    let wheelMatrix = m4.identity();
    const pivotPoint = [
        objects.wheel.pivotPoint.x,
        objects.wheel.pivotPoint.y,
        objects.wheel.pivotPoint.z
    ];

    // 1. Trasladar al origen
    wheelMatrix = m4.multiply(wheelMatrix, m4.translation(pivotPoint));
    
    // 2. Aplicar rotaciones
    wheelMatrix = m4.multiply(wheelMatrix, m4.rotationX(objects.wheel.transforms.rr.x));
    wheelMatrix = m4.multiply(wheelMatrix, m4.rotationY(objects.wheel.transforms.rr.y));
    wheelMatrix = m4.multiply(wheelMatrix, m4.rotationZ(objects.wheel.transforms.rr.z));
    
    // 3. Trasladar de vuelta
    wheelMatrix = m4.multiply(wheelMatrix, m4.translation([
        -pivotPoint[0] + objects.wheel.transforms.t.x,
        -pivotPoint[1] + objects.wheel.transforms.t.y,
        -pivotPoint[2] + objects.wheel.transforms.t.z
    ]));
    
    // Aplicar escala
    wheelMatrix = m4.multiply(wheelMatrix, m4.scale([
        objects.wheel.transforms.s.x,
        objects.wheel.transforms.s.y,
        objects.wheel.transforms.s.z
    ]));
    
    let finalMatrix = m4.multiply(viewProjectionMatrix, wheelMatrix);
    twgl.setUniforms(programInfo, { u_transforms: finalMatrix });
    gl.bindVertexArray(objects.wheel.vao);
    twgl.drawBufferInfo(gl, objects.wheel.bufferInfo);

    requestAnimationFrame(drawScene);
}

function setupViewProjection(gl) {
    const fov = 60 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(fov, aspect, 1, 200);

    const cameraPosition = [0, 0, 10];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const cameraMatrix = m4.lookAt(cameraPosition, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);
    
    return m4.multiply(projectionMatrix, viewMatrix);
}

function setupUI() {
    const gui = new GUI();
    
    // Pivot point controls
    const pivotFolder = gui.addFolder('Pivot Point');
    pivotFolder.add(objects.wheel.pivotPoint, 'x', -5, 5);
    pivotFolder.add(objects.wheel.pivotPoint, 'y', -5, 5);
    pivotFolder.add(objects.wheel.pivotPoint, 'z', -5, 5);

    const wheelFolder = gui.addFolder('Wheel Transforms');
    
    const posFolder = wheelFolder.addFolder('Position');
    posFolder.add(objects.wheel.transforms.t, 'x', -5, 5);
    posFolder.add(objects.wheel.transforms.t, 'y', -5, 5);
    posFolder.add(objects.wheel.transforms.t, 'z', -5, 5);

    const rotFolder = wheelFolder.addFolder('Rotation');
    rotFolder.add(objects.wheel.transforms.rd, 'x', 0, 360)
        .onChange(value => {
            objects.wheel.transforms.rd.x = value;
            objects.wheel.transforms.rr.x = value * Math.PI / 180;
        });
    rotFolder.add(objects.wheel.transforms.rd, 'y', 0, 360)
        .onChange(value => {
            objects.wheel.transforms.rd.y = value;
            objects.wheel.transforms.rr.y = value * Math.PI / 180;
        });
    rotFolder.add(objects.wheel.transforms.rd, 'z', 0, 360)
        .onChange(value => {
            objects.wheel.transforms.rd.z = value;
            objects.wheel.transforms.rr.z = value * Math.PI / 180;
        });

    const scaleFolder = wheelFolder.addFolder('Scale');
    scaleFolder.add(objects.wheel.transforms.s, 'x', 0.1, 5);
    scaleFolder.add(objects.wheel.transforms.s, 'y', 0.1, 5);
    scaleFolder.add(objects.wheel.transforms.s, 'z', 0.1, 5);
}

main();