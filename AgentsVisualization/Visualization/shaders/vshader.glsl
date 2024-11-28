#version 300 es
in vec4 a_position;
in vec3 a_normal;

// Scene uniforms
uniform vec3 u_viewWorldPosition;

// Model uniforms
uniform mat4 u_world;
uniform mat4 u_worldInverseTransform;
uniform mat4 u_worldViewProjection;

out vec3 v_normal;
out vec3 v_cameraDirection;
out vec3 v_worldPosition;

void main() {
    gl_Position = u_worldViewProjection * a_position;

    v_normal = mat3(u_world) * a_normal;

    v_worldPosition = (u_world * a_position).xyz;

    v_cameraDirection = u_viewWorldPosition - v_worldPosition;
}
