/* The stone shader: one full-screen pass.
 *
 * For a pixel p (units: half the shorter side, so the stone's art spans −1..1):
 *  1. motion: p is displaced by the weighted sum of the stones' motion primitives (choreo.ts);
 *  2. outline: the combination's outline R(θ) is a soft maximum of the stones' own outlines,
 *     (Σ wᵢ·rᵢ(θ − turnᵢ)³)^⅓, so points and tips survive a mix instead of being averaged away;
 *  3. each stone's art is sampled at the same relative depth ρ = |p|/R(θ) inside its own outline, so every stone
 *     is fitted into the shared outline (a single stone maps exactly onto its own art);
 *  4. layers: each stone owns a soft band of depth (envelope to core), with gently wavy boundaries;
 *  5. colour: on a dark ground the light is added as is; on a light ground it becomes tinted glass. */

export const STONE_VS = /* glsl */ `#version 300 es
in vec2 aP;
void main() { gl_Position = vec4(aP, 0.0, 1.0); }`;

export const STONE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uZoom;
uniform sampler2D uT0;
uniform sampler2D uT1;
uniform sampler2D uT2;
uniform sampler2D uT3;
uniform sampler2D uT4;
uniform sampler2D uT5;
uniform sampler2D uOutline; // 256 × rows, one outline per row
uniform float uRows;
uniform int uN;
uniform vec4 uA[6];  // weight, band, turn, outline row
uniform vec4 uB[6];  // art centre xy, desaturation, 0
uniform vec4 uM0[6]; // scale, inner, swirl, counter
uniform vec4 uM1[6]; // rise, sway, sway phase, ripple
uniform vec4 uM2[6]; // ripple phase, tremor, tremor phase, glow
uniform float uWobble;
uniform int uDark;
out vec4 outColor;

const float TAU = 6.28318530718;

vec3 art(int i, vec2 uv) {
  if (i == 0) return texture(uT0, uv).rgb;
  if (i == 1) return texture(uT1, uv).rgb;
  if (i == 2) return texture(uT2, uv).rgb;
  if (i == 3) return texture(uT3, uv).rgb;
  if (i == 4) return texture(uT4, uv).rgb;
  return texture(uT5, uv).rgb;
}
float outline(int i, float a) {
  return texture(uOutline, vec2(a / TAU, (uA[i].w + 0.5) / uRows)).r;
}
float outlineMix(float th) {
  float s = 0.0;
  for (int i = 0; i < uN; i++) {
    float r = outline(i, th - uA[i].z);
    s += uA[i].x * r * r * r;
  }
  return pow(max(s, 1e-6), 1.0 / 3.0);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y)) / uZoom;

  /* 1. motion */
  float R0 = outlineMix(atan(p.y, p.x));
  float rho0 = length(p) / R0;
  float k = pow(1.0 - min(rho0, 1.0), 2.0);
  float scale = 0.0, swirl = 0.0, rise = 0.0, glow = 0.0, ripple = 0.0;
  float sway = 0.0;
  vec2 shiver = vec2(0.0);
  for (int i = 0; i < uN; i++) {
    float w = uA[i].x;
    vec4 m0 = uM0[i], m1 = uM1[i], m2 = uM2[i];
    scale += w * (m0.x + m0.y * k);
    swirl += w * (m0.z * k + m0.w * (1.0 - 2.0 * smoothstep(0.3, 0.75, rho0)));
    rise += w * m1.x * k;
    sway += w * m1.y * sin(m1.z - 2.6 * p.y) * smoothstep(-0.7, 0.8, p.y);
    ripple += w * m1.w * sin(16.0 * rho0 - m2.x);
    shiver += w * m2.y * vec2(sin(m2.z + p.y * 9.0), cos(1.3 * m2.z + p.x * 9.0));
    glow += w * m2.w;
  }
  vec2 q = p / (1.0 + scale);
  float cs = cos(-swirl), sn = sin(-swirl);
  q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  q.y -= rise;
  q.x -= sway;
  q *= 1.0 + ripple;
  q += shiver;

  /* 2–4. outline, depth, layers */
  float th = atan(q.y, q.x);
  float R = outlineMix(th);
  float rho = length(q) / R;
  float rb = rho + 0.06 * sin(2.0 * th + uWobble) + 0.04 * sin(3.0 * th - 1.7 * uWobble);
  vec3 light = vec3(0.0);
  float msum = 0.0;
  for (int i = 0; i < uN; i++) {
    float g = uA[i].x * exp(-pow((rb - uA[i].y) / 0.3, 2.0)) + 1e-5 * uA[i].x;
    float phi = th - uA[i].z;
    vec2 src = uB[i].xy + vec2(cos(phi), sin(phi)) * rho * outline(i, phi);
    vec3 c = art(i, vec2(src.x * 0.5 + 0.5, 0.5 - src.y * 0.5));
    c = mix(c, vec3(dot(c, vec3(0.3, 0.45, 0.25))), uB[i].z);
    light += g * c;
    msum += g;
  }
  light /= max(msum, 1e-6);
  light *= 1.0 + glow * pow(1.0 - min(rho, 1.0), 1.5);

  /* 5. ground */
  float lum = max(max(light.r, light.g), light.b);
  if (uDark == 1) {
    outColor = vec4(min(light, vec3(1.0)), min(lum, 1.0));
  } else {
    /* the light ground ("jewel"): the hue of the light at full brightness, never a dark grey, with an alpha from how
       much light there is; a soft shadow below lifts it off the page */
    vec3 hue = light / max(lum, 1e-4);
    float a = pow(smoothstep(0.03, 0.75, lum), 0.7);
    a *= smoothstep(1.45, 1.05, rho);
    vec3 col = pow(hue, vec3(1.25)) * vec3(0.96, 0.92, 0.96);
    vec2 sp = p - vec2(0.0, -0.075);
    float rs = length(sp) / R0; /* the outline at p's angle: close enough for a blur this soft */
    float sh = 0.22 * (1.0 - smoothstep(0.55, 1.3, rs));
    vec3 shCol = vec3(0.235, 0.157, 0.353);
    outColor = vec4(col * a + shCol * sh * (1.0 - a), a + sh * (1.0 - a));
  }
}`;
