import { FS, VS } from './shader';
import { shapeJ } from '../ui/glyph';

export class GLRenderer {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  pr: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
  lost: boolean;
  constructor(canvas: HTMLCanvasElement, preserve = false) {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: preserve,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.canvas = canvas;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    ['uRes', 'uPh', 'uA', 'uB', 'uC', 'uD', 'uS', 'uK', 'uN', 'uR', 'uR2', 'uPt', 'uSeed', 'uScale', 'uHalo'].forEach(
      (n) => (this.u[n] = gl.getUniformLocation(pr, n)),
    );
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }
  draw(U) {
    const gl = this.gl,
      u = this.u;
    if (this.lost) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform4fv(u.uPh, U.ph);
    gl.uniform4fv(u.uA, U.A);
    gl.uniform4fv(u.uB, U.B);
    gl.uniform4fv(u.uC, U.C);
    gl.uniform4fv(u.uD, U.D);
    gl.uniform4fv(u.uS, U.S);
    gl.uniform3fv(u.uK, U.K);
    gl.uniform3fv(u.uN, U.N);
    gl.uniform4fv(u.uR, U.R);
    gl.uniform4fv(u.uR2, U.R2);
    gl.uniform2fv(u.uPt, U.pt);
    gl.uniform1f(u.uSeed, U.seed);
    gl.uniform1f(u.uScale, U.scale);
    gl.uniform1f(u.uHalo, U.halo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
/* fallback when WebGL2 is unavailable: same form language drawn with Canvas 2D */
export class Ctx2DRenderer {
  canvas: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.x = canvas.getContext('2d');
  }
  draw(U) {
    const c = this.canvas,
      x = this.x,
      W = c.width,
      H = c.height,
      mn = Math.min(W, H),
      cx = W / 2,
      cy = H / 2;
    x.clearRect(0, 0, W, H);
    const P = U.P,
      R = (U.scale * (0.84 + 0.32 * P.exp) * mn) / 2,
      t = U.ph[0],
      dark = U.D[1] > 0.5;
    const pal = U.mainPal;
    for (let k = 0; k < 4; k++) {
      const sc = 1 - k * 0.16,
        off = ((P.sep * (1 - 0.6 * P.coh) * 0.12 * mn) / 2) * Math.min(k, 1);
      const ox = cx + off * Math.cos(k * 2.3 + t * 0.11),
        oy = cy - off * Math.sin(k * 1.7 + t * 0.09);
      x.beginPath();
      for (let i = 0; i <= 96; i++) {
        const th = (i / 96) * Math.PI * 2,
          r = R * sc * shapeJ(th, P, U.seed, k, t, k * 0.63);
        const px = ox + r * Math.cos(th),
          py = oy - r * Math.sin(th);
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath();
      const g = x.createRadialGradient(ox - R * 0.2, oy - R * 0.25, R * 0.05, ox, oy, R * sc * 1.1);
      g.addColorStop(0, pal[0]);
      g.addColorStop(0.6, pal[1]);
      g.addColorStop(1, pal[2]);
      x.globalAlpha = 0.34 - k * 0.04;
      x.fillStyle = g;
      x.fill();
      x.globalAlpha = dark ? 0.35 : 0.25;
      x.strokeStyle = dark ? '#ffffff' : pal[2];
      x.lineWidth = Math.max(1, mn / 260);
      x.stroke();
    }
    x.globalAlpha = 0.18;
    x.strokeStyle = dark ? '#ffffff' : pal[2];
    for (let j = 1; j < 7; j++) {
      x.beginPath();
      for (let i = 0; i <= 72; i++) {
        const th = (i / 72) * Math.PI * 2,
          r = R * (j / 7) * shapeJ(th, P, U.seed, 0, t, 0);
        const px = cx + r * Math.cos(th),
          py = cy - r * Math.sin(th);
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    }
    x.globalAlpha = 1;
  }
}
