splatVertexShader = `

uniform vec2 resolution;
uniform float scale;
uniform float time;

attribute float noise_seed;
attribute vec3 color1;
attribute vec3 color2;
attribute float size;
attribute float fade;
attribute float freq;
attribute float glowFactor;
attribute float glowWave;

varying vec3 v_col1;
varying vec3 v_col2;
varying float v_noise_seed;
varying float v_noise_freq;
varying float v_noise_scale;
varying float v_fade;
varying float v_darken;
varying float v_glow;


// varying float gfactor;

float PI  = 3.141592653589793;
float TWO_PI = 6.283185307179586;

void main()	{

  gl_Position = vec4(position.x, position.y, 0.0, 1.0 );
  gl_PointSize = size;

  v_col1 = color1;
  v_col2 = color2;
  v_noise_seed = noise_seed;
  float l = size/200.0;
  v_noise_freq = 1.0 + l * 20.0;
  v_noise_scale = 0.1 + l * 0.4;
  v_fade = fade;
  v_darken = 1.0 - noise_seed * 0.25;
  float flicker = 0.9 + sin(time * 60. * v_darken) * 0.1;
  v_glow = max(0.0, glowWave * 5.0 - noise_seed) * flicker;
}

`

splatFragmentShader = `
#ifdef GL_ES
  precision highp float;
#endif

uniform float time;

varying vec3 v_col1;
varying vec3 v_col2;
varying float v_noise_seed;
varying float v_noise_freq;
varying float v_noise_scale;
varying float v_fade;
varying float v_glow;
varying float v_darken;

///////////////////////////////////NOISE FUNCTIONS///////////////////////////////////

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(in vec3 p){
  vec3 a = floor(p);
  vec3 d = p - a;
  d = d * d * (3.0 - 2.0 * d);

  vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
  vec4 k1 = perm(b.xyxy);
  vec4 k2 = perm(k1.xyxy + b.zzww);

  vec4 c = k2 + a.zzzz;
  vec4 k3 = perm(c);
  vec4 k4 = perm(c + 1.0);

  vec4 o1 = fract(k3 * (1.0 / 41.0));
  vec4 o2 = fract(k4 * (1.0 / 41.0));

  vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
  vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

  return o4.y * d.y + o4.x * (1.0 - d.y);
}

void main()
{
  if(v_fade < 0.01)discard;

  vec2 pos = gl_PointCoord - .5;
  float theta = atan(pos.x, pos.y);

  float n = noise(vec3(cos(theta) * v_noise_freq, sin(theta) * v_noise_freq, v_noise_seed)) * v_noise_scale;
  float lum = length(pos * 4.0) - n;
  float ilum = max(0.0, 1.0 - length(pos * 2.0));
  ilum = pow(ilum, 3.0);
  lum = smoothstep(1.0, 0.95, lum);

  //ilum = smoothstep(1.0, 0.0, ilum);

  gl_FragColor = vec4(lum * v_col2 * v_darken,lum * v_fade) + vec4(v_col1 * ilum * v_glow, ilum * v_fade * v_glow);
}

`
