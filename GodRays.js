import * as THREE from 'https://cdn.skypack.dev/three@0.138.0';

const GodRaysShader = {
    uniforms: {
        'sceneDiffuse': { value: null },
        'sceneDepth': { value: null },
        'tDiffuse': { value: null },
        'projMat': { value: new THREE.Matrix4() },
        'viewMat': { value: new THREE.Matrix4() },
        'projViewMat': { value: new THREE.Matrix4() },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'cameraPos': { value: new THREE.Vector3() },
        'resolution': { value: new THREE.Vector2() },
        'time': { value: 0.0 },
    },
    vertexShader: /*glsl*/ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `,
    fragmentShader: /*glsl*/ `
    uniform vec2 resolution;
    uniform vec3 cameraPos;
    uniform mat4 viewMatrixInv;
    uniform mat4 projectionMatrixInv;
    uniform mat4 projViewMat;
    uniform mat4 projMat;
    uniform mat4 viewMat;
    uniform sampler2D sceneDiffuse;
    uniform sampler2D sceneDepth;
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;
    float seed = 0.0;
    highp float random(vec2 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}
float rand()
{
    /*float result = fract(sin(seed + mod(time, 1000.0) + dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    //_Seed += 1.0;
    seed += 1.0;
    return result;*/
    float result = random(vUv + seed / 10.0 + mod(time / 100.0, 100.0));
    seed += 1.0;
    return result;
}

    void main() {
        /*vec3 lightDir = normalize(vec3(300.0, 200.0, 100.0));
        vec4 projLightPos = projMat * viewMat * vec4(lightDir, 0.0);
        projLightPos.xyz /= projLightPos.w;
        projLightPos.xyz = projLightPos.xyz * 0.5 + 0.5;
        vec2 uv = projLightPos.xy;
        projLightPos.y *= resolution.x / resolution.y;
        if (distance(vUv, uv) < 0.1) {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        } else {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }*/
        vec3 lightDir = normalize(vec3(300.0, 200.0, 100.0));
        vec3 direction = (projectionMatrixInv * vec4(vUv * 2.0 - 1.0, 0.0, 1.0)).xyz;
        direction = (viewMatrixInv * vec4(direction, 0.0)).xyz;
        direction = normalize(direction);
        vec4 lightCenter = projMat * viewMat * vec4(cameraPos + lightDir * 1000.0, 1.0);
        lightCenter.xyz /= lightCenter.w;
        lightCenter.xyz = lightCenter.xyz * 0.5 + 0.5;
        if (distance(vUv, lightCenter.xy) < 0.001) {
            gl_FragColor.xyz = vec3(1.0, 0.0, 0.0);
        }
        float accumulate = 0.0;
        float samples = round(10.0 + 10.0 * rand());
        float iterations = 0.0;
        if (dot(direction, lightDir) > 0.975 && texture2D(sceneDepth, vUv).r == 1.0) {
            accumulate = 1.0;
        } else {
        for(float i = 0.0; i < samples; i++) {
            vec2 samplePos = mix(vUv, lightCenter.xy, (i / samples));
            if (samplePos.x < 0.0 || samplePos.x > 1.0 || samplePos.y < 0.0 || samplePos.y > 1.0) {
                break;
            } else {
                iterations += 1.0;
            }
            vec3 d = (projectionMatrixInv * vec4(samplePos * 2.0 - 1.0, 0.0, 1.0)).xyz;
            d = (viewMatrixInv * vec4(d, 0.0)).xyz;
            d = normalize(d);
            if (dot(d, lightDir) > 0.975) {
               if (texture2D(sceneDepth, samplePos).r == 1.0) {
                    accumulate += 1.0;
               }

            }
        }
        if (iterations >= 1.0) {
            accumulate /= iterations;
        }
    }
        gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, vec3(1.0, 1.0, 1.0), accumulate), 1.0);
    }
    `
}
export { GodRaysShader };