


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
