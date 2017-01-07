


window.Graphics = function(ud){

	this.scene;
	this.camera;
	this.renderer;
	this.canvas;

	this.prevState;
	this.currState;
	this.currStateIdx;
	this.stateDeltas;
	this.react;
	this.ud = ud;

	var colArray = getColors(this.ud.colSeed, this.ud.colMode);
	console.log(colArray);

	this.col1 = convertRGB(colArray[0]);
	this.col2 = convertRGB(colArray[1]);
	this.col3 = convertRGB(colArray[2]);
	this.black = new THREE.Vector3(0., 0. ,0.);

	this.uniforms = BlobUniforms;

	this.uniforms.seed.value = ud.blobSeed;

	this.states = [
		//0
		{
			shake: 0.0,
			cell_detail: 4.0,
			cell_detune: 0.25,

			cell_detail: 4.0,
			slices: 1.0,
			segments: 1.0,
			theta_warp: 1.0,

			c_size: 0.8,
			c_amp: 0.15,
			c_scale: 0.5,
			c_fade: 0.52,
			c_freq: 0.5,

			o_amp: 0.15,
			o_step: 0.0,

			r_freq: 0.2,
			r_amp: 0.2,

			edge_amp: 0.0,
			edge_freq: 0.1,
			o_distort: new THREE.Vector2(1.0,1.0),

			fg_color: this.col1,
			bg_color: this.black,
			hl_color: this.col2,

			fg_pow: 1.0,
			hl_pow: 1.0,
			hl_mul: 0.0,
			hl_freq: 1.0

		},

		//1
		{
			fg_pow: 3.0,
			hl_pow: 0.3,
			hl_mul: 2.5,
			slices: 1.6,
			c_size: 0.6,
			c_scale: 0.6,
			c_fade: 1.0,
			c_amp: 0.4,
			c_freq: 1.0,
			cell_detail: 0.7,
			theta_warp: 1.0,
			o_amp: 0.25,
			o_step: 4.0,
			o_freq: 0.0,
			r_amp: 0.25,
			r_freq: 1.0,
			edge_freq: 0,
			edge_amp: 0,
			c_amp: 0.2,
			cell_detune: 0.5,
			bg_color: this.col3
		},

		//2
		{
			cell_detail: 0.7,
			slices: 3.7,
			fg_pow: 3.0,
			o_amp: 0.35,
			c_scale: 0.7,
			o_step: 8.0,
			o_freq: 1.0,
			c_fade: 1.0
		},

		//3
		{
			slices: 1.0,
			cell_detail: 0.2,
			c_size: 0.6,
			theta_warp: 1.5,
			o_amp: 0.5,
			o_step: 13.0,
			hl_mul: 1.0,
			hl_pow: 0.5,
			hl_freq: 4.0,
			fg_pow: 0.5,
		},

		//4
		{
			c_scale: 1.0,
			cell_detail: 0.0,
			slices: 2.5,
			c_size: 0.5,
			cell_detune: 0.75,
			theta_warp: 2.0,
			fg_color: this.black,
			bg_color: this.col1,
			hl_color: this.col2,
			hl_mul: 0.7,
			hl_pow: 0.85,
			hl_freq: 6.0,
			o_step: 20.0,
			o_amp: 0.25,
			o_freq: 2.0,
			c_amp: 0.5,
			c_freq: 2.0,
			r_amp: 0.1

		},

		//5
		{
			theta_warp: 1.6,
			fg_pow: 2.0,
			hl_mul: 1.0,
			hl_pow: 0.7,
			hl_freq: 7.0,
			slices: 1.0,
			c_scale: 1.0,
			cell_detail: 0.0,
			cell_detune: 0.5,
		},

		//6

		{
			fg_pow: 0.5,
			hl_pow: 0.25,
			c_size: 0.5,
			c_scale: 1.0,
			fg_color: this.col1,
			bg_color: this.black,
			hl_color: this.col2,
		},

		//7
		{
			fg_pow: 0.5,
			hl_pow: 0.5,
			hl_mul: 2.0
		}

	]

	this.reactions = {

			shudderOut: function(env){

				/////
				//maybe muck about with color here too
				this.uniforms.c_size.value = this.currState.c_size + 0.5 * env[1].z;
				//change the center state too
				this.uniforms.edge_amp.value = env[1].z * 0.2;
				this.uniforms.edge_freq.value = 8;

			}.bind(this),

			shudderIn: function(env){

				//assumes previous o amp of 0

				this.uniforms.c_size.value = this.currState.c_size - 0.5 * env[1].z;
				this.uniforms.o_amp.value = this.currState.o_amp + 0.6 * env[4].z;
				this.uniforms.o_freq.value = this.currState.o_freq  +(0.5 + Math.sin(Math.PI * 1.5 + env[1].z * Math.PI * 2.0 * 2.0) * 0.5) * 3.0;
				this.uniforms.o_step.value = this.currState.o_step + 16 * env[1].z;
				this.uniforms.edge_amp.value = this.currState.edge_amp + 0.15;
				this.uniforms.edge_freq.value = this.currState.edge_freq + env[4].z * 2.5;

			}.bind(this),

			shudderThetaUp: function(env){
				//this.uniforms.c_size.value = this.currState.c_size + 0.2 * env[1].z;
				this.uniforms.r_freq.value = this.currState.r_freq + env[1].z * 20.0;
				this.uniforms.c_freq.value = this.currState.c_freq + env[1].z * 20.0;
				this.uniforms.theta_warp.value = this.currState.theta_warp * (1.0- env[1].z);
			}.bind(this),

			shudderThetaDown: function(env){
				this.uniforms.c_size.value = this.currState.c_size + 0.2 * env[1].z;
				this.uniforms.r_freq.value = this.currState.r_freq + env[1].z * 20.0;
				this.uniforms.c_freq.value = this.currState.c_freq + env[1].z * 10.0;
				this.uniforms.theta_warp.value = this.currState.theta_warp / (1.0- env[1].z);
			}.bind(this)

	}
}
