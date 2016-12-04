

Graphics.prototype.init = function()
{
	//the graphics renderer
	this.renderer = new THREE.WebGLRenderer();


	//maybe reduce size to improve performance
	this.renderer.setSize( window.innerWidth, window.innerHeight );


	$('#playContainer').append( this.renderer.domElement );
	this.canvas = this.renderer.domElement;



	this.uniforms.resolution.value.x = this.renderer.domElement.width;
	this.uniforms.resolution.value.y = this.renderer.domElement.height;

	this.camera = new THREE.Camera();
	this.camera.position.z = 1;

	this.scene = new THREE.Scene();
	this.isExploding = false;




	//////////////////////BLOB///////////////////////////////

	var geometry = new THREE.PlaneBufferGeometry( 2, 2 );

	var material = new THREE.ShaderMaterial( {
		uniforms: this.uniforms,
		vertexShader: blobVertexShader,
		fragmentShader: blobFragmentShader,
		transparent: true,
		depthWrite: false

	} );

	var mesh = new THREE.Mesh( geometry, material );
	this.scene.add( mesh );

	///////////////////////EXPLOSION////////////////////////////////

	this.exp_uniforms = {
		time:       { value: 1.0 },
		resolution: { value: new THREE.Vector2() },
		mouse:  	{value: new THREE.Vector2() },
		env_time:  	{value: 0. },

		scale:      {value: 1.0, gui: true, min: 1.0, max: 10.0},
		max_size: {value: 40.0, gui: true, min: 1.0, max: 60.0},
		color_1: {value: this.col1},
		color_2: {value: this.col2}

	};

	this.exp_uniforms.resolution.value.x = this.renderer.domElement.width;
	this.exp_uniforms.resolution.value.y = this.renderer.domElement.height;

	this.exp_material = new THREE.ShaderMaterial( {
		uniforms: this.exp_uniforms,
		vertexShader: expVertexShader,
		fragmentShader: expFragmentShader,
		depthWrite: false

	} );


	this.PARTICLE_COUNT = 2000;
	this.exp_geo = new THREE.BufferGeometry();


	var particleVerts = new Float32Array(this.PARTICLE_COUNT * 3);
	var randVals = [new Float32Array(this.PARTICLE_COUNT * 4), new Float32Array(this.PARTICLE_COUNT * 4)];
	var particleColors = new Float32Array(this.PARTICLE_COUNT );

	for (var i = 0; i < this.PARTICLE_COUNT; i++)
	{

		particleVerts[i * 3 + 0] = 0; //x
		particleVerts[i * 3 + 1] = 0; //y
		particleVerts[i * 3 + 2] = i/this.PARTICLE_COUNT; //z

		particleColors[i] = i%2;

		for(var k = 0; k < 2; k++)
		{
			for(var j = 0; j < 4; j++)
			{
				randVals[k][i * 4 + j ]  = Math.random();
			}
		}
	}

	this.exp_geo.addAttribute('position', new THREE.BufferAttribute(particleVerts, 3));
	this.exp_geo.addAttribute('color_type', new THREE.BufferAttribute(particleColors, 1));
	this.exp_geo.addAttribute('rand_vals', new THREE.BufferAttribute(randVals[0], 4));
	this.exp_geo.addAttribute('rand_vals_2', new THREE.BufferAttribute(randVals[1], 4));

	var exp_mesh = new THREE.Points( this.exp_geo ,this.exp_material);

	this.scene.add(exp_mesh);



	this.exp_env = new LineEnv(1., 0, 1);
	this.swell_env = new LineEnv(1., 0, 1);
	this.exp_geo.setDrawRange(0,1); //prevents rendering when idle
	this.exp_material.visible = false;

	//adapt for multiple images
	var images = ["stroke_down.png", "stroke_up.png", "stroke_left.png", "stroke_right.png", "hold.png"];
	this.images = {};
	for(i in images)
	{
		var s = images[i].split(".")[0];
		this.images[s] = new THREE.TextureLoader().load("images/" + images[i]);
	}

	//////////////////////INSTRUCTIONS///////////////////////////////

	var prop = window.innerWidth/window.innerHeight;
	var geo = new THREE.PlaneGeometry( 1.75, 1.75 * prop );
	this.instruct_material = new THREE.MeshBasicMaterial( { map: this.images[0], transparent: true, visible: false, opacity: 0.0} );
	var plane = new THREE.Mesh( geo, this.instruct_material );
	this.scene.add( plane );

	this.instruct_env = new Envelope(0.5,60);

	this.currStateIdx = 0;
	this.changeState(this.currStateIdx); //set to state zero

}

Graphics.prototype.resume = function(){
	$('#playContainer').append( this.renderer.domElement );
	this.canvas = this.renderer.domElement;
}

Graphics.prototype.updateReactions = function(envsActive, envs)
{
	this.updateUniforms(); //reset the uniforms after any reaction jiggery

	if(envsActive && this.react != undefined)
	{
			this.react(envs);
	}
}

Graphics.prototype.updateExplosion = function(env)
{
	this.uniforms.shake.value = Math.pow(env.z,5.0) * 0.05;
}

Graphics.prototype.draw = function(ellapsedTime , mousePos, splatCB){

	//console.log(ellapsedTime);
	//update the various time uniforms last
	var delta = ellapsedTime - this.uniforms.time.value;

	this.uniforms.c_time.value += (delta * this.uniforms.c_freq.value);
	this.uniforms.o_time.value += (delta * this.uniforms.o_freq.value);
	this.uniforms.r_time.value += (delta * this.uniforms.r_freq.value);

	this.exp_uniforms.time.value = ellapsedTime;

	this.exp_uniforms.env_time.value = this.exp_env.update();

	this.swell_env.update();


	if(this.exp_env.value == 1.0 && this.exp_env.isTriggered)
	{
		this.exp_env.reset();
		this.exp_geo.setDrawRange(0,1); //stop render
		this.exp_material.visible = false;
	}

	if(this.swell_env.value == 1.0 && this.swell_env.isTriggered)
	{
		this.swell_env.reset();
	}

	if(this.swell_env.value > 0 && this.swell_env.isTriggered)
	{

		var swell = (Math.sin(Math.pow(this.swell_env.value,4.0) * Math.PI) * 0.5);
		this.uniforms.scale.value = 1.0 + swell * 2.0;
		this.uniforms.shake.value = (1.0 - Math.pow(this.swell_env.value, 4.0)) * 0.05;

		if(this.swell_env.value > 0.95 && !this.exp_env.isTriggered) //hacked fix me
		{

			this.exp_env.trigger();
			this.exp_geo.setDrawRange(0,this.PARTICLE_COUNT); //start rendering
			this.exp_material.visible = true;

			splatCB();
		}
	}



	this.uniforms.time.value = ellapsedTime;
	this.uniforms.mouse.value.copy(mousePos);

	if(this.instruct_material.visible)
	{
		this.instruct_env.step();
		this.instruct_material.opacity = this.instruct_env.z;
		if(this.instruct_env.z < 0.0001)
		{
			this.instruct_material.visible = false;
		}
	}

	this.renderer.render( this.scene, this.camera );

}

Graphics.prototype.displayInstruction = function(idx){
	this.instruct_material.map = this.images[idx];
	this.instruct_material.visible = true;
	this.instruct_material.opacity = 0.0;
	this.instruct_env.targetVal = 1.0;
}

Graphics.prototype.hideInstruction = function(){

	this.instruct_env.targetVal = 0.0;
}

////////////////////////////////////////////////////GROWTH STATES///////////////////////////////

Graphics.prototype.changeState = function(idx)
{

	this.currStateIdx = idx;
	this.currState = {};

	for(var i = 0; i <= idx; i++ )
	{
			this.prevState = this.currState;
			this.currState = {};
			this.getState(i);
	}


}

Graphics.prototype.getState = function(idx)
{

	for(property in this.uniforms)
	{
		if(typeof(this.uniforms[property].value) == "number")
		{
			if(this.states[idx][property] !== undefined)
			{
				this.uniforms[property].value = this.states[idx][property];
			}

			this.currState[property] = this.uniforms[property].value;

		}
		else if(this.uniforms[property].value instanceof THREE.Vector3)
		{
			if(this.states[idx][property] !== undefined)
			{
				this.uniforms[property].value.copy(this.states[idx][property]);
			}

			this.currState[property]  = new THREE.Vector3().copy(this.uniforms[property].value);
		}
		else if(this.uniforms[property].value instanceof THREE.Vector2)
		{
			if(this.states[idx][property] !== undefined)
			{

				this.uniforms[property].value.copy(this.states[idx][property]);
			}

			this.currState[property] = new THREE.Vector2().copy(this.uniforms[property].value);
		}
	}

}

Graphics.prototype.updateUniforms = function()
{

	//reset the uniforms after any jiggery pokery

	for(property in this.uniforms)
	{
		if(this.uniforms[property].locked)
		{
			//skip it
		}
		else if(typeof(this.uniforms[property].value) == "number")
		{
			this.uniforms[property].value = this.currState[property];
		}
		else if(this.uniforms[property].value instanceof THREE.Vector3)
		{
			this.uniforms[property].value.copy(this.currState[property]);
		}
		else if(this.uniforms[property].value instanceof THREE.Vector2)
		{
			this.uniforms[property].value.copy(this.currState[property]);
		}
	}

}

Graphics.prototype.incrementState = function(idx)
{

	if(idx != this.currStateIdx + 1){
		this.changeState(idx - 1);
	}

	this.currStateIdx = idx;

	//beginning a new state

	this.prevState = {};
	this.stateDeltas = {};

	for(property in this.states[idx])
	{

		if(typeof(this.uniforms[property].value) == "number")
		{
			this.prevState[property] = this.currState[property];
			this.stateDeltas[property] = this.states[idx][property] - this.currState[property];
		}
		else if(this.uniforms[property].value instanceof THREE.Vector3)
		{
			this.prevState[property] = new THREE.Vector3().copy(this.currState[property]);
			this.stateDeltas[property] = new THREE.Vector3().subVectors(this.states[idx][property],this.currState[property] );
		}
		else if(this.uniforms[property].value instanceof THREE.Vector2)
		{
			this.prevState[property] = new THREE.Vector2().copy(this.currState[property].value);
			this.stateDeltas[property] = new THREE.Vector2().subVectors(this.states[idx][property],this.currState[property] );
		}
	}

}

Graphics.prototype.updateState = function(stateEnvelope)
{

	//increment the current state

	for(property in this.prevState)
	{
		if(typeof(this.uniforms[property].value) == "number")
		{
			this.currState[property] = this.prevState[property] + this.stateDeltas[property] * stateEnvelope.z;
		}
		else if(this.uniforms[property].value instanceof THREE.Vector3)
		{
			this.currState[property].x = this.prevState[property].x + this.stateDeltas[property].x * stateEnvelope.z;
			this.currState[property].y = this.prevState[property].y + this.stateDeltas[property].y * stateEnvelope.z;
			this.currState[property].z = this.prevState[property].z + this.stateDeltas[property].z * stateEnvelope.z;
		}
		else if(this.uniforms[property].value instanceof THREE.Vector2)
		{
			this.currState[property].x = this.prevState[property].x + this.stateDeltas[property].x * stateEnvelope.z;
			this.currState[property].y = this.prevState[property].y + this.stateDeltas[property].y * stateEnvelope.z;
		}
	}

}

Graphics.prototype.setReaction = function(r){
	if(r != undefined)
	{
		this.react = this.reactions[r];
	}
	else
	{
		this.react = undefined;
	}
}

Graphics.prototype.explode = function()
{
	this.isExploding = false;
	this.swell_env.trigger();
}
