import * as THREE from 'https://cdn.skypack.dev/three@0.138.0';
const EffectShader = {

    uniforms: {

        'sceneDiffuse': { value: null },
        'reflectDiffuse': { value: null },
        'tDiffuse': { value: null },
        'time': { value: 0 },
        'sceneDepth': { value: null },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'cameraPos': { value: new THREE.Vector3() },
        'time': { value: 0.0 },
        'resolution': { value: new THREE.Vector2() },
        'waterNormal1': { value: null },
        'waterNormal2': { value: null },
        'projMat': { value: new THREE.Matrix4() },
        'viewMat': { value: new THREE.Matrix4() },
        'environment': { value: null },
        'lightPos': { value: new THREE.Vector3() }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform sampler2D sceneDiffuse;
    uniform sampler2D reflectDiffuse;
    uniform sampler2D sceneDepth;
    uniform sampler2D waterNormal1;
    uniform sampler2D waterNormal2;
    uniform samplerCube environment;
    uniform mat4 projectionMatrixInv;
    uniform mat4 viewMatrixInv;
    uniform mat4 viewMat;
    uniform mat4 projMat;
    uniform vec3 cameraPos;
    uniform vec2 resolution;
    uniform vec3 lightPos;
    uniform float time;
    uniform sampler2D tDiffuse;
        varying vec2 vUv;
        float random(vec2 n) { 
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        
        float snoise(vec3 v){ 
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        
        // First corner
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;
        
        // Other corners
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
        
          //  x0 = x0 - 0. + 0.0 * C 
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1. + 3.0 * C.xxx;
        
        // Permutations
          i = mod(i, 289.0 ); 
          vec4 p = permute( permute( permute( 
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        
        // Gradients
        // ( N*N points uniformly over a square, mapped onto an octahedron.)
          float n_ = 1.0/7.0; // N=7
          vec3  ns = n_ * D.wyz - D.xzx;
        
          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
        
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
        
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
        
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
        
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
        
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
        
        //Normalise gradients
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
        
        // Mix final noise value
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                        dot(p2,x2), dot(p3,x3) ) );
        }
        vec3 getWorldPos(float depth, vec2 coord) {
          float z = depth * 2.0 - 1.0;
          vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
          vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
          // Perspective division
          viewSpacePosition /= viewSpacePosition.w;
          vec4 worldSpacePosition = viewMatrixInv * viewSpacePosition;
          return worldSpacePosition.xyz;
      }
      vec3 computeNormal(vec3 worldPos) {
        vec2 downUv = vUv + vec2(0.0, 1.0 / resolution.y);
        vec3 downPos = getWorldPos(texture2D(sceneDepth, downUv).x, downUv).xyz;
        vec2 rightUv = vUv + vec2(1.0 / resolution.x, 0.0);;
        vec3 rightPos = getWorldPos(texture2D(sceneDepth, rightUv).x, rightUv).xyz;
        vec2 upUv = vUv - vec2(0.0, 1.0 / resolution.y);
        vec3 upPos = getWorldPos(texture2D(sceneDepth, upUv).x, upUv).xyz;
        vec2 leftUv = vUv - vec2(1.0 / resolution.x, 0.0);
        vec3 leftPos = getWorldPos(texture2D(sceneDepth, leftUv).x, leftUv).xyz;
        int hChoice;
        int vChoice;
        if (length(leftPos - worldPos) < length(rightPos - worldPos)) {
          hChoice = 0;
        } else {
          hChoice = 1;
        }
        if (length(upPos - worldPos) < length(downPos - worldPos)) {
          vChoice = 0;
        } else {
          vChoice = 1;
        }
        vec3 hVec;
        vec3 vVec;
        if (hChoice == 0 && vChoice == 0) {
          hVec = leftPos - worldPos;
          vVec = upPos - worldPos;
        } else if (hChoice == 0 && vChoice == 1) {
          hVec = leftPos - worldPos;
          vVec = worldPos - downPos;
        } else if (hChoice == 1 && vChoice == 1) {
          hVec = rightPos - worldPos;
          vVec = downPos - worldPos;
        } else if (hChoice == 1 && vChoice == 0) {
          hVec = rightPos - worldPos;
          vVec = worldPos - upPos;
        }
        return normalize(cross(hVec, vVec));
      }
      mat3 GetTangentSpace(vec3 normal)
      {
          // Choose a helper vector for the cross product
          vec3 helper = vec3(1.0, 0.0, 0.0);
          if (abs(normal.x) > 0.99)
              helper = vec3(0.0, 0.0, 1.0);
          // Generate vectors
          vec3 tangent = normalize(cross(normal, helper));
          vec3 binormal = normalize(cross(normal, tangent));
          return mat3(tangent, binormal, normal);
      }
      float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}
highp float linearize_depth(highp float d, highp float zNear,highp float zFar)
      {
          highp float z_n = 2.0 * d - 1.0;
          return 2.0 * zNear * zFar / (zFar + zNear - z_n * (zFar - zNear));
      }
		void main() {
            vec4 diffuse = texture2D(tDiffuse, vUv);
            float depth = texture2D(sceneDepth, vUv).x;
            vec3 worldPos = getWorldPos(depth, vUv);
            vec3 origin = cameraPos;
            float linDepth = length(origin - worldPos);
            vec3 direction = (projectionMatrixInv * vec4(vUv * 2.0 - 1.0, 0.0, 1.0)).xyz;
            direction = (viewMatrixInv * vec4(direction, 0.0)).xyz;
            direction = normalize(direction);
            vec3 rayDir = direction;
            float t = -origin.y / rayDir.y;
            if ((t < linDepth || depth == 1.0) && t > 0.0 && cameraPos.y > 0.0) {
                if (depth == 1.0) {
                  linDepth = 1000.0;
                }
                vec3 normal = vec3(0.0, 1.0, 0.0);
                vec2 worldSampleCoord = (origin + rayDir * t).xz;
                worldSampleCoord.y *= resolution.y / resolution.x;
                vec3 normalMap = texture2D(waterNormal1, worldSampleCoord * 0.01 + time * 0.01).xyz;
                vec3 normalMap2 = texture2D(waterNormal2, worldSampleCoord * 0.01 - time * 0.01).xyz;
                normalMap = normalMap * 2.0 - 1.0;
                normalMap2 = normalMap2 * 2.0 - 1.0;
                mat3 TBN = GetTangentSpace(normal);
                normal = normalize(mix(normal, normalize(mix(normalize(TBN * normalMap), normalize(TBN * normalMap2), snoise(vec3(worldSampleCoord.x * 0.1, time * 0.5, worldSampleCoord.y * 0.1)))), 0.25));
                
                float rayLength = min(linDepth - t, 10.0);
                vec3 refractDir = refract(rayDir, normal, 1.0 / 1.3);
                vec3 refractColor = vec3(0.0);
                vec2 samplePos = vUv + normal.xz * (0.001 + 1.0 / t) * 10.0;
                if (getWorldPos(texture2D(sceneDepth, samplePos).r, samplePos).y < 0.0) {
                  refractColor = texture2D(tDiffuse, samplePos).rgb;
                } else {
                  refractColor = texture2D(tDiffuse, vUv).rgb;
                  samplePos = vUv;
                }
                vec3 reflectColor = vec3(0.0);
                vec2 rCoord = vUv + normal.xz * (0.001 + 1.0 / t) * 10.0;
                if (getWorldPos(texture2D(sceneDepth, rCoord.xy).r, rCoord.xy).y < 0.0) {
                  reflectColor = texture2D(reflectDiffuse, rCoord).rgb;
                }
                if (refractColor == vec3(0.0)) {
                  refractColor = textureCube(environment, refractDir).rgb;
                }
                if (reflectColor == vec3(0.0)) {
                  reflectColor = textureCube(environment, reflect(rayDir, normal)).rgb;
                }
                float theta = max( dot( -rayDir, normal ), 0.0 );
                float reflectance = 0.02 + ( 1.0 - 0.02 ) * pow( ( 1.0 - theta ), 5.0 );
                if (cameraPos.y < 0.0) {
                  reflectance = 0.0;
                }
                float yCoord = getWorldPos(texture2D(sceneDepth, samplePos).r, samplePos).y;
                float deepness = 0.1 + 0.9 * clamp(1.0 - exp(-0.15 * (depth < 1.0 ? -yCoord : 100.0)), 0.0, 1.0);
                float deepWaterC = clamp(depth < 1.0 ? -yCoord / 25.0 : 100.0, 0.0, 1.0);//clamp(1.0 - pow(3.0, -0.05 * (depth < 1.0 ? -worldPos.y : 100.0)), 0.0, 1.0);
                refractColor =  mix(refractColor, mix(vec3(0.0, 0.9, 1.0), vec3(0.0, 0.5, 1.0), deepWaterC), deepness);
                diffuse.rgb = mix(refractColor, reflectColor, reflectance) * (0.5 + 0.5 * dot(normal, normalize(lightPos)));
                diffuse.rgb += pow(max(dot(reflect(normalize(lightPos), normal), rayDir), 0.0), 32.0);
                if (depth < 1.0) {
                  diffuse.rgb += vec3(max(min(sin(worldPos.y - 2.5 * time) * pow(200.0, 0.1 * worldPos.y) * min(pow(200.0, -0.25 * (worldPos.y + 1.0)), 1.0), 1.0), 0.0) * 0.5);
                }
            } else if (cameraPos.y < 0.0) {
              vec3 normal = vec3(0.0, 1.0, 0.0);
              vec2 scaledUv = vec2(vUv.x * (resolution.x / resolution.y), vUv.y);
              vec3 normalMap = texture2D(waterNormal1, scaledUv + time * 0.01).xyz;
              vec3 normalMap2 = texture2D(waterNormal2, scaledUv - time * 0.01).xyz;
              normalMap = normalMap * 2.0 - 1.0;
              normalMap2 = normalMap2 * 2.0 - 1.0;
              mat3 TBN = GetTangentSpace(normal);
              normal = normalize(mix(normal, normalize(mix(normalize(TBN * normalMap), normalize(TBN * normalMap2), snoise(vec3(scaledUv.x, time * 0.5, scaledUv.y)))), 0.1));
              //diffuse.rgb = vec3(normal.xz, 0.0);
              diffuse.rgb = texture2D(tDiffuse, vUv + 0.25 * normal.xz).rgb;
              vec3 worldPosSample = getWorldPos(texture2D(sceneDepth, vUv + 0.25 * normal.xz).r, vUv + 0.25 * normal.xz);
              float dist = min( linearize_depth(texture2D(sceneDepth, vUv + 0.25 * normal.xz).r, 0.1, 1000.0), rayDir.y > 0.0 ? -cameraPos.y / rayDir.y: 1e20);
              diffuse.rgb = mix(diffuse.rgb, vec3(0.0, 0.5, 1.0), clamp(1.0 - (exp((worldPosSample.y > 0.0 ? -0.033 :-0.01) * dist) + (worldPosSample.y > 0.0 ? -0.33 : 0.0)), 0.0, 1.0));
            }
            gl_FragColor = vec4(diffuse.rgb, 1.0);
		}`

};

export { EffectShader };