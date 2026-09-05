/**
 * GLSL shader sources for the holographic foil overlay.
 *
 * Pointer-driven foil/glare interaction inspired by the public technique in
 * simeydotme/pokemon-cards-css.  This WebGL shader is an original adaptation;
 * no upstream card art, foil textures, or CSS source is bundled here.
 *
 * @module shaders
 */

export const holoVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const holoFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec2  uPointer;
  uniform float uHover;
  uniform float uTime;
  uniform float uStrength;
  uniform float uMode;
  uniform float uOpacity;
  uniform vec3  uTint;

  varying vec2 vUv;

  // ---- helpers ----

  float hash21(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  vec3 spectrum(float phase) {
    return 0.55 + 0.45 * cos(6.2831853 * (phase + vec3(0.00, 0.33, 0.67)));
  }

  // ---- main ----

  void main() {
    vec2  fromPointer = vUv - uPointer;
    float radial      = pow(max(0.0, 1.0 - length(fromPointer) / 0.78), 2.1);
    float diagonal    = dot(vUv - uPointer * 0.35, normalize(vec2(0.82, -0.58)));

    // shared pattern components
    vec3  rainbow   = spectrum(diagonal * 1.85 + uTime * 0.035);
    float fineBands = 0.5 + 0.5 * sin((diagonal + uTime * 0.012) * 92.0);
    float wideBand  = pow(0.5 + 0.5 * sin((diagonal - uTime * 0.02) * 15.0), 5.0);
    float cell      = hash21(floor(vUv * vec2(88.0, 124.0)) + floor(uTime * 1.7));
    float sparkle   = step(0.975, cell) * (0.35 + 0.65 * radial);
    float facet     = pow(abs(sin(vUv.x * 28.0) * sin(vUv.y * 34.0)), 7.0);
    float laser     = pow(0.5 + 0.5 * sin((vUv.x * 1.25 - vUv.y) * 118.0), 18.0);
    float flame     = smoothstep(0.15, 0.92, 1.0 - vUv.y)
                    * (0.4 + 0.6 * sin(vUv.x * 20.0 + uTime * 1.4));
    float galaxy    = sparkle
                    + 0.28 * pow(0.5 + 0.5 * sin((vUv.x + vUv.y) * 23.0 - uTime * 0.3), 8.0);

    // per-mode colour and pattern selection
    vec3  effectColor = mix(uTint, rainbow, 0.38);
    float pattern     = radial * 0.55 + wideBand * 0.24;

    if (uMode < 0.5) {                       // none
      effectColor = mix(vec3(1.0), uTint, 0.38);
      pattern     = radial * 0.72;
    } else if (uMode < 1.5) {                // diamond
      effectColor = mix(uTint, rainbow, 0.28);
      pattern     = radial * 0.42 + facet * 0.56 + sparkle * 0.42;
    } else if (uMode < 2.5) {                // lightning
      effectColor = mix(vec3(0.58, 0.76, 1.0), uTint, 0.42);
      pattern     = radial * 0.38 + wideBand * 0.72 + laser * 0.24;
    } else if (uMode < 3.5) {                // rainbow
      effectColor = rainbow;
      pattern     = radial * 0.46 + fineBands * 0.22 + wideBand * 0.42;
    } else if (uMode < 4.5) {                // crystal
      effectColor = mix(vec3(0.72, 0.96, 1.0), rainbow, 0.32);
      pattern     = radial * 0.4 + facet * 0.52 + fineBands * 0.15;
    } else if (uMode < 5.5) {                // holographic
      effectColor = mix(rainbow, uTint, 0.24);
      pattern     = radial * 0.38 + fineBands * 0.2 + sparkle * 0.92;
    } else if (uMode < 6.5) {                // laser
      effectColor = mix(vec3(0.35, 0.86, 1.0), rainbow, 0.38);
      pattern     = radial * 0.32 + laser * 0.92 + wideBand * 0.22;
    } else if (uMode < 7.5) {                // flame
      effectColor = mix(vec3(1.0, 0.12, 0.02), vec3(1.0, 0.78, 0.12), clamp(flame, 0.0, 1.0));
      pattern     = radial * 0.26 + max(0.0, flame) * 0.58 + wideBand * 0.2;
    } else {                                  // galaxy
      effectColor = mix(vec3(0.18, 0.25, 0.92), vec3(0.92, 0.28, 1.0), radial);
      pattern     = radial * 0.34 + galaxy * 0.78;
    }

    // edge fade + final compositing
    float edgeFade = smoothstep(0.0, 0.045, vUv.x) * smoothstep(0.0, 0.045, vUv.y)
                   * smoothstep(0.0, 0.045, 1.0 - vUv.x) * smoothstep(0.0, 0.045, 1.0 - vUv.y);
    float energy   = clamp(pattern * (0.28 + uStrength * 0.84), 0.0, 1.0);
    float alpha    = energy * mix(0.16, 0.88, uHover) * uOpacity * edgeFade;

    gl_FragColor = vec4(effectColor * (0.82 + radial * 0.55 + sparkle), alpha);
  }
`;

/** Default uniform values for the holo shader. */
export const HOLO_UNIFORMS_DEFAULTS = Object.freeze({
  uPointer:  Object.freeze([0.5, 0.5]),
  uHover:    0,
  uTime:     0,
  uStrength: 0.5,
  uMode:     0,
  uOpacity:  0.45,
  uTint:     0xccefff
});
