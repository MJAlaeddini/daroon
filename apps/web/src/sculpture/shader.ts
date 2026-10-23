/* ═════════════════════════ the living sculpture: shader ═════════════════════════ */
export const VS = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
export const FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform vec4 uPh;      // shape phase, noise phase, contour phase, clock
uniform vec4 uA;       // expansion, regularity, asymmetry, sharpness
uniform vec4 uB;       // turbulence, tension, luminosity, cohesion
uniform vec4 uC;       // diffusion, separation, drift x, drift y
uniform vec4 uD;       // open, dark, spectrum, neutral weight
uniform vec4 uS[3];    // per emotion: anchor angle, weight, local expansion, local tension
uniform vec3 uK[9];    // per emotion OKLab: glow, core, edge
uniform vec3 uN[3];    // neutral pearl OKLab
uniform vec4 uR;       // ripple x, y, age, strength
uniform vec4 uR2;      // ripple wavenumber, speed, decay
uniform vec2 uPt;
uniform float uSeed, uScale, uHalo;

vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y); }
float fbm2(vec2 p){ return 0.65 * gn(p) + 0.35 * gn(p * 2.03 + vec2(4.1, 1.7)); }
float lobe(float x, float s){ float c = 0.5 + 0.5 * cos(x); float e = 1.0 + s * 5.0; return pow(c, e) - 1.0 / (1.0 + e); }
vec3 lab2rgb(vec3 c){
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  vec3 lin = vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  lin = clamp(lin, 0.0, 1.0);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
}
float shapeR(float th, float rot, float k){
  float t = uPh.x; float amp = mix(0.24, 0.025, uA.y); float ph = uSeed * 6.2831 + k * 2.17; float sh = uA.w; float h = th + rot;
  float r = 1.0;
  r += amp * (1.0 - 0.35 * sh) * lobe(2.0 * h + t * 0.23 + ph, sh);
  r += amp * 0.8 * lobe(3.0 * h - t * 0.19 + ph * 1.37, sh);
  r += amp * (0.18 + 0.55 * uB.y + 0.5 * sh) * lobe(5.0 * h + t * 0.31 + ph * 0.61, sh);
  vec2 dr = uC.zw; float dl = length(dr); float dA = atan(dr.y, dr.x + 1e-4);
  r += uA.z * dl * (0.30 * cos(th - dA) + 0.08 * cos(2.0 * (th - dA)));
  r += uB.x * 0.12 * gn(vec2(cos(h), sin(h)) * 1.6 + vec2(k * 3.1 + uPh.y * 0.31, uPh.y * 0.23));
  for (int s = 0; s < 3; s++){
    vec4 S = uS[s];
    float w = S.y * exp((cos(th - S.x) - 1.0) * 2.4);
    r += w * S.z * 0.14;
    r += w * S.w * 0.022 * sin(th * 13.0 + uPh.z * 2.0 + float(s) * 2.1);
  }
  return r;
}
vec3 fieldLab(vec2 p, float d, float th, float R){
  float wn = uD.w + 0.001;
  float a1 = 0.5 + 0.5 * sin(th + uPh.x * 0.17 + d * 1.5);
  float a2 = 0.5 + 0.5 * sin(2.0 * th - uPh.x * 0.13 + d * 2.4 + 1.3);
  vec3 neu = mix(mix(uN[0], uN[1], a1 * smoothstep(0.0, 0.8, d)), uN[2], a2 * smoothstep(0.3, 1.05, d));
  vec3 acc = neu * wn; float ws = wn;
  float sig = (0.22 + 0.42 * uC.x) * R * 1.4;
  for (int s = 0; s < 3; s++){
    vec4 S = uS[s];
    if (S.y < 0.002) continue;
    vec2 c = R * 0.55 * vec2(cos(S.x), sin(S.x));
    vec2 q = (p - c) / sig;
    float W = S.y * (0.12 + exp(-dot(q, q)));
    vec3 g = uK[s * 3], co = uK[s * 3 + 1], e = uK[s * 3 + 2];
    acc += mix(mix(g, co, smoothstep(0.0, 0.42, d)), e, smoothstep(0.5, 1.02, d)) * W; ws += W;
  }
  return acc / ws;
}
void main(){
  float mn = min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * mn);
  float px = 2.0 / mn;
  float dark = uD.y, spec = uD.z, open = uD.x;
  vec2 rv = p - uR.xy; float rd = length(rv); float age = uR.z;
  float env = exp(-age * uR2.z) * smoothstep(0.0, 0.06, age) * uR.w;
  p += (rv / (rd + 1e-4)) * sin(rd * uR2.x - age * uR2.y) * exp(-rd * 1.8) * env * 0.02;
  float ring = exp(-pow((rd - age * 0.75) * 8.0, 2.0)) * abs(env);

  float R = uScale * (0.84 + 0.32 * uA.x) * (1.0 + 0.08 * open);
  R *= 1.0 + 0.012 * sin(uPh.w * 0.85) + 0.006 * sin(uPh.w * 0.53 + 1.0);
  vec2 ctr = uC.zw * 0.05 * uScale + vec2(0.0, 0.015 * uScale * sin(uPh.w * 0.31));
  float spread = (uC.y * (1.0 - 0.6 * uB.w) * 0.13 + max(open, 0.0) * 0.035) * uScale / 0.56;
  vec3 col = vec3(0.0); float alpha = 0.0;
  float d0 = 9.0, th0 = 0.0; vec3 lab0 = vec3(0.7, 0.0, 0.0);
  vec3 L = normalize(vec3(-0.42 + uPt.x * 0.35, 0.62 + uPt.y * 0.35, 0.78));
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));

  float far = length(p - ctr) / R;
  if (far > 1.9){ d0 = far / 1.08; th0 = atan(p.y - ctr.y, p.x - ctr.x); lab0 = fieldLab(p, 1.0, th0, R); }
  else for (int k = 0; k < 3; k++){
    float fk = float(k);
    float sc = 1.0 - fk * 0.2;
    float rot = fk * 1.05 + 0.35 * sin(uPh.x * 0.07 + fk * 1.3);
    vec2 off = ctr + spread * vec2(cos(fk * 2.3 + uPh.x * 0.11), sin(fk * 1.7 + uPh.x * 0.09)) * min(fk, 1.0) * (0.7 + 0.5 * fk);
    vec2 q = p - off;
    float th = atan(q.y, q.x);
    float rr = R * sc * shapeR(th, rot, fk);
    float d = length(q) / rr;
    if (k == 0){ d0 = d; th0 = th; lab0 = fieldLab(p, d, th, R); }
    float aa = px / rr * 1.2;
    float inside = smoothstep(1.0 + aa, 1.0 - aa, d);
    if (inside <= 0.0) continue;
    vec3 lab = lab0;
    float hr = fk * 0.14 * (1.0 + spec);
    lab.yz = mat2(cos(hr), sin(hr), -sin(hr), cos(hr)) * lab.yz;
    lab.yz *= mix(1.25, 1.3, dark) + 0.4 * spec;
    lab.x += fk * 0.05 + (uB.z - 0.5) * 0.08 + mix(-0.02, -0.05, dark);
    vec2 nxy = q / rr;
    nxy *= 1.0 + 0.2 * (0.4 + uA.w + uB.x) * sin(th * 3.0 + rot * 2.0 + d * 4.5 + uPh.x * 0.21);
    float nz = sqrt(max(0.0, 1.0 - min(dot(nxy, nxy), 1.0)));
    vec3 n = normalize(vec3(nxy, nz * 0.95 + 0.05));
    float dif = clamp(dot(n, L), 0.0, 1.0);
    float sp = pow(clamp(dot(n, Hh), 0.0, 1.0), 36.0);
    float fres = pow(1.0 - nz, 2.2);
    vec3 rgb = lab2rgb(lab);
    vec3 rimC = lab2rgb(vec3(mix(lab.x - 0.22, min(lab.x + 0.16, 0.97), dark), lab.yz * mix(1.35, 0.95, dark)));
    vec3 deep = lab2rgb(vec3(lab.x - 0.12, lab.yz * 1.2));
    rgb = mix(mix(deep, rgb, 0.5 + 0.5 * dif), rgb * (0.72 + 0.42 * dif), dark);
    rgb = mix(rgb, rimC, fres * mix(0.35, 0.45, dark));
    rgb += sp * mix(0.24, 0.3, dark);
    float a = inside * mix(0.2 + 0.5 * pow(clamp(d, 0.0, 1.0), 2.0) + 0.12 * fres, 0.16 + 0.5 * pow(clamp(d, 0.0, 1.0), 2.2) + 0.16 * fres, dark) * (1.0 - fk * 0.15);
    col = rgb * a + col * (1.0 - a);
    alpha = a + alpha * (1.0 - a);
    float ra = exp(-pow((1.0 - d) * rr / px * 0.6, 2.0)) * inside * mix(0.42, 0.34, dark) * (1.0 - fk * 0.2);
    col = rimC * ra + col * (1.0 - ra);
    alpha = ra + alpha * (1.0 - ra);
  }
  float in0 = smoothstep(1.0, 0.92, d0);
  vec3 lc = lab2rgb(vec3(mix(lab0.x - 0.3, min(lab0.x + 0.2, 0.97), dark), lab0.yz * mix(1.4, 0.55, dark)));
  if (in0 > 0.0){
    float f = d0 + 0.08 * uB.x * fbm2(p * 2.3 / uScale + vec2(uPh.y * 0.2, -uPh.y * 0.15)) + 0.022 * sin(th0 * 3.0 + uPh.z * 0.4);
    float v = f * (3.0 + 7.0 * uB.y) - uPh.z * 0.22;
    float fw = max(fwidth(v), 1e-4);
    float line = smoothstep(0.5 - fw * 1.3, 0.5 - fw * 0.2, abs(fract(v) - 0.5));
    float lm = smoothstep(0.12, 0.35, f) * in0 * (0.08 + 0.22 * uB.y);
    col = mix(col, lc * alpha, line * lm);
    float K = min(95.0, mn * 0.16);
    vec2 c1 = vec2(0.035, 0.02) * (1.0 + uC.y * 2.5) * uScale / 0.56;
    float m = sin(length(p - c1) * K - uPh.z * 0.5) * sin(length(p + c1) * K + uPh.z * 0.35);
    float mi = pow(0.5 + 0.5 * m, 7.0) * smoothstep(0.95, 0.5, d0) * 0.13 * uC.y;
    vec3 iri = 0.5 + 0.5 * cos(6.2831 * (d0 * 1.2 + th0 * 0.159 + uPh.x * 0.02 + vec3(0.0, 0.33, 0.67)));
    col += mix(lc, iri, 0.35 + 0.4 * spec) * mi * alpha * mix(0.6, 1.0, dark);
  }
  float in1 = smoothstep(1.02, 0.98, d0);
  vec2 gc = uC.zw * 0.25 * R + uPt * 0.08 * R + vec2(-0.12, 0.16) * R;
  float gl = exp(-dot(p - gc, p - gc) / (R * R * 0.22));
  vec3 glc = lab2rgb(vec3(min(lab0.x + 0.2, 0.97), lab0.yz * 1.2));
  col += glc * gl * in1 * (0.10 + 0.32 * uB.z) * mix(0.4, 1.0, dark);
  float edge0 = exp(-pow((1.0 - d0) * 5.0, 2.0)) * in1;
  vec3 iri2 = 0.5 + 0.5 * cos(6.2831 * (th0 * 0.159 + uPh.x * 0.03 + vec3(0.0, 0.33, 0.67)));
  col += iri2 * edge0 * (0.03 + 0.12 * spec) * alpha * dark;
  col += glc * ring * 0.35 * smoothstep(1.05, 0.8, d0);
  float hd = max(d0 - 1.0, 0.0);
  float halo = exp(-hd * hd * 7.0) * (1.0 - in1) * uHalo * (0.08 + 0.18 * uB.z) * (1.0 + 0.6 * spec);
  vec3 hc = lab2rgb(vec3(mix(0.88, 0.70, dark), lab0.yz * mix(1.6, 1.1, dark)));
  col += hc * halo * mix(0.9, 1.2, dark);
  alpha += halo * mix(0.9, 0.5, dark) * (1.0 - alpha);
  vec2 sp2 = (p - vec2(ctr.x, ctr.y - R * 1.14)) / vec2(R * 0.8, R * 0.11);
  float shd = exp(-dot(sp2, sp2)) * (1.0 - dark) * 0.09 * uHalo;
  col += lab2rgb(vec3(lab0.x - 0.3, lab0.yz * 0.9)) * shd * (1.0 - alpha);
  alpha += shd * (1.0 - alpha);
  float gr = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uPh.w * 7.0) * 43758.5453) - 0.5;
  col += gr * 0.012 * alpha;
  float em = smoothstep(0.99, 0.7, length(p));
  col = max(col, 0.0) * em; alpha *= em;
  alpha = clamp(max(alpha, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  fragColor = vec4(min(col, vec3(alpha)), alpha);
}`;
