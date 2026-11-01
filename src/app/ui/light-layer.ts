import { afterRenderEffect, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { LightSettings } from '../screens/menu/menu-look';

/** A light: where it is, in CSS pixels from the top left corner of its layer, its color, and the seed of its rays. */
export interface Light {
  readonly x: number;
  readonly y: number;
  /** As `#rrggbb`. */
  readonly color: string;
  readonly seed: number;
}

/** The most lights a layer has: enough for a title's letters. */
export const MAX_LIGHTS = 16;

/**
 * A color made more colorful by `saturation`, pushed further from its gray: a glow that only takes the color of what
 * gives it reads as a haze on the sky, where one more colorful reads as colored light.
 */
export function glowColor(hex: string, saturation: number): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const gray = (r + g + b) / 3;
  const saturated = (c: number): number => Math.min(1, Math.max(0, gray + (c - gray) * saturation));
  return [saturated(r), saturated(g), saturated(b)];
}

/**
 * Each pixel sums the light of every light: a glow fading as a Moffat profile, as stars glow in photographs, with a bright
 * core and a long faint tail, down to nothing at its reach; and its rays, 1D Perlin noise round the light, its own for
 * each, overlaid on the glow as in an image editor's overlay blend (`overlay` below): mid gray leaves the glow as it is,
 * darker darkens it and lighter lightens it, so that the rays streak the faint glow while its bright core stays whole.
 * Its color is the light's, with as much alpha as its strongest channel, already multiplied in: added to what lies under
 * the layer (`mix-blend-mode: plus-lighter`), it's light.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

const int MAX_LIGHTS = ${String(MAX_LIGHTS)};
uniform vec2 size;
uniform int count;
uniform vec2 positions[MAX_LIGHTS];
uniform vec3 colors[MAX_LIGHTS];
uniform uint seeds[MAX_LIGHTS];
uniform float intensity;
uniform float core;
uniform float falloff;
uniform float reach;
uniform float rays;
uniform int rayCount;
out vec4 light;

uint hash(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

// The random slope of the noise at lattice point i of n, round the circle.
float slope(int i, int n, uint seed) {
  uint k = uint(((i % n) + n) % n);
  return float(hash(k ^ hash(seed))) / 4294967295.0 * 2.0 - 1.0;
}

// 1D Perlin noise with n lattice points round the circle, at turn, from 0 to 1 round it: about -1 to 1.
float perlin(float turn, int n, uint seed) {
  float t = turn * float(n);
  float i = floor(t);
  float f = t - i;
  float u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  int k = int(i);
  return 2.0 * mix(slope(k, n, seed) * f, slope(k + 1, n, seed) * (f - 1.0), u);
}

float overlay(float base, float blend) {
  return base < 0.5 ? 2.0 * base * blend : 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= count) {
      break;
    }
    vec2 d = at - positions[i];
    float r = length(d);
    float glow = intensity * pow(1.0 + (r / core) * (r / core), -0.5 * falloff);
    float far = clamp(r / reach, 0.0, 1.0);
    float fade = (1.0 - far * far) * (1.0 - far * far);
    float turn = atan(d.y, d.x) / 6.28318531 + 0.5;
    float noise = (perlin(turn, rayCount, seeds[i]) + 0.5 * perlin(turn, rayCount * 2, seeds[i] + 7919u)) / 1.5;
    float streak = clamp(0.5 + 0.5 * rays * noise, 0.0, 1.0);
    float lit = glow >= 1.0 ? glow : overlay(glow, streak);
    sum += lit * fade * colors[i];
  }
  sum = min(sum, vec3(1.0));
  light = vec4(sum, max(sum.r, max(sum.g, sum.b)));
}
`;

const VERTEX_SHADER = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}
`;

/** The finest a layer draws: past twice the CSS pixels, the soft light gains nothing it shows. */
const MAX_PIXEL_RATIO = 2;

/**
 * A layer of light, on the canvas it's set on: the glow and rays of each of its lights, drawn with WebGL each time they
 * or its settings change, and added to whatever lies under it, the layers behind it included. Without WebGL, it stays
 * dark: the light is decoration.
 */
@Directive({
  selector: 'canvas[appLightLayer]',
  host: { 'aria-hidden': 'true' },
})
export class LightLayer {
  /** Its lights, at most {@link MAX_LIGHTS}. */
  readonly lights = input.required<readonly Light[]>({ alias: 'appLightLayer' });
  readonly settings = input.required<LightSettings>();

  private readonly canvas = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
  private renderer: Renderer | null | undefined;

  constructor() {
    afterRenderEffect({
      write: () => {
        this.draw(this.lights(), this.settings());
      },
    });
    inject(DestroyRef).onDestroy(() => this.renderer?.dispose());
  }

  private draw(lights: readonly Light[], settings: LightSettings): void {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (width === 0 || height === 0) {
      return;
    }
    this.renderer ??= Renderer.create(this.canvas);
    this.renderer?.draw(lights, settings, width, height);
  }
}

/** The WebGL program drawing a layer's light. */
class Renderer {
  static create(canvas: HTMLCanvasElement): Renderer | null {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
    if (gl === null) {
      return null;
    }
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX_SHADER],
      [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
    ] as const) {
      const shader = gl.createShader(type);
      if (shader === null) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);
    // Two triangles covering the canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const corner = gl.getAttribLocation(program, 'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    return new Renderer(canvas, gl, program);
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly program: WebGLProgram,
  ) {}

  /** Draws the lights on a canvas `width` by `height` CSS pixels, at most {@link MAX_PIXEL_RATIO} device pixels to one. */
  draw(lights: readonly Light[], settings: LightSettings, width: number, height: number): void {
    const { gl, program, canvas } = this;
    const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // The settings' lengths are hundredths of the layer's height.
    const unit = canvas.height / 100;
    const shown = lights.slice(0, MAX_LIGHTS);
    const at = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
    gl.uniform2f(at('size'), canvas.width, canvas.height);
    gl.uniform1i(at('count'), shown.length);
    if (shown.length > 0) {
      gl.uniform2fv(
        at('positions'),
        shown.flatMap((light) => [light.x * ratio, light.y * ratio]),
      );
      gl.uniform3fv(
        at('colors'),
        shown.flatMap((light) => glowColor(light.color, settings.saturation)),
      );
      gl.uniform1uiv(
        at('seeds'),
        shown.map((light) => light.seed >>> 0),
      );
    }
    gl.uniform1f(at('intensity'), settings.intensity);
    gl.uniform1f(at('core'), Math.max(0.01, settings.core * unit));
    gl.uniform1f(at('falloff'), settings.falloff);
    gl.uniform1f(at('reach'), Math.max(0.01, settings.reach * unit));
    gl.uniform1f(at('rays'), settings.rays);
    gl.uniform1i(at('rayCount'), Math.max(1, Math.round(settings.rayCount)));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
