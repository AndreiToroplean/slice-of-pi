import { DestroyRef, Directive, ElementRef, effect, inject } from '@angular/core';
import { keepGlContext } from '../../ui/gl-context';
import { Celebrating, Celebration } from './celebration';
import { MilestoneWave, RISE, waveLifetime } from './milestone-wave';

/**
 * Each pixel shows the wave as it is at its height, `climbTime` after the bottom made it, the same as `waveValue` and
 * `climbTime` work it out, only within a gradient in from the screen's nearest edge: its value tips the hue of the
 * milestone's color either way, rotated in YIQ, round its brightness, shimmering a little along the edges, and the further
 * from 0 it is, the more of that color covers what's under it, already multiplied in.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 size;
uniform float elapsed;
uniform bool first;
uniform vec3 color;
uniform float frequency;
uniform float duration;
uniform float decay;
uniform float peak;
uniform float speed;
uniform float acceleration;
uniform float depth;
uniform float falloff;
uniform float hue;
uniform float shimmer;
uniform float glow;
out vec4 painted;

const float TAU = 6.28318531;
const float RISE = ${String(RISE)};

float climbTime(float height) {
  return acceleration < 1e-3
    ? height / speed
    : (-speed + sqrt(speed * speed + 2.0 * acceleration * height)) / acceleration;
}

float waveValue(float s) {
  if (s < 0.0 || s > duration) {
    return 0.0;
  }
  float done = s / duration;
  if (first) {
    return peak * smoothstep(0.0, RISE, s) * pow(1.0 - done, decay) * cos(TAU * frequency * s);
  }
  float window = sin(3.14159265 * done);
  return peak * window * window * cos(TAU * frequency * (s - duration * 0.5));
}

vec3 tipped(vec3 c, float degrees) {
  float a = radians(degrees);
  mat3 toYiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  mat3 toRgb = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYiq * c;
  yiq.yz = mat2(cos(a), sin(a), -sin(a), cos(a)) * yiq.yz;
  return clamp(toRgb * yiq, 0.0, 1.0);
}

void main() {
  vec2 at = gl_FragCoord.xy;
  float height = at.y / size.y;
  float edge = min(min(at.x, size.x - at.x), min(at.y, size.y - at.y)) / min(size.x, size.y);
  float gradient = pow(clamp(1.0 - edge / depth, 0.0, 1.0), falloff);
  float value = waveValue(elapsed - climbTime(height));
  float alpha = clamp(abs(value) * gradient * glow, 0.0, 1.0) * 0.8;
  if (alpha <= 0.0) {
    painted = vec4(0.0);
    return;
  }
  float x = at.x / size.x;
  float noise = 0.6 * sin(height * 23.0 + elapsed * 3.1 + sin(height * 9.0 - elapsed * 2.3 + x * 5.0))
    + 0.4 * sin(height * 41.0 - elapsed * 4.7);
  vec3 shade = tipped(color, hue * clamp(value, -1.5, 1.5) + shimmer * noise);
  painted = vec4(shade * alpha, alpha);
}
`;

const VERTEX_SHADER = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}
`;

/** The wave's settings, by their uniforms' names. */
const SETTINGS: readonly (keyof MilestoneWave)[] = [
  'frequency',
  'duration',
  'decay',
  'peak',
  'speed',
  'acceleration',
  'depth',
  'falloff',
  'hue',
  'shimmer',
  'glow',
];

/**
 * The layer the milestones' celebrations show on, over every screen, on the canvas it's set on: each wave drawn with
 * WebGL frame by frame while it lasts, then the layer is cleared. It never takes a touch, and is hidden when nothing
 * shows, so as to cost nothing then. Without WebGL, the celebration has its sound alone.
 */
@Directive({
  selector: 'canvas[appCelebrationLayer]',
  host: { 'aria-hidden': 'true', '[class.idle]': '!celebration.celebrating()' },
})
export class CelebrationLayer {
  protected readonly celebration = inject(Celebration);
  private readonly canvas = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
  private renderer: Renderer | null | undefined;
  private frame: number | undefined;

  constructor() {
    effect(() => {
      const celebrating = this.celebration.celebrating();
      this.stop();
      if (celebrating !== undefined) {
        this.animate(celebrating);
      }
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.stop();
      this.renderer?.dispose();
    });
    keepGlContext(this.canvas, destroyRef, {
      lost: () => {
        this.renderer = undefined;
      },
      restored: () => {
        this.renderer = undefined;
      },
    });
  }

  private animate(celebrating: Celebrating): void {
    const lifetime = waveLifetime(celebrating.wave) * 1000;
    const step = (now: number): void => {
      const elapsed = now - celebrating.since;
      if (elapsed > lifetime) {
        this.frame = undefined;
        this.renderer?.clear();
        this.celebration.end(celebrating);
        return;
      }
      this.renderer ??= Renderer.create(this.canvas);
      this.renderer?.draw(celebrating, elapsed / 1000);
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private stop(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
  }
}

/** The WebGL program drawing a celebration's wave. */
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

  /**
   * Draws the wave `elapsed` seconds in, a device pixel to each CSS pixel at most: the soft gradient gains nothing
   * finer, and the whole screen is drawn every frame.
   */
  draw({ first, color, wave }: Celebrating, elapsed: number): void {
    const { gl, program, canvas } = this;
    const ratio = Math.min(1, window.devicePixelRatio || 1);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width === 0 || height === 0) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    const at = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
    gl.uniform2f(at('size'), width, height);
    gl.uniform1f(at('elapsed'), elapsed);
    gl.uniform1i(at('first'), first ? 1 : 0);
    gl.uniform3fv(
      at('color'),
      [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255),
    );
    for (const setting of SETTINGS) {
      gl.uniform1f(at(setting), wave[setting]);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Clears the layer, once the wave is over. */
  clear(): void {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
