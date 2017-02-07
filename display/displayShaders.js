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
attribute vec2 decenter;
attribute float spread;

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

  vec3 np;
  np.x = position.x + decenter.x * spread;
  np.y = position.y + decenter.y * spread;
  np.z = -10.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( np, 1.0 );
  gl_PointSize = size;

  v_col1 = color1;
  v_col2 = color2;
  v_noise_seed = noise_seed;
  float l = size/100.0;
  v_noise_freq = 1.0 + l * 20.0;
  v_noise_scale = 0.1 + l * 0.6;
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

  gl_FragColor = max(vec4(lum * v_col1,lum * v_fade), vec4(v_col1 * ilum * v_glow, ilum * v_fade * v_glow));

}

`

veinVertexShader = `

uniform float time;
uniform float col_freq;
uniform float death;

attribute vec2 miter;
attribute float miter_dims;

attribute float glob_line_prog; //in relation to the whole line

uniform float thickness;

varying float o_glob_line_prog;
varying float m_prog;
varying float col_mix;


float TWO_PI = 6.283185307179586;

void main()
{

	vec4 p = projectionMatrix * modelViewMatrix * vec4( position.xy, -5.0, 1.0 );
  vec4 m = projectionMatrix * modelViewMatrix * vec4( miter, 0.0, 1.0 );

  float a = max(0.01,abs(thickness/miter_dims)); //NB. this number probably needs adjusting in respect of resolution
  float flux = mix(sin(time * 2.0 - glob_line_prog * TWO_PI * 10.0), sin(glob_line_prog * TWO_PI * 10.0), death);
  a *= 0.75 + flux * 0.25;
  p.xy += m.xy  * a * sign(miter_dims);

  m_prog = sign(miter_dims);
  o_glob_line_prog = glob_line_prog;
  col_mix = 0.5 + sin(pow(1.0 - o_glob_line_prog,0.5) * TWO_PI * col_freq) * 0.5;

  gl_Position = vec4(p.xy, 0.0, 1.0);

}
`
veinFragmentShader=
`
#ifdef GL_ES
      precision highp float;
    #endif

    uniform vec3 color1;
    uniform vec3 color2;
    uniform float death;
    uniform float lineProg;

    varying float o_glob_line_prog;
    varying float m_prog;
    varying float col_mix;

    ///////////////////////////////////HELPERS///////////////////////////////////

    void main()
    {
      float width = min(
        smoothstep(0.0, 0.05, o_glob_line_prog),
        smoothstep(1.0 - lineProg , 1.05 - lineProg, 1.0 - o_glob_line_prog )
      );

      vec3 m = mix(color1, color2, col_mix);
      vec3 m2 = mix(vec3(0.25), vec3(0.1,0.1,0.1), col_mix);
      vec3 m3 = mix(m2, m, smoothstep( death, death + 0.025, o_glob_line_prog) );
      float alpha = 1.- pow(m_prog , 2.5 * width);
      gl_FragColor = vec4(m3 * alpha,alpha);

    }
`
