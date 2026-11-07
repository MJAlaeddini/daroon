/* WebGL2 renderer for the emotion stone.
 *
 * One icosphere, uploaded once, is drawn six times per frame: the back faces of the two outer shells from the
 * outside in, then the front faces of all four from the inside out. That order composites nested translucent shells correctly without
 * sorting triangles or a depth buffer; blending is premultiplied alpha, never additive, so the stone also sits well
 * on a light page. Nothing about a change of feelings touches the geometry: the shape comes from uniforms alone. */
import { oklabToCss, oklabToLinear, type Lab } from './color';
import { field, type FieldGlobals, SHELL_AMP, SHELL_PHASE, type SlotFrame, type V3 } from './field';
import { HALO_FS, HALO_VS, SLOT_VEC4, STONE_FS, STONE_VS } from './glsl';
import { MAX_SLOTS, type Frame } from './motion';
import { RENDERER } from './presets';

export type Theme = 'dark' | 'light';
export interface DrawOptions {
  theme: Theme;
  /** 1 fits the stone with room for its halo; larger is closer */
  zoom?: number;
}

const FOV = (38 * Math.PI) / 180;
const DIST = 4.25;
const EYE: V3 = [0, 0.85, DIST];

/* ── geometry ─────────────────────────────────────────────────────────── */
const spheres = new Map<number, { pos: Float32Array; idx: Uint16Array }>();
/** Unit icosphere, subdivided `level` times: 5 → 10 242 vertices (smooth when large), 4 → 2 562 (small sizes and
    slower phones). */
export function icosphere(level = 5): { pos: Float32Array; idx: Uint16Array } {
  const cached = spheres.get(level);
  if (cached) return cached;
  const t = (1 + Math.sqrt(5)) / 2;
  const v: number[][] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((p) => {
    const l = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / l, p[1] / l, p[2] / l];
  });
  let f = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let s = 0; s < level; s++) {
    const cache = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let i = cache.get(key);
      if (i === undefined) {
        const p = [v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]];
        const l = Math.hypot(p[0], p[1], p[2]);
        i = v.push([p[0] / l, p[1] / l, p[2] / l]) - 1;
        cache.set(key, i);
      }
      return i;
    };
    const nf: number[][] = [];
    for (const [a, b, c] of f) {
      const ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = nf;
  }
  const out = { pos: new Float32Array(v.flat()), idx: new Uint16Array(f.flat()) };
  spheres.set(level, out);
  return out;
}

/* ── camera ───────────────────────────────────────────────────────────── */
function lookAt(eye: V3, at: V3): number[] {
  const z = norm([eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]);
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
}
/** Perspective whose field of view spans the shorter side, so the stone fits any aspect ratio. */
function perspective(w: number, h: number, near = 0.1, far = 20): number[] {
  const f = 1 / Math.tan(FOV / 2),
    m = Math.min(w, h);
  const nf = 1 / (near - far);
  return [(f * m) / w, 0, 0, 0, 0, (f * m) / h, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function mul(a: number[], b: number[]): number[] {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Radius of a world-unit sphere at the origin, in units of half the shorter side of the canvas. */
const screenRadius = (zoom: number) => zoom / (Math.tan(FOV / 2) * Math.hypot(...EYE));

/* ── uniforms ─────────────────────────────────────────────────────────── */
export function packSlots(slots: SlotFrame[]): Float32Array {
  const a = new Float32Array(MAX_SLOTS * SLOT_VEC4 * 4);
  slots.forEach((s, i) => {
    a.set(
      [
        s.w,
        s.lobes,
        s.asym,
        s.sharpK,
        s.uplift,
        s.compression,
        s.turb,
        s.tremor,
        s.anchor[0],
        s.anchor[1],
        s.anchor[2],
        s.phase,
        s.elong,
        s.tilt,
        s.cavity,
        s.twist,
        s.counter,
        s.flat,
        s.fold,
        s.open,
        s.petal,
        s.ripple,
        s.rise,
        s.risePh,
        s.wave,
        s.wavePh,
        s.settle,
        s.flow,
      ],
      i * SLOT_VEC4 * 4,
    );
  });
  return a;
}
function packLabs(labs: Lab[][], role: number): Float32Array {
  const a = new Float32Array(MAX_SLOTS * 3);
  labs.forEach((l, i) => a.set(l[role], i * 3));
  return a;
}
const haloColor = (lab: Lab, dark: boolean): Lab => [
  Math.min(0.92, lab[0] + (dark ? 0.02 : 0.04)),
  lab[1] * 0.9,
  lab[2] * 0.9,
];

/* ── WebGL2 ───────────────────────────────────────────────────────────── */
export interface StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  draw(frame: Frame, opts: DrawOptions): void;
  /** mesh detail (icosphere level); lower is lighter */
  detail: number;
  setDetail(level: number): void;
  dispose(): void;
}

export class GLStoneRenderer implements StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private halo: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private hu: Record<string, WebGLUniformLocation | null> = {};
  private vaoStone: WebGLVertexArrayObject;
  private vaoHalo: WebGLVertexArrayObject;
  private count = 0;
  private vb: WebGLBuffer;
  private ib: WebGLBuffer;
  detail = 0;
  lost = false;

  constructor(canvas: HTMLCanvasElement, preserve = false, detail = 5) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: false,
      preserveDrawingBuffer: preserve,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.prog = program(gl, STONE_VS, STONE_FS);
    this.halo = program(gl, HALO_VS, HALO_FS);
    for (const n of [
      'uSlot',
      'uShift',
      'uBody',
      'uBodyN',
      'uCount',
      'uG0',
      'uG1',
      'uG2',
      'uShell',
      'uPV',
      'uPalO',
      'uPalM',
      'uPalC',
      'uLook',
      'uLook2',
      'uEye',
    ])
      this.u[n] = gl.getUniformLocation(this.prog, n);
    for (const n of ['uAspect', 'uColor', 'uHalo']) this.hu[n] = gl.getUniformLocation(this.halo, n);

    this.vaoStone = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoStone);
    this.vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    const loc = gl.getAttribLocation(this.prog, 'aN');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    this.ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    this.setDetail(detail);

    this.vaoHalo = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoHalo);
    const hb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, hb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const hl = gl.getAttribLocation(this.halo, 'aP');
    gl.enableVertexAttribArray(hl);
    gl.vertexAttribPointer(hl, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  draw(fr: Frame, opts: DrawOptions): void {
    const gl = this.gl,
      u = this.u;
    if (this.lost) return;
    const W = this.canvas.width,
      H = this.canvas.height,
      dark = opts.theme === 'dark',
      zoom = opts.zoom ?? 1;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    const m = Math.min(W, H);
    gl.useProgram(this.halo);
    gl.uniform2f(this.hu.uAspect, W / m, H / m);
    const hc = oklabToLinear(haloColor(fr.haloLab, dark)).map((c) => Math.max(0, Math.min(1, c)) ** (1 / 2.2));
    gl.uniform3f(this.hu.uColor, hc[0], hc[1], hc[2]);
    gl.uniform2f(this.hu.uHalo, RENDERER.bloomStrength * (dark ? 0.55 : 0.35), screenRadius(zoom) * 1.05);
    gl.bindVertexArray(this.vaoHalo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(this.prog);
    const eye: V3 = [EYE[0] / zoom, EYE[1] / zoom, EYE[2] / zoom];
    gl.uniformMatrix4fv(u.uPV, false, new Float32Array(mul(perspective(W, H), lookAt(eye, [0, 0.03, 0]))));
    gl.uniform3fv(u.uEye, eye);
    gl.uniform4fv(u.uSlot, packSlots(fr.slots));
    gl.uniformMatrix3fv(u.uBody, false, fr.body);
    gl.uniformMatrix3fv(u.uBodyN, false, fr.bodyN);
    gl.uniform1i(u.uCount, fr.slots.length);
    gl.uniform3fv(u.uPalO, packLabs(fr.labs, 0));
    gl.uniform3fv(u.uPalM, packLabs(fr.labs, 1));
    gl.uniform3fv(u.uPalC, packLabs(fr.labs, 2));
    gl.uniform4f(u.uG0, fr.g.offset[0], fr.g.offset[1], fr.g.offset[2], fr.g.tension);
    gl.uniform4f(u.uG1, fr.g.touchDir[0], fr.g.touchDir[1], fr.g.touchDir[2], fr.g.touchAge);
    gl.uniform4f(u.uLook2, RENDERER.highlightStrength * 0.65, fr.g.tremT * 0.15, dark ? 0 : 1, 0);
    gl.bindVertexArray(this.vaoStone);
    gl.enable(gl.CULL_FACE);
    const shell = (k: number) => {
      gl.uniform4f(u.uG2, fr.g.touch, fr.g.tremT, fr.yaw, k);
      gl.uniform4f(u.uShell, fr.radii[k], fr.scale[k], SHELL_AMP[k], SHELL_PHASE[k]);
      gl.uniform3fv(u.uShift, fr.shift[k]);
      gl.uniform4f(u.uLook, RENDERER.shellOpacity[k], k, dark ? 1 : 0, fr.glow);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
    /* back faces of the two outer veils only: those of the inner layers barely show through and cost a quarter */
    gl.cullFace(gl.FRONT);
    for (let k = 3; k >= 2; k--) shell(k);
    gl.cullFace(gl.BACK);
    for (let k = 0; k < 4; k++) shell(k);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }

  setDetail(level: number): void {
    if (level === this.detail) return;
    const gl = this.gl,
      { pos, idx } = icosphere(level);
    gl.bindVertexArray(this.vaoStone);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.count = idx.length;
    this.detail = level;
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

/* ── Canvas 2D fallback ───────────────────────────────────────────────── */
/** Without WebGL2 the same field is traced as four flat silhouettes: less depth, same shape, colour and motion. */
export class Canvas2DStoneRenderer implements StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private x: CanvasRenderingContext2D | null;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    /* null when a WebGL context was already taken on this canvas and then failed: nothing can be drawn there */
    this.x = canvas.getContext('2d');
  }
  draw(fr: Frame, opts: DrawOptions): void {
    if (!this.x) return;
    const { width: W, height: H } = this.canvas,
      x = this.x,
      m = Math.min(W, H),
      dark = opts.theme === 'dark';
    const R = (screenRadius(opts.zoom ?? 1) * m) / 2;
    x.clearRect(0, 0, W, H);
    const tint = (role: number, k: number): Lab => {
      const mixed: Lab = [0, 0, 0];
      fr.slots.forEach((s, i) => fr.labs[i][role].forEach((c, j) => (mixed[j] += s.w * c)));
      return [mixed[0] - (dark ? 0 : 0.03) + k * 0.01, mixed[1], mixed[2]];
    };
    for (let k = 3; k >= 0; k--) {
      const pts = silhouette(fr.slots, fr.g, k, fr.yaw, 120, fr.body);
      const rk = R * fr.radii[k] * fr.scale[k];
      x.beginPath();
      pts.forEach(([px, py], i) => (i ? x.lineTo : x.moveTo).call(x, W / 2 + px * rk, H / 2 - py * rk));
      x.closePath();
      const g = x.createRadialGradient(W / 2 - rk * 0.15, H / 2 - rk * 0.2, rk * 0.05, W / 2, H / 2, rk * 1.1);
      g.addColorStop(0, oklabToCss(tint(2, k)));
      g.addColorStop(1, oklabToCss(tint(k > 1 ? 0 : 1, k)));
      x.globalAlpha = RENDERER.shellOpacity[k] * (k ? 0.75 : 0.6);
      x.fillStyle = g;
      x.fill();
      x.globalAlpha = 0.35;
      x.strokeStyle = oklabToCss(tint(0, k));
      x.lineWidth = Math.max(1, m / 300);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  detail = 0;
  setDetail(): void {}
  dispose(): void {}
}

/** The outline of shell k as seen by the camera, in world units (x right, y up). `body` is the frame's proportions. */
export function silhouette(
  slots: SlotFrame[],
  g: FieldGlobals,
  k: number,
  yaw: number,
  n = 96,
  body: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1],
): [number, number][] {
  const out: [number, number][] = [];
  const pitch = Math.atan2(EYE[1], EYE[2]);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    /* a direction in the plane facing the camera, turned back into the stone's own frame */
    const vx = Math.cos(a),
      vy = Math.sin(a) * cp,
      vz = -Math.sin(a) * sp;
    const d: V3 = [cy * vx - sy * vz, vy, sy * vx + cy * vz];
    const r = field(d, k, slots, g);
    const p: V3 = [d[0] * r, d[1] * r, d[2] * r];
    const b: V3 = [
      body[0] * p[0] + body[3] * p[1] + body[6] * p[2],
      body[1] * p[0] + body[4] * p[1] + body[7] * p[2],
      body[2] * p[0] + body[5] * p[1] + body[8] * p[2],
    ];
    const w: V3 = [cy * b[0] + sy * b[2], b[1], -sy * b[0] + cy * b[2]];
    out.push([w[0], w[1] * cp - w[2] * sp]);
  }
  return out;
}

export function createRenderer(canvas: HTMLCanvasElement, preserve = false, detail = 5): StoneRenderer {
  try {
    return new GLStoneRenderer(canvas, preserve, detail);
  } catch (e) {
    console.warn('emotion stone: WebGL2 unavailable, drawing in 2D', e);
    return new Canvas2DStoneRenderer(canvas);
  }
}
