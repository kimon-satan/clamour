
function webglAvailable() {
	try {
		var canvas = document.createElement( 'canvas' );
		return !!( window.WebGLRenderingContext && (
			canvas.getContext( 'webgl' ) ||
			canvas.getContext( 'experimental-webgl' ) )
		);
	} catch ( e ) {
		return false;
	}
}


Graphics.prototype.init = function()
{
	//the graphics renderer
	if ( webglAvailable() )
	{
			this.renderer = new THREE.WebGLRenderer();
			this.isNoWebGL = false;
	}
	else
	{
			this.isNoWebGL = true;
	}

	//maybe reduce size to improve performance
	this.renderer.setSize( window.innerWidth, window.innerHeight );


	$('#playContainer').append( this.renderer.domElement );
	this.canvas = this.renderer.domElement;

	var p = this.renderer.domElement.width/this.renderer.domElement.height;
	this.camera = new THREE.OrthographicCamera(-p, p, -1, 1, -1, 1);

	this.camera.position.z = 1;

	this.scene = new THREE.Scene();
	this.isExploding = false;

//GRID

	var gridGeometry = new THREE.Geometry();

	this.cellNorm = 0.2;
	var l = Math.sqrt(p*p + 1.0) + this.cellNorm;
	var num = l * 2.0/this.cellNorm;

	for(var i = 0; i < num; i++)
	{
	  var d = i * this.cellNorm;
	  gridGeometry.vertices.push( new THREE.Vector3(-l , -l + d, 0 ) );
	  gridGeometry.vertices.push( new THREE.Vector3( l , -l + d, 0 ) );
	  gridGeometry.vertices.push( new THREE.Vector3( -l + d, -l , 0 ) );
	  gridGeometry.vertices.push( new THREE.Vector3( -l + d, l, 0 ) );
	}

	var g_material = new THREE.LineBasicMaterial( { color: 0x666666} );
	this.grid = new THREE.LineSegments( gridGeometry, g_material );
	this.grid.visible = false;
  this.scene.add( this.grid);

	//////////////////////BLOB///////////////////////////////

	var geometry = new THREE.PlaneBufferGeometry( l, l); // we are about to rotate so x & y are reveresed

	geometry.rotateZ(-Math.PI/2); //quarter turn

	var material = new THREE.ShaderMaterial( {
		uniforms: this.uniforms,
		vertexShader: blobVertexShader,
		fragmentShader: blobFragmentShader,
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide

	} );

	//var material = new THREE.MeshBasicMaterial( { color: 0xffffff, side: THREE.DoubleSide} );
	//var mesh = new THREE.Mesh( geometry, material );
	this.mesh = new THREE.Mesh( geometry, material );
	this.scene.add( this.mesh );

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
	var images = ["stroke_down.png", "stroke_up.png", "stroke_left.png", "stroke_right.png", "hold.png", "swipe.png"];
	this.images = {};
	for(i in images)
	{
		var s = images[i].split(".")[0];
		this.images[s] = new THREE.TextureLoader().load("images/" + images[i]);
	}

	//////////////////////INSTRUCTIONS///////////////////////////////

	var geo = new THREE.PlaneGeometry( 1.75, 1.75 );
	geo.rotateZ(Math.PI); //get it the right way round
	geo.rotateY(Math.PI);
	this.instruct_material = new THREE.MeshBasicMaterial( { map: this.images[0], transparent: true, visible: false, opacity: 0.0, side: THREE.DoubleSide} );
	this.instructPlane = new THREE.Mesh( geo, this.instruct_material);
	this.scene.add( this.instructPlane );

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

		var swell = Math.sin(Math.pow(this.swell_env.value,4.0) * Math.PI) * 0.25;
		this.uniforms.scale.value = 1.0 - swell;
		this.mesh.scale.x = 1.0 - swell;
		this.mesh.scale.y = 1.0 - swell;
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

	if(this.instruct_material.visible)
	{

		this.instructPlane.position.set( this.camera.position.x, this.camera.position.y, this.camera.position.z);
		this.instructPlane.rotation.set(0,0, this.camera.rotation._z);
		this.instruct_env.step();
		this.instruct_material.opacity = this.instruct_env.z;
		if(this.instruct_env.z < 0.0001)
		{
			this.instruct_material.visible = false;
		}
	}

	//update the blob mesh to keep it stationary
	this.mesh.position.set( this.camera.position.x, this.camera.position.y, this.camera.position.z);
	this.mesh.rotation.set( 0,0 , this.camera.rotation._z)
	//this.grid.rotation.set( 0,0 , this.camera.rotation._z);

	this.renderer.render( this.scene, this.camera );

}

Graphics.prototype.updateGrid = function(trans, rot)
{


	this.camera.setRotationFromAxisAngle(new THREE.Vector3(0,0,1),rot);//
	//this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1),-rot);
	//var v = new THREE.Vector3 (0,-1,1);

	//camera wrapping

	if(this.camera.position.y < -this.cellNorm){
		this.camera.position.y += this.cellNorm;
	}
	if(this.camera.position.y > this.cellNorm){
		this.camera.position.y -= this.cellNorm;
	}
	if(this.camera.position.x < this.cellNorm){
		this.camera.position.x += this.cellNorm;
	}
	if(this.camera.position.x > this.cellNorm){
		this.camera.position.x -= this.cellNorm;
	}

	this.camera.translateOnAxis(new THREE.Vector3(0,-1,0), trans * 0.05);




}

Graphics.prototype.displayInstruction = function(idx){

	console.log("show:", idx);
	this.instruct_material.map = this.images[idx];
	this.instruct_material.visible = true;
	this.instruct_material.opacity = 0.0;
	this.instruct_env.targetVal = 1.0;

}

Graphics.prototype.hideInstruction = function(){

	console.log("hide");
	this.instruct_env.targetVal = 0.0;
}

////////////////////////////////////////////////////GROWTH STATES///////////////////////////////

Graphics.prototype.changeState = changeState;

Graphics.prototype.getState = getState;

Graphics.prototype.updateUniforms = updateUniforms;

Graphics.prototype.incrementState = incrementState;

Graphics.prototype.updateState = updateState;

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

Graphics.prototype.setIsMobile = function(b)
{
	//console.log(b);
	if(!b)
	{
		this.camera.position.x = 0;
		this.camera.position.y = 0;
		this.camera.position.z = 1;
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		this.camera.updateProjectionMatrix();


	}
	this.grid.visible = b;
	//deal with rotation here ?
}
