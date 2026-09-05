/** GLSL vertex shader source for the holographic foil overlay. */
export declare const holoVertexShader: string;

/** GLSL fragment shader source for the holographic foil overlay (9 effect modes). */
export declare const holoFragmentShader: string;

/** Default uniform values for the holo shader. */
export declare const HOLO_UNIFORMS_DEFAULTS: Readonly<{
  uPointer: readonly [number, number];
  uHover: number;
  uTime: number;
  uStrength: number;
  uMode: number;
  uOpacity: number;
  uTint: number;
}>;
