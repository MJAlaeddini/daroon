/* Shaders for the emotion stone. The vertex shader is a port of field.ts: keep the two in step. */

/** vec4s per slot in uSlot; see packSlots in renderer.ts for the layout. */
export const SLOT_VEC4 = 7;

export const STONE_VS = /* glsl */ `#version 300 es
precision highp float;
in vec3 aN;
uniform vec4 uSlot[${6 * SLOT_VEC4}];
uniform int uCount;
uniform vec4 uG0;    // offset.xyz, tension
uniform vec4 uG1;    // touchDir.xyz, touchAge
uniform vec4 uG2;    // touch, tremT, yaw, shell index
uniform vec4 uShell; // base radius, scale, amplitude, shell phase
uniform vec3 uShift; // this shell's offset from the centre
uniform mat3 uBody;  // the body's proportions (symmetric)
uniform mat3 uBodyN; // its inverse, for normals
uniform mat4 uPV;
out vec3 vN;
out vec3 vP;
out vec4 vMuA;
out vec2 vMuB;
out float vF;

#define S(i, j) uSlot[(i) * ${SLOT_VEC4} + (j)]

float tn(vec3 p) {
  return sin(p.x + 1.3 * sin(p.y * 1.17 + 0.5)) * sin(p.y * 1.07 + 1.3 * sin(p.z * 1.31 + 1.7))
    * sin(p.z * 0.93 + 1.3 * sin(p.x * 1.23 + 2.9));
}
float fbm(vec3 p) { return tn(p) + 0.5 * tn(p * 2.03 + vec3(7.1, 1.3, 4.7)); }
float sstep(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }

void masks(vec3 n, out float mu[6]) {
  vec3 o = uG0.xyz;
  vec3 p = n * 1.9 + o;
  vec3 w = normalize(n + 0.45 * vec3(tn(p), tn(p + 3.1), tn(p + 6.2)));
  /* loops run to uCount, not 6, so compilers keep them as loops: a much smaller shader, faster to compile */
  float s = 0.0;
  for (int i = 0; i < 6; i++) mu[i] = 0.0;
  for (int i = 0; i < uCount; i++) {
    mu[i] = S(i, 0).x * exp(3.2 * (dot(w, S(i, 2).xyz) - 1.0));
    s += mu[i];
  }
  s = max(s, 1e-6);
  float t = 0.0;
  for (int i = 0; i < uCount; i++) {
    float wi = S(i, 0).x, q = sstep(0.0, 0.15, wi);
    mu[i] = q * mu[i] / s + (1.0 - q) * wi;
    t += mu[i];
  }
  t = max(t, 1e-6);
  for (int i = 0; i < uCount; i++) mu[i] /= t;
}

float gpart(vec3 n, int i) {
  vec4 s1 = S(i, 1), s2 = S(i, 2), s3 = S(i, 3), s4 = S(i, 4), s5 = S(i, 5), s6 = S(i, 6);
  float y = n.y;
  float r = sqrt(max(1e-6, 1.0 - y * y));
  float U = s1.x, aU = abs(U), sU = U >= 0.0 ? 1.0 : -1.0;
  float G = 0.26 * aU * exp(-pow(y - 0.62 * sU, 2.0) / 0.2) - 0.06 * aU;
  G -= 0.08 * max(0.0, -U) * sstep(0.3, 1.0, y);
  G -= s1.y * (0.2 * exp(-pow(y + 0.3, 2.0) / 0.1) * r + 0.04);
  G += s4.y * (0.09 * r * r - 0.17 * y * y);
  float d = n.x * sin(s3.y) + y * cos(s3.y);
  G += s3.x * (0.26 * d * d - 0.09);
  if (s3.z > 0.0) {
    vec3 a = s2.xyz;
    vec3 c = normalize(vec3(0.6 * a.x, 0.15 + 0.3 * a.y, 1.0));
    vec3 c2 = normalize(c + vec3(0.3, 0.12, 0.0));
    float d1 = 1.0 - dot(n, c), d2 = 1.0 - dot(n, c2);
    G -= s3.z * 0.32 * exp(-d1 / 0.22) * (1.0 - 0.85 * exp(-d2 / 0.07));
  }
  G += s4.w * (0.07 * exp(-pow(y - 0.68, 2.0) / 0.03) - 0.14 * exp(-(1.0 - y) / 0.1));
  G += s5.z * 0.035 * sin(5.0 * y - s5.w) * r;
  float az = atan(n.z, n.x);
  G += s6.x * 0.035 * sin(2.0 * az + 1.4 * sin(s6.y)) * r;
  G += s6.z * -0.03 * y;
  return G;
}

float lpart(vec3 n, int i, float sp) {
  vec4 s0 = S(i, 0), s1 = S(i, 1), s2 = S(i, 2), s3 = S(i, 3), s4 = S(i, 4), s5 = S(i, 5), s6 = S(i, 6);
  vec3 o = uG0.xyz;
  float y = n.y;
  float r = sqrt(max(1e-6, 1.0 - y * y));
  float az = atan(n.z, n.x);
  float el = asin(clamp(y, -1.0, 1.0));
  float th = s0.y * az + (1.7 + 0.35 * s0.y) * el + s3.w * 2.2 * y + s4.x * tanh(3.0 * y) + s2.w + sp * (1.0 + s0.z);
  th += s0.z * 1.4 * tn(n * 1.3 + o);
  float sn = sin(th);
  float tri = asin(s0.w * sn) / asin(s0.w);
  float pf = pow(r, 1.5);
  pf *= 1.0 + s5.x * (1.6 * sstep(-0.35, 0.75, y) - 1.0);
  vec3 ad = normalize(vec3(-s2.z, 0.3, s2.x));
  float am = 1.0 + s0.z * 0.8 * dot(n, ad);
  float amp = 0.15 / (1.0 + 0.07 * s0.y);
  float L = amp * am * pf * tri;
  float y2 = -n.z, r2 = sqrt(max(1e-6, 1.0 - y2 * y2));
  float th2 = (floor(s0.y / 2.0) + 1.0) * atan(y, n.x) - 1.3 * asin(clamp(y2, -1.0, 1.0)) + 0.7 * s2.w + 2.1;
  L += 0.45 * amp * am * sin(th2) * pow(r2, 1.2);
  L -= s4.z * 0.1 * pow(max(0.0, -sn), 3.0) * pf;
  float f = s6.w;
  L += s5.y * 0.03 * (tn(vec3(n.x * 6.5 + f, n.y * 6.5 - f, n.z * 6.5 + o.z))
    + 0.5 * tn(vec3(n.x * 11.0 - f, n.y * 11.0 + o.y, n.z * 11.0 + f)));
  L += s1.z * 0.11 * fbm(vec3(n.x * 1.6 + o.x + 0.25 * f, n.y * 1.6 + o.y, n.z * 1.6 + o.z - 0.25 * f));
  float tt = uG2.y;
  L += s1.w * tn(vec3(n.x * 5.0 + tt, n.y * 5.0 - tt * 0.7, n.z * 5.0 + tt * 0.4));
  return L;
}

const float TURN[4] = float[4](0.0, 0.45, -0.35, 0.7);
vec3 turn(vec3 n) {
  float a = TURN[int(uG2.w + 0.5)];
  vec3 u = normalize(vec3(0.57, 0.7, 0.43));
  float c = cos(a), s = sin(a);
  return n * c + cross(u, n) * s + u * dot(u, n) * (1.0 - c);
}

/* the field for given masks; the two nearby samples taken for the normal reuse the centre's masks */
float fieldMu(vec3 n, float mu[6]) {
  vec3 o = uG0.xyz;
  float F = 0.055 * fbm(n * 1.1 + o);
  float s2 = 0.0;
  vec3 nk = turn(n);
  for (int i = 0; i < uCount; i++) {
    float w = S(i, 0).x;
    F += uShell.z * ((0.4 * w + 0.6 * mu[i]) * gpart(n, i) + (0.15 * w + 0.85 * mu[i]) * lpart(nk, i, uShell.w));
    s2 += mu[i] * mu[i];
  }
  float seam = 1.0 - s2;
  F += uG0.w * seam * (-0.035 + 0.012 * sin(18.0 * (n.x * 0.6 + n.y * 0.8) + o.x));
  if (uG2.x > 0.0) {
    float a = acos(clamp(dot(n, uG1.xyz), -1.0, 1.0));
    F += uG2.x * 0.03 * (1.0 - exp(-12.0 * uG1.w)) * exp(-2.5 * uG1.w) * sin(10.0 * a - 18.0 * uG1.w) * exp(-1.5 * a);
  }
  return 0.995 + 0.275 * tanh((1.0 + F - 0.995) / 0.275);
}
float field(vec3 n, out float mu[6]) {
  masks(n, mu);
  return fieldMu(n, mu);
}

void main() {
  vec3 n = normalize(aN);
  float mu[6];
  float R = field(n, mu);
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  const float e = 0.006;
  vec3 n1 = normalize(n + e * t1), n2 = normalize(n + e * t2);
  vec3 p0 = n * R, p1 = n1 * fieldMu(n1, mu), p2 = n2 * fieldMu(n2, mu);
  vec3 N = normalize(cross(p1 - p0, p2 - p0));
  if (dot(N, n) < 0.0) N = -N;
  float cy = cos(uG2.z), sy = sin(uG2.z);
  mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  vec3 P = ry * (uBody * (p0 * uShell.x * uShell.y) + uShift);
  vN = ry * normalize(uBodyN * N);
  vP = P;
  vMuA = vec4(mu[0], mu[1], mu[2], mu[3]);
  vMuB = vec2(mu[4], mu[5]);
  vF = R;
  gl_Position = uPV * vec4(P, 1.0);
}`;

export const STONE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec3 vN;
in vec3 vP;
in vec4 vMuA;
in vec2 vMuB;
in float vF;
uniform vec3 uPalO[6];
uniform vec3 uPalM[6];
uniform vec3 uPalC[6];
uniform int uCount;
uniform vec4 uLook;  // opacity, shell index, dark (1/0), glow
uniform vec4 uLook2; // highlight, silk phase, light-theme density, 0
uniform vec3 uEye;
out vec4 outColor;

vec3 oklab2lin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.291485548 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
vec3 lin2srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  float mu[6] = float[6](vMuA.x, vMuA.y, vMuA.z, vMuA.w, vMuB.x, vMuB.y);
  bool front = gl_FrontFacing;
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vP);
  if (!front) N = -N;
  float c = clamp(abs(dot(N, V)), 0.0, 1.0);
  float f = 1.0 - c;
  int k = int(uLook.y + 0.5);
  bool dark = uLook.z > 0.5;

  /* each feeling colours its own region; roles move from a warm core to cool, quiet outer veils */
  vec3 lab = vec3(0.0);
  vec3 coreLab = vec3(0.0);
  float s = 0.0;
  for (int i = 0; i < uCount; i++) {
    vec3 O = uPalO[i], M = uPalM[i], C = uPalC[i];
    vec3 role;
    if (k == 0) role = mix(C, M, 0.15 + 0.55 * f);
    else if (k == 1) role = mix(mix(M, C, 0.45), M, f);
    else if (k == 2) role = mix(M, O, 0.35 + 0.5 * f);
    else role = mix(O, M, 0.35 * (1.0 - f));
    lab += mu[i] * role;
    coreLab += mu[i] * C;
    s += mu[i];
  }
  lab /= max(s, 1e-4);
  coreLab /= max(s, 1e-4);
  if (!dark) lab.x -= 0.04 * uLook2.z;

  vec3 L = normalize(vec3(-0.45, 0.8, 0.55));
  float diff = 0.66 + 0.34 * max(dot(N, L), 0.0);
  vec3 col = oklab2lin(lab) * diff * (0.92 + 0.1 * N.y);
  vec3 coreCol = oklab2lin(coreLab + vec3(dark ? 0.1 : 0.02, 0.0, 0.0));
  float lum = dark ? 1.0 : 0.45;
  float base = uLook.x;
  float a;
  float rimK = 1.0;

  if (k == 0) {
    /* the core is light, not a surface: densest and brightest where it faces you, dissolving toward its edge */
    float glow = pow(c, 1.6);
    col = oklab2lin(lab) * mix(1.0, diff, 0.35);
    col = mix(col, coreCol, 0.65 * glow) + coreCol * (0.26 + 2.2 * uLook.w) * glow * lum;
    a = base * (0.12 + 0.62 * glow);
    rimK = 0.25;
  } else {
    /* veils: almost clear where they face you, gathering colour toward their edges; the inner light warms them */
    col = mix(col, coreCol, 0.22 * pow(c, 2.0) * float(4 - k) / 3.0);
    a = base * mix(0.16, 1.0, pow(f, 1.5));
    /* fine lines that run along each veil, like the edges of folded silk */
    vec3 q = vP * 2.2 + vec3(uLook2.y, 0.0, -uLook2.y);
    float flow = 18.0 * f + 2.4 * (sin(q.x + 1.3 * sin(q.y)) + sin(q.y * 1.3 + 1.1 * sin(q.z)));
    float silk = pow(0.5 + 0.5 * sin(flow), 10.0) * smoothstep(0.15, 0.6, f);
    a += base * 0.9 * silk;
    col = mix(col, oklab2lin(lab + vec3(dark ? 0.14 : -0.08, 0.0, 0.0)), 0.6 * silk);
  }
  if (!front) { a *= 0.55; col *= 0.85; }
  if (!dark) a = min(1.0, a * (1.0 + 0.3 * uLook2.z));

  /* a thin rim, never a band: light on a dark ground, a slightly deeper tone on a light one */
  float rim = pow(f, 6.0) * (front ? 1.0 : 0.5) * rimK;
  vec3 rimLab = lab + vec3(dark ? 0.16 : -0.12, 0.0, 0.0);
  col = mix(col, oklab2lin(rimLab), clamp(rim * 0.6, 0.0, 1.0));
  a = clamp(a + rim * (dark ? 0.14 : 0.12), 0.0, 1.0);

  vec3 rgb = lin2srgb(col) * a;
  if (front && k >= 2) {
    vec3 H = normalize(L + V);
    rgb += vec3(pow(max(dot(N, H), 0.0), 48.0) * uLook2.x * (dark ? 0.5 : 0.35));
  }
  outColor = vec4(rgb, a);
}`;

/* A soft light behind the stone and a faint glow beneath it, kept small (the brief asks for very little bloom). */
export const HALO_VS = /* glsl */ `#version 300 es
in vec2 aP;
out vec2 vUv;
void main() { vUv = aP; gl_Position = vec4(aP, 0.0, 1.0); }`;

export const HALO_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uAspect;  // x/min, y/min
uniform vec3 uColor;   // sRGB
uniform vec2 uHalo;    // strength, radius (in units of the stone's radius on screen)
out vec4 outColor;
void main() {
  vec2 p = vUv * uAspect;
  float d = length(p) / uHalo.y;
  float a = uHalo.x * exp(-d * d * 2.2);
  vec2 q = (p - vec2(0.0, -0.62 * uHalo.y)) / vec2(0.55, 0.16) / uHalo.y;
  a += uHalo.x * 0.5 * exp(-dot(q, q));
  a = min(a, 1.0);
  outColor = vec4(uColor * a, a);
}`;
