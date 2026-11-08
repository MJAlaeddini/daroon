/* WebGL2 renderer for the emotion stone: one full-screen pass over up to six stones' art (see glsl.ts).
 * Premultiplied output, so it sits on a dark ground as light and on a light ground as tinted glass. */
import { ART, artImage, OUTLINE_BINS } from './art';
import type { Frame } from './compose';
import { STONE_FS, STONE_VS } from './glsl';
import { EMOTION_IDS, type EmotionId } from './presets';

export type Theme = 'dark' | 'light';
export interface DrawOptions {
  theme: Theme;
  /** 1 shows the whole art square; larger is closer */
  zoom?: number;
}
export interface StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  /** false while some art this frame needs is still loading (nothing is drawn then) */
  draw(frame: Frame, opts: DrawOptions): boolean;
  dispose(): void;
}

/* outline rows: the twelve stones, then the resting stone (calm's outline) */
const ROWS: EmotionId[] = [...EMOTION_IDS, 'calm'];

export class GLStoneRenderer implements StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private vao: WebGLVertexArrayObject;
  private tex = new Map<EmotionId, WebGLTexture>();
  private outlineTex: WebGLTexture;
  lost = false;

  constructor(canvas: HTMLCanvasElement, preserve = false) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: preserve,
    });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.prog = program(gl, STONE_VS, STONE_FS);
    gl.useProgram(this.prog);
    for (const n of ['uRes', 'uZoom', 'uOutline', 'uRows', 'uN', 'uA', 'uB', 'uM0', 'uM1', 'uM2', 'uWobble', 'uDark'])
      this.u[n] = gl.getUniformLocation(this.prog, n);
    for (let i = 0; i < 6; i++) gl.uniform1i(gl.getUniformLocation(this.prog, `uT${i}`), i);
    gl.uniform1i(this.u.uOutline, 6);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'aP');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    /* outlines as a small float texture, repeating around the circle */
    const data = new Float32Array(OUTLINE_BINS * ROWS.length);
    ROWS.forEach((id, r) => data.set(ART[id].outline, r * OUTLINE_BINS));
    this.outlineTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.outlineTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, OUTLINE_BINS, ROWS.length, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  /** the art of a stone as a texture in this context, uploaded the first time it is needed */
  private texture(id: EmotionId): WebGLTexture | null {
    const have = this.tex.get(id);
    if (have) return have;
    const im = artImage(id);
    if (!im) return null;
    const gl = this.gl,
      t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, im);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex.set(id, t);
    return t;
  }

  draw(fr: Frame, opts: DrawOptions): boolean {
    const gl = this.gl,
      u = this.u;
    if (this.lost) return false;
    const texs = fr.slots.map((s) => this.texture(s.art));
    const W = this.canvas.width,
      H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (texs.some((t) => !t)) return false;
    gl.useProgram(this.prog);
    texs.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
    });
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.outlineTex);
    const A = new Float32Array(24),
      B = new Float32Array(24),
      M0 = new Float32Array(24),
      M1 = new Float32Array(24),
      M2 = new Float32Array(24);
    fr.slots.forEach((s, i) => {
      const m = s.moves;
      A.set([s.w, s.band, s.turn, s.row], i * 4);
      B.set([s.center[0], s.center[1], s.desat, 0], i * 4);
      M0.set([m.scale, m.inner, m.swirl, m.counter], i * 4);
      M1.set([m.rise, m.sway, m.swayPh, m.ripple], i * 4);
      M2.set([m.ripplePh, m.tremor, m.tremorPh, m.glow], i * 4);
    });
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uZoom, opts.zoom ?? 1);
    gl.uniform1f(u.uRows, ROWS.length);
    gl.uniform1i(u.uN, fr.slots.length);
    gl.uniform4fv(u.uA, A);
    gl.uniform4fv(u.uB, B);
    gl.uniform4fv(u.uM0, M0);
    gl.uniform4fv(u.uM1, M1);
    gl.uniform4fv(u.uM2, M2);
    gl.uniform1f(u.uWobble, fr.wobble);
    gl.uniform1i(u.uDark, opts.theme === 'dark' ? 1 : 0);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    return true;
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

/** Without WebGL2: the strongest stone's art, drawn as it is (no mixing, no motion). */
export class Canvas2DStoneRenderer implements StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private x: CanvasRenderingContext2D | null;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.x = canvas.getContext('2d');
  }
  draw(fr: Frame, opts: DrawOptions): boolean {
    const x = this.x;
    if (!x) return false;
    const { width: W, height: H } = this.canvas;
    x.clearRect(0, 0, W, H);
    const top = [...fr.slots].sort((a, b) => b.w - a.w)[0];
    const im = top && artImage(top.art);
    if (!im) return false;
    const s = Math.min(W, H) * (opts.zoom ?? 1);
    x.globalCompositeOperation = opts.theme === 'dark' ? 'lighter' : 'source-over';
    x.globalAlpha = opts.theme === 'dark' ? 1 : 0.85;
    x.drawImage(im, (W - s) / 2 - (top.center[0] * s) / 2, (H - s) / 2 + (top.center[1] * s) / 2, s, s);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    return true;
  }
  dispose(): void {}
}

export function createRenderer(canvas: HTMLCanvasElement, preserve = false): StoneRenderer {
  try {
    return new GLStoneRenderer(canvas, preserve);
  } catch (e) {
    console.warn('emotion stone: WebGL2 unavailable, drawing in 2D', e);
    return new Canvas2DStoneRenderer(canvas);
  }
}
