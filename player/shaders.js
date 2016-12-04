blobVertexShader = `
  void main()	{
    gl_Position = vec4( vec3(position.x, position.y, -0.9), 1.0 );
  }
`;


blobFragmentShader = `

#ifdef GL_ES
precision highp float;
#endif

uniform vec2 resolution;
uniform float time; // not needed
uniform vec2 mouse;
uniform float scale;

uniform float c_time;
uniform float o_time;
uniform float r_time;

uniform float shake;

//Blob characteristics

uniform float seed; //for hashable functions

uniform float slices; //theta wise repeat (outer only)
uniform float segments; //rho wise repeat
uniform float c_size; //proportional size of center
uniform float c_scale;

uniform float o_amp; //amp of noise
uniform float c_amp;
uniform float r_amp;

uniform float edge_freq;
uniform float edge_amp;

//o is symmetrical noise
uniform float o_step; //how much to step through initially
uniform float o_freq; //how much of the noise to scrub through on a cycle
uniform vec2 o_distort; //distortion of the acceleration through the noise

uniform float cell_detail; //how to spread the cells
uniform float theta_warp;

uniform vec3 bg_color;
uniform vec3 fg_color;
uniform vec3 hl_color;

uniform float fg_pow;
uniform float hl_pow;
uniform float hl_mul;

uniform float cell_detune;
uniform float c_fade;




float PI  = 3.141592653589793;
float TWO_PI = 6.283185307179586;

///////////////////////////////////HELPERS///////////////////////////////////

mat2 rotate2d(float _angle){
  return mat2(cos(_angle),-sin(_angle),
  sin(_angle),cos(_angle));
}

float hash(float x)
{
  return fract(sin(x * 12341.3784)*43758.5453123);
}



///////////////////////////////////TEXTURE FUNCTIONS//////////////////////////////////////

float drawShape(in vec2 p){

  // NB. Might interesting to play with shapes here ?
  // Wrappable circle distance. The squared distance, to be more precise.
  p = fract(p) - 0.5;
  return dot(p, p);

}

float cellTex(in vec2 p){


  float c = 1.0; // Set the maximum, bearing in mind that it is multiplied by 4.
  // Draw four overlapping shapes (circles, in this case) using the darken blend
  // at various positions on the tile

  for(int i = 0; i < 4; i++)
  {

    float r1 = -1.0 * hash(float(i) + seed) * 2.0;
    float r2 = -1.0 + hash(float(i) + seed * 2.) * 2.0;
    vec2 v = vec2(0.5 + float(i) * .25, 0.5 );
    vec2 d = vec2(r1 * cell_detune * .25, r2 * cell_detune * .25);
    float l = drawShape(p - v + d);
    c = min(c, l + float(i) * cell_detail * 0.05);

  }

  for(int i = 0; i < 4; i++)
  {
    float r1 = -1.0 * hash(float(i) + seed * 1.1) * 2.0;
    float r2 = -1.0 + hash(float(i) + seed * 2.1) * 2.0;
    vec2 v = vec2(.25 + .5 * mod(float(i),2.), .25 + .5 * floor(float(i)/2.) );
    vec2 d = vec2(r1 * cell_detune, r2 * cell_detune);
    float l = drawShape(vec2(p - v + d) * (1.25 + 0.25 * hash(seed) ) );
    c = min(c, l + float(i + 4) * cell_detail * 0.05);

  }


  return sqrt(c*4.);

}

vec3 tex2D(vec2 p){

  //calculate luminocities

  float fgl = pow(clamp(cellTex(p), 0., 1.), fg_pow);
  float hll =  dot(sin(p * hl_mul - sin(p.yx * hl_mul + fgl * hl_mul * 1.5)), vec2(.5))* hl_pow + hl_pow;

  vec3 c_mix = mix(bg_color, hl_color, hll);
  return mix(c_mix,fg_color, fgl);

}

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




void main()	{


  //generate normalised coordinates
  float hs = shake/2.;
  float sc_wobble = ((1.- hs) + hash(time) * shake);

  vec2 trans = vec2(2.0, resolution.y * 2.0/ resolution.x)  * sc_wobble * scale;

  vec2 pos = ( gl_FragCoord.xy / resolution.xy ) - 0.5;
  pos *= trans;

  pos += vec2(-hs + hash(time + 10.) * shake, -hs + hash(time + 20.) * shake);

  vec2 center = vec2(0.);

  //FOR DEBUGGING WITH MOUSE
  /*
  vec2 mouseP = mouse - .5;
  mouseP *= trans;
  mouseP.y *= -1.;

  float cp = 1.0 - step(0.02, distance(pos , mouseP));
  float mp = 1.0 - step(0.02, distance(pos , center));
  vec3 markers = vec3(0., cp,  0.) + vec3(mp,0., 0.);

  */

  //rotate the coordinate space around the center
  pos = rotate2d(PI/2.) * pos;

  //get polar coordinates
  float theta = atan(pos.y, pos.x);
  float rho = distance(pos, center);

  //unsigned angle for symmetry
  float ustheta = abs(theta / TWO_PI);
  float ustheta2 = pow(ustheta, theta_warp); //a bit of shaping to squash towards the bottom

  float n_rho = clamp(rho, 0., 1.); //clamp the rho

  float right_field = min( 0., cos(theta + PI/2.0)); // a distance field on the right only

  float asymmetry = .5;

  vec2 move = (vec2(sin(o_time), cos(o_time)) + 1.)/2.;
  move.x = pow(move.x, o_distort.x); // a time delay for the right hand side
  move.y = pow(move.y, o_distort.y);
  move = move * o_freq;
  move.x += right_field * asymmetry;


  float o_noise = noise(vec3(ustheta2 * o_step + move.x , ustheta2 * o_step + move.y , seed)); //symmetrical noise
  float r_noise = noise(vec3(cos(theta) + r_time, sin(theta) + r_time, 10.));
  float o_edge = 0.7 + o_amp * 0.3 * o_noise + r_amp * 0.3 * r_noise;
  o_edge -= sin(ustheta * PI * edge_freq)  * edge_amp;
  float o_lum =  1.0 - smoothstep(o_edge - 0.1, o_edge , n_rho);

  if(o_lum < 0.01)discard; // not in the shape

  float c_noise = noise(vec3(cos(theta) + c_time, sin(theta) + c_time, 0.));
  float c_edge = c_size * 0.7 + c_amp * 0.3 * c_size * c_noise;
  float c_lum = 1.0 - smoothstep(c_edge - 0.1, c_edge , n_rho);


  float o_nrho = clamp((n_rho - c_edge)/(o_edge - c_edge), 0., 1.);
  vec3 o_col = tex2D(vec2(o_nrho * segments, ustheta2 * slices)); //texturing

  float c_nrho = n_rho/c_edge * c_scale;
  vec3 c_col = tex2D(vec2(cos(theta) * c_nrho , sin(theta) * c_nrho )) * c_fade;

  //NB. currently using same segments for inner and outer .. this might be changed

  gl_FragColor = vec4( vec3(o_col * o_lum * (1.0 - c_lum) + c_lum * c_col),o_lum );

  }
`;

expVertexShader = `
      attribute float color_type;
			attribute vec4 rand_vals;
			attribute vec4 rand_vals_2;

			uniform float time;
			uniform float env_time;
			uniform vec2 mouse;
			uniform vec2 resolution;

			uniform float scale;
			uniform float max_size;

			uniform vec3 color_1;
			uniform vec3 color_2;

			float TWO_PI = 6.283185307179586;

			varying float particle_size;
			varying vec3 color;


			//hash function
			float random(float x){
				return fract(sin(x * 3454.2121) * 23672.38928);
			}

			//  Simplex 3D Noise
			//  by Ian McEwan, Ashima Arts
			//
			vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
			vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

			float snoise(vec3 v){
			  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
			  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

			// First corner
			  vec3 i  = floor(v + dot(v, C.yyy) );
			  vec3 x0 =   v - i + dot(i, C.xxx) ;

			// Other corners
			  vec3 g = step(x0.yzx, x0.xyz);
			  vec3 l = 1.0 - g;
			  vec3 i1 = min( g.xyz, l.zxy );
			  vec3 i2 = max( g.xyz, l.zxy );

			  //  x0 = x0 - 0. + 0.0 * C
			  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
			  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
			  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

			// Permutations
			  i = mod(i, 289.0 );
			  vec4 p = permute( permute( permute(
			             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
			           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
			           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

			// Gradients
			// ( N*N points uniformly over a square, mapped onto an octahedron.)
			  float n_ = 1.0/7.0; // N=7
			  vec3  ns = n_ * D.wyz - D.xzx;

			  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

			  vec4 x_ = floor(j * ns.z);
			  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

			  vec4 x = x_ *ns.x + ns.yyyy;
			  vec4 y = y_ *ns.x + ns.yyyy;
			  vec4 h = 1.0 - abs(x) - abs(y);

			  vec4 b0 = vec4( x.xy, y.xy );
			  vec4 b1 = vec4( x.zw, y.zw );

			  vec4 s0 = floor(b0)*2.0 + 1.0;
			  vec4 s1 = floor(b1)*2.0 + 1.0;
			  vec4 sh = -step(h, vec4(0.0));

			  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
			  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

			  vec3 p0 = vec3(a0.xy,h.x);
			  vec3 p1 = vec3(a0.zw,h.y);
			  vec3 p2 = vec3(a1.xy,h.z);
			  vec3 p3 = vec3(a1.zw,h.w);

			//Normalise gradients
			  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
			  p0 *= norm.x;
			  p1 *= norm.y;
			  p2 *= norm.z;
			  p3 *= norm.w;

			// Mix final noise value
			  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
			  m = m * m;
			  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
			                                dot(p2,x2), dot(p3,x3) ) );
			}

			void main()
      {

				vec2 trans = vec2(2.0, resolution.y * 2.0/ resolution.x) * scale ;

				float theta = rand_vals.x * TWO_PI;
				float accel = 0.4 + rand_vals.y * 0.15;
				float range = rand_vals.z * 0.95 + 0.05;
				float rho = 0.5 + pow(env_time, accel ) * range;

				float s =  0.1 + rand_vals.w * 0.9;

				vec2 turbulance = vec2 ( snoise(vec3(position.z * 11.13637,0.,time + position.z)), snoise(vec3(position.z * 11.13637,1.,time + position.z)));

				vec2 pos = vec2(cos(theta), sin(theta)) * rho * 2.0 + turbulance * pow(env_time, .5) * 0.05;


				pos += vec2(-.125) + vec2(rand_vals_2.x, rand_vals_2.y) * vec2(.25);
				pos *= 1./trans;

				gl_Position = vec4( vec3(pos.x, pos.y, -0.5), 1.0 );

				particle_size = max_size * s * (1.0 - pow(env_time,  rand_vals_2.z * 0.25 ))/scale;

				color = color_1 * color_type + color_2 * (1. - color_type);

				gl_PointSize = particle_size;

			}
`;

expFragmentShader = `
      #ifdef GL_ES
				precision highp float;
			#endif


			uniform vec2 resolution;
			uniform float time;
			uniform vec2 mouse;

			varying vec3 color;

			varying float particle_size;

			uniform sampler2D noise_tex;


			float PI  = 3.141592653589793;
			float TWO_PI = 6.283185307179586;

			///////////////////////////////////HELPERS///////////////////////////////////


			void main()	{


				//generate normalised coordinates

				vec2 pos = gl_PointCoord - .5;
				vec2 center = vec2(0.);

				if(particle_size < 2.0) discard;


				float d = distance(center, pos * 2.);


				gl_FragColor = vec4(vec3(1. - d) * color, smoothstep(0. , 0.1, 1. - d) );


			}
`;
