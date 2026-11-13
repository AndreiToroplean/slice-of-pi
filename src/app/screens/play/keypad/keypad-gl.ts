import { Box, Corners } from './key-shapes';

/**
 * The digit keys drawn in one WebGL canvas, in passes, each simple:
 *
 * 1. Shapes: the keys as one, their shapes (see `key-shapes.ts`), drawn row by row from the top, the farthest, each
 *    key's face, color and lingering color over the rows behind it; drawn twice, at rest for the keys' edges (rims),
 *    and as they show for their faces, sunk.
 * 2. Edges: a key's edge is the side of its body, as deep as the keys are, under its outline where that faces down: a
 *    pixel is on one where, going up from it no farther than the keys' depth, it enters a shape from outside.
 * 3. Blur: what's behind the faces, the edges, blurred as a frosted surface blurs what's behind it: a Gaussian blur,
 *    as `backdrop-filter: blur()` does, on an image made smaller first, as it's smooth anyway.
 * 4. The faces over what's behind them: blurred within them, sharp around them, and their shine along their tops.
 *
 * The page's background shows through the canvas: as it's smooth, blurring it would leave it as it is, so the faces
 * don't need it in the canvas to look as frosted surfaces over it do.
 */

export const MAX_KEYS = 10;

/** A key as drawn, its boxes at rest, in CSS pixels in the grid. */
export interface GlKey {
  /** Its shape (see `KeyShape`). */
  readonly box: Box;
  readonly joined: readonly [boolean, boolean, boolean, boolean];
  readonly across: Box;
  readonly along: Box;
  readonly radii: Corners;
  readonly corner: Box | undefined;
  /** How far its face has sunk, in CSS pixels: its edge stays where it is. */
  readonly sink: number;
  /** Its face's and its edge's colors, as premultiplied RGBA from 0 to 1. */
  readonly face: readonly [number, number, number, number];
  readonly rim: readonly [number, number, number, number];
  /** The color lingering on it, its face and its edge, as RGB from 0 to 1, and how much of it is left, from 1 to 0. */
  readonly linger: readonly [number, number, number];
  readonly lingering: number;
}

export interface GlScene {
  /** The grid's size, in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** How far the canvas reaches past the grid on each side, in CSS pixels. */
  readonly margin: number;
  readonly depth: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly highlight: number;
  /** How far frosted faces blur what's behind them, in CSS pixels, as `blur()` does, and whether they're frosted. */
  readonly blur: number;
  readonly frosted: boolean;
  readonly keys: readonly GlKey[];
}

const KEYS = String(MAX_KEYS);

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

/** Pass 1: the shapes, their colors, premultiplied, and how much of each pixel they cover. */
const SHAPES = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uDpr;
uniform float uMargin;
uniform vec2 uGap;
uniform int uKeys;
// Whether to draw the keys at rest, with their edges' colors, or as they show, with their faces'.
uniform bool uRest;
uniform vec4 uKeyAcross[${KEYS}];
uniform vec4 uKeyAlong[${KEYS}];
uniform vec4 uKeyRadii[${KEYS}];
uniform vec4 uKeyMeta[${KEYS}];
uniform vec4 uKeyFace[${KEYS}];
uniform vec4 uKeyRim[${KEYS}];
uniform vec4 uKeyBox[${KEYS}];
// The color lingering on a key, its face and its edge, and how much of it is left.
uniform vec4 uKeyLinger[${KEYS}];
// Which of a key's sides touch the key there, merged all the way: left, top, right, bottom.
uniform vec4 uKeyJoined[${KEYS}];
uniform vec4 uKeyCorner[${KEYS}];
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outCover;

// How far outside a box, its corners round as told: top left, top right, bottom right, bottom left.
float sdRound(vec2 p, vec4 box, vec4 r) {
  vec2 h = box.zw * 0.5;
  vec2 q = p - box.xy - h;
  float radius = q.x < 0.0 ? (q.y < 0.0 ? r.x : r.w) : (q.y < 0.0 ? r.y : r.z);
  vec2 d = abs(q) - h + radius;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
}

// How far outside a key's shape: its face where it is, sunk as it's pressed, or as it rises back; its edge where it
// is at rest.
float sdKey(int i, vec2 p) {
  vec2 sunk = uRest ? vec2(0.0) : vec2(0.0, uKeyMeta[i].x);
  float d = min(sdRound(p - sunk, uKeyAcross[i], uKeyRadii[i]), sdRound(p - sunk, uKeyAlong[i], uKeyRadii[i]));
  vec4 corner = uKeyCorner[i];
  return corner.z > 0.0 ? min(d, sdRound(p - sunk, corner, vec4(0.0))) : d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr - uMargin;
  // The keys as one. They come row by row from the top, the farthest, down, each drawn over those before: its shape,
  // as it stretches, hides their colors, and where it is at rest, their lingering colors, which fade across the gaps
  // between keys that touch, into each other's halves.
  float merged = 1e5;
  vec4 front = vec4(0.0);
  float frontCover = 0.0;
  vec4 linger = vec4(0.0);
  // A line of light a CSS pixel high along the top of each face, inside it, where no face as deep as it is above it:
  // the key itself, or those it merges with at rest. A key sunk behind it doesn't hide it.
  float shine = 0.0;
  for (int i = 0; i < ${KEYS}; i++) {
    if (i >= uKeys) break;
    float d = sdKey(i, p);
    vec4 own = uRest ? uKeyRim[i] : uKeyFace[i];
    merged = min(merged, d);
    vec4 face = uKeyBox[i];
    if (!uRest) {
      face.y += uKeyMeta[i].x;
    }
    float on = clamp(0.5 - d * uDpr, 0.0, 1.0);
    front = own * on + front * (1.0 - on);
    frontCover = on + frontCover * (1.0 - on);
    linger *= 1.0 - clamp(0.5 - sdRound(p, face, uKeyRadii[i]) * uDpr, 0.0, 1.0);
    if (!uRest && on > 0.0) {
      vec2 up = p - vec2(0.0, 1.0);
      float above = clamp(0.5 - sdKey(i, up) * uDpr, 0.0, 1.0);
      for (int j = 0; j < ${KEYS}; j++) {
        if (j >= uKeys || above >= 1.0) break;
        if (j != i && abs(uKeyMeta[j].x - uKeyMeta[i].x) < 0.01) {
          above = max(above, clamp(0.5 - sdKey(j, up) * uDpr, 0.0, 1.0));
        }
      }
      shine = on * (1.0 - above) + shine * (1.0 - on);
    }
    if (uKeyLinger[i].a > 0.0) {
      // On the key as it stretches, and, past the sides where it touches another key, fading out across the gap
      // between them, from where its side was to where the other's was.
      vec4 box = face;
      vec4 joined = uKeyJoined[i];
      vec4 beyond = vec4(box.x - p.x, box.y - p.y, p.x - box.x - box.z, p.y - box.y - box.w);
      vec4 gaps = vec4(uGap.x, uGap.y, uGap.x, uGap.y);
      bool alongX = p.y >= box.y && p.y <= box.y + box.w;
      bool alongY = p.x >= box.x && p.x <= box.x + box.z;
      vec4 within = vec4(alongX, alongY, alongX, alongY);
      vec4 inGaps = joined * within * step(0.0, beyond) * step(beyond, gaps);
      float inGap = max(max(inGaps.x, inGaps.y), max(inGaps.z, inGaps.w));
      vec4 fade = clamp(1.0 - max(beyond, 0.0) / gaps, 0.0, 1.0);
      vec4 faded = mix(vec4(1.0), fade, joined);
      float amount = max(clamp(0.5 - d * uDpr, 0.0, 1.0), inGap) * faded.x * faded.y * faded.z * faded.w;
      float k = uKeyLinger[i].a * amount;
      linger = vec4(uKeyLinger[i].rgb, 1.0) * k + linger * (1.0 - k);
    }
  }
  float cover = clamp(0.5 - merged * uDpr, 0.0, 1.0);
  vec4 color = frontCover > 0.0 ? front / frontCover : vec4(0.0);
  vec4 tint = linger + color * (1.0 - linger.a);
  outColor = tint * cover;
  outCover = vec4(cover, shine, 0.0, 1.0);
}
`;

/** Pass 2: the edges, under the outlines facing down, as deep as the keys. */
const EDGES = `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uCover;
// The faces as drawn, sunk: what's behind them is what they blur.
uniform sampler2D uFaces;
// The keys' depth, in device pixels.
uniform float uDepth;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outBehind;
layout(location = 2) out vec4 outFaces;

void main() {
  ivec2 size = textureSize(uCover, 0);
  vec2 at = gl_FragCoord.xy;
  float lowest = texture(uCover, at / vec2(size)).r;
  float best = 0.0;
  vec4 color = vec4(0.0);
  float stride = max(1.0, uDepth / 160.0);
  for (int k = 1; k <= 160; k++) {
    float t = min(float(k) * stride, uDepth);
    // Up, as the canvas' rows go up.
    vec2 up = (at + vec2(0.0, t)) / vec2(size);
    float c = texture(uCover, up).r;
    // How far from outside, below, to inside, here: entering a shape going up.
    float rise = c - lowest;
    if (rise > best) {
      best = rise;
      // Its color, a little inside the shape, unmixed with what's outside it.
      vec2 inside = (at + vec2(0.0, t + 1.0)) / vec2(size);
      color = texture(uColor, inside) / max(texture(uCover, inside).r, 1e-3);
    }
    lowest = min(lowest, c);
    if (t >= uDepth) break;
  }
  outColor = color * clamp(best, 0.0, 1.0);
  // What the faces blur: only what's behind them, as a frosted surface blurs only what's behind it.
  float faces = texture(uFaces, at / vec2(size)).r;
  outBehind = outColor * faces;
  outFaces = vec4(faces);
}
`;

/**
 * Pass 3: one way of a Gaussian blur, from a level made smaller, or from the other way's: of what's behind the faces,
 * and of the faces, to weigh it by, so that what's behind a face is blurred with nothing from around it.
 */
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uWeights;
uniform float uLevel;
uniform vec2 uStep;
uniform vec2 uSize;
uniform float uSigma;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outWeights;

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  int reach = int(min(ceil(3.0 * uSigma), 48.0));
  vec4 sum = vec4(0.0);
  vec4 weights = vec4(0.0);
  float total = 0.0;
  for (int i = -48; i <= 48; i++) {
    if (i < -reach || i > reach) continue;
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    sum += w * textureLod(uSource, uv + float(i) * uStep, uLevel);
    weights += w * textureLod(uWeights, uv + float(i) * uStep, uLevel);
    total += w;
  }
  outColor = sum / total;
  outWeights = weights / total;
}
`;

/** Pass 4: the faces over what's behind them, blurred within them, and their shine. */
const COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D uFace;
uniform sampler2D uCover;
uniform sampler2D uBehind;
uniform sampler2D uBlurred;
uniform sampler2D uBlurredFaces;
uniform float uHighlight;
uniform float uFrosted;
out vec4 outColor;

void main() {
  ivec2 size = textureSize(uFace, 0);
  vec2 uv = gl_FragCoord.xy / vec2(size);
  vec4 face = texture(uFace, uv);
  float cover = texture(uCover, uv).r;
  vec4 blurred = texture(uBlurred, uv) / max(texture(uBlurredFaces, uv).r, 1e-3);
  vec4 behind = mix(texture(uBehind, uv), blurred, cover * uFrosted);
  vec4 color = face + (1.0 - face.a) * behind;
  float shine = texture(uCover, uv).g * uHighlight;
  outColor = color * (1.0 - shine) + vec4(shine);
}
`;

interface Target {
  readonly framebuffer: WebGLFramebuffer;
  readonly textures: readonly WebGLTexture[];
  readonly width: number;
  readonly height: number;
}

export class KeypadRenderer {
  private readonly programs: {
    readonly shapes: WebGLProgram;
    readonly edges: WebGLProgram;
    readonly blur: WebGLProgram;
    readonly compose: WebGLProgram;
  };
  private readonly uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  /** Whether the blur can be worked out finely, where the device draws in floats. */
  private readonly floats: boolean;
  private targets:
    | {
        readonly rest: Target;
        readonly sunk: Target;
        readonly behind: Target;
        readonly across: Target;
        readonly blurred: Target;
        readonly key: string;
      }
    | undefined;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
  ) {
    this.floats =
      gl.getExtension('EXT_color_buffer_float') !== null ||
      gl.getExtension('EXT_color_buffer_half_float') !== null;
    this.programs = {
      shapes: this.program(SHAPES),
      edges: this.program(EDGES),
      blur: this.program(BLUR),
      compose: this.program(COMPOSE),
    };
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /** What draws the keys in a canvas, or why nothing can. */
  static create(canvas: HTMLCanvasElement): KeypadRenderer | string {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      antialias: false,
      alpha: true,
    });
    if (gl === null) {
      return 'No WebGL 2';
    }
    try {
      return new KeypadRenderer(canvas, gl);
    } catch (error) {
      console.error(error);
      return String(error);
    }
  }

  private program(fragment: string): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type);
      if (shader === null) {
        throw new Error('No shader');
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed');
      }
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, 'position');
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'Link failed');
    }
    return program;
  }

  private at(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    let known = this.uniforms.get(program);
    if (known === undefined) {
      known = new Map();
      this.uniforms.set(program, known);
    }
    if (!known.has(name)) {
      known.set(name, this.gl.getUniformLocation(program, name));
    }
    return known.get(name) ?? null;
  }

  private texture(
    width: number,
    height: number,
    format: number,
    filter: number,
    levels = 1,
  ): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, levels, format, width, height);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : filter,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private target(
    width: number,
    height: number,
    count: number,
    levels = 1,
    precise = false,
  ): Target {
    const gl = this.gl;
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const textures = Array.from({ length: count }, (_, index) => {
      const texture = this.texture(
        width,
        height,
        precise && this.floats ? gl.RGBA16F : gl.RGBA8,
        gl.LINEAR,
        levels,
      );
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + index,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      return texture;
    });
    gl.drawBuffers(textures.map((_, index) => gl.COLOR_ATTACHMENT0 + index));
    return { framebuffer, textures, width, height };
  }

  private release(target: Target): void {
    this.gl.deleteFramebuffer(target.framebuffer);
    for (const texture of target.textures) {
      this.gl.deleteTexture(texture);
    }
  }

  /** The textures the passes draw in, for a canvas so large, and a blur so far. */
  private targetsFor(width: number, height: number, level: number) {
    const key = `${String(width)} ${String(height)} ${String(level)}`;
    if (this.targets?.key !== key) {
      if (this.targets !== undefined) {
        const { rest, sunk, behind, across, blurred } = this.targets;
        for (const target of [rest, sunk, behind, across, blurred]) {
          this.release(target);
        }
      }
      const small = (size: number): number => Math.max(1, Math.ceil(size / 2 ** level));
      this.targets = {
        rest: this.target(width, height, 2),
        sunk: this.target(width, height, 2),
        behind: this.target(width, height, 3, level + 1, true),
        across: this.target(small(width), small(height), 2, 1, true),
        blurred: this.target(small(width), small(height), 2, 1, true),
        key,
      };
    }
    return this.targets;
  }

  private bind(program: WebGLProgram, name: string, unit: number, texture: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.at(program, name), unit);
  }

  draw(scene: GlScene): void {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = scene.width + 2 * scene.margin;
    const cssHeight = scene.height + 2 * scene.margin;
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    // Blurred on an image made smaller, so that the blur spreads over a few of its pixels only.
    const sigma = scene.blur * dpr;
    const level = Math.max(0, Math.min(5, Math.round(Math.log2(Math.max(1, sigma / 3)))));
    const targets = this.targetsFor(width, height, level);

    // 1. The shapes, at rest then as they show.
    const shapes = this.programs.shapes;
    gl.useProgram(shapes);
    gl.uniform2f(this.at(shapes, 'uSize'), cssWidth, cssHeight);
    gl.uniform1f(this.at(shapes, 'uDpr'), dpr);
    gl.uniform1f(this.at(shapes, 'uMargin'), scene.margin);
    gl.uniform2f(this.at(shapes, 'uGap'), scene.gapX, scene.gapY);
    const keys = scene.keys.slice(0, MAX_KEYS);
    gl.uniform1i(this.at(shapes, 'uKeys'), keys.length);
    const box = ({ x, y, width, height }: Box): number[] => [x, y, width, height];
    const vectors = (name: string, values: number[]): void => {
      if (values.length > 0) {
        gl.uniform4fv(this.at(shapes, name), values);
      }
    };
    vectors(
      'uKeyAcross',
      keys.flatMap((key) => box(key.across)),
    );
    vectors(
      'uKeyAlong',
      keys.flatMap((key) => box(key.along)),
    );
    vectors(
      'uKeyRadii',
      keys.flatMap((key) => [...key.radii]),
    );
    vectors(
      'uKeyMeta',
      keys.flatMap((key) => [key.sink, 0, 0, 0]),
    );
    vectors(
      'uKeyFace',
      keys.flatMap((key) => [...key.face]),
    );
    vectors(
      'uKeyRim',
      keys.flatMap((key) => [...key.rim]),
    );
    vectors(
      'uKeyBox',
      keys.flatMap((key) => box(key.box)),
    );
    vectors(
      'uKeyLinger',
      keys.flatMap((key) => [...key.linger, key.lingering]),
    );
    vectors(
      'uKeyJoined',
      keys.flatMap((key) => key.joined.map((side) => (side ? 1 : 0))),
    );
    vectors(
      'uKeyCorner',
      keys.flatMap((key) => (key.corner === undefined ? [0, 0, 0, 0] : box(key.corner))),
    );
    for (const [target, rest] of [
      [targets.rest, true],
      [targets.sunk, false],
    ] as const) {
      gl.uniform1i(this.at(shapes, 'uRest'), rest ? 1 : 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 2. The edges.
    const edges = this.programs.edges;
    gl.useProgram(edges);
    const [restColor, restCover] = targets.rest.textures;
    const [behind, masked, mask] = targets.behind.textures;
    const [, sunkCover] = targets.sunk.textures;
    if (
      restColor === undefined ||
      restCover === undefined ||
      behind === undefined ||
      masked === undefined ||
      mask === undefined ||
      sunkCover === undefined
    ) {
      return;
    }
    this.bind(edges, 'uColor', 0, restColor);
    this.bind(edges, 'uCover', 1, restCover);
    this.bind(edges, 'uFaces', 2, sunkCover);
    gl.uniform1f(this.at(edges, 'uDepth'), scene.depth * dpr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.behind.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (const texture of [masked, mask]) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    // 3. The blur, across then down, on the edges made smaller.
    const blur = this.programs.blur;
    gl.useProgram(blur);
    const smallSigma = sigma / 2 ** level;
    gl.uniform1f(this.at(blur, 'uSigma'), Math.max(smallSigma, 0.01));
    const [across, acrossFaces] = targets.across.textures;
    const [blurred, blurredFaces] = targets.blurred.textures;
    if (
      across === undefined ||
      acrossFaces === undefined ||
      blurred === undefined ||
      blurredFaces === undefined
    ) {
      return;
    }
    for (const [source, weights, sourceLevel, target, direction] of [
      [masked, mask, level, targets.across, [1, 0]],
      [across, acrossFaces, 0, targets.blurred, [0, 1]],
    ] as const) {
      this.bind(blur, 'uSource', 0, source);
      this.bind(blur, 'uWeights', 1, weights);
      gl.uniform1f(this.at(blur, 'uLevel'), sourceLevel);
      gl.uniform2f(
        this.at(blur, 'uStep'),
        direction[0] / targets.across.width,
        direction[1] / targets.across.height,
      );
      gl.uniform2f(this.at(blur, 'uSize'), target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 4. The faces over all that.
    const compose = this.programs.compose;
    gl.useProgram(compose);
    const [face, cover] = targets.sunk.textures;
    if (face === undefined || cover === undefined) {
      return;
    }
    this.bind(compose, 'uFace', 0, face);
    this.bind(compose, 'uCover', 1, cover);
    this.bind(compose, 'uBehind', 2, behind);
    this.bind(compose, 'uBlurred', 3, blurred);
    this.bind(compose, 'uBlurredFaces', 4, blurredFaces);
    gl.uniform1f(this.at(compose, 'uHighlight'), scene.highlight);
    gl.uniform1f(this.at(compose, 'uFrosted'), scene.frosted ? 1 : 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

const parsed = new Map<string, readonly [number, number, number, number]>();
let parser: CanvasRenderingContext2D | null | undefined;

/** A CSS color as RGBA from 0 to 1, not premultiplied. */
export function rgba(css: string): readonly [number, number, number, number] {
  const known = parsed.get(css);
  if (known !== undefined) {
    return known;
  }
  parser ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (parser === null) {
    return [1, 1, 1, 1];
  }
  parser.clearRect(0, 0, 1, 1);
  parser.fillStyle = '#000';
  parser.fillStyle = css;
  parser.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = parser.getImageData(0, 0, 1, 1).data;
  const color = [r / 255, g / 255, b / 255, a / 255] as const;
  parsed.set(css, color);
  return color;
}

/** A color premultiplied, with an opacity. */
export function premultiplied(
  [r, g, b, a]: readonly [number, number, number, number],
  opacity = 1,
): [number, number, number, number] {
  const alpha = a * opacity;
  return [r * alpha, g * alpha, b * alpha, alpha];
}
