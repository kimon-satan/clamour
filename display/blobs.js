Blob = function(pos, ud, w_width, _socket)
{
  var count = 0;
  var targetTime = 0;
  this.scene; // ?
  this.uniforms = {};
  this.socket = _socket;
  this.isCrawling = false;

  this.prevState;
  this.currState;
  this.currStateIdx;
  this.stateDeltas;
  this.needsNewGroup = false;

  this.w_width = w_width;

  this.ud = ud;

  this.transEnv = new Envelope2(0.1,2.0,60);
  this.rotEnv = new Envelope(3.0, 60);

  Object.keys(BlobUniforms).forEach(function(e)
  {
    this.uniforms[e] = {};
    Object.keys(BlobUniforms[e]).forEach(function(i)
    {
      this.uniforms[e][i] = BlobUniforms[e][i];
    }.bind(this))
  }.bind(this))

  var colArray = getColors(ud.colSeed, ud.colMode);

  this.col1 = convertRGB(colArray[0]);
  this.col2 = convertRGB(colArray[1]);
  this.col3 = convertRGB(colArray[2]);
  this.black = new THREE.Vector3(0., 0. ,0.);

  this.uniforms.seed.value = this.ud.blobSeed;

  this.uniforms.bg_color = {value: new THREE.Vector3(0.0),  type: "color"};
  this.uniforms.fg_color = {value: new THREE.Vector3(1.0,1.0,1.0),  type: "color"};
  this.uniforms.hl_color = {value: new THREE.Vector3(1.0,1.0,1.0),  type: "color"};

  var p = window.innerWidth/ window.innerHeight;
  this.geometry = new THREE.PlaneBufferGeometry( 0.2, 0.2 ); //quarter turn
  this.geometry.rotateZ(Math.PI * 1.5);
  //
  this.material = new THREE.ShaderMaterial( {
		uniforms: this.uniforms,
		vertexShader: blobVertexShader,
		fragmentShader: blobFragmentShader,
		transparent: true,
    side: THREE.DoubleSide
	} );

	this.mesh = new THREE.Mesh( this.geometry, this.material );

  this.mesh.position.x = pos.x;
  this.mesh.position.y = pos.y;
  this.mesh.position.z = 5.0;

  this.detune = noise.perlin2(this.uniforms.seed.value, count) * Math.PI;
  this.currStateIdx = ud.state;


  ///

  this.update = function(ellapsedTime)
  {
    var delta = ellapsedTime - this.uniforms.time.value;

    this.uniforms.c_time.value += (delta * this.uniforms.c_freq.value);
    this.uniforms.o_time.value += (delta * this.uniforms.o_freq.value);
    this.uniforms.r_time.value += (delta * this.uniforms.r_freq.value);

    this.uniforms.time.value = ellapsedTime;

    this.transEnv.step();
    this.rotEnv.step();

    if(this.transEnv.z > this.transEnv.targetVal * 0.95 && this.transEnv.targetVal > 0)
    {
      this.transEnv.targetVal = 0;
    }

    if(this.transEnv.z > 0.05)
    {
      count += 0.005;
      this.detune = noise.perlin2(this.uniforms.seed.value, count) * Math.PI;

      if(ellapsedTime > targetTime) //approximately 10fps
      {
        targetTime = ellapsedTime + 0.1; //
        this.socket.emit('updateCrawler', {
          scidx: this.ud._id,
          energy: this.transEnv.z
        });
      }

    }
    else if(this.isCrawling && this.transEnv.targetVal == 0)
    {
      this.socket.emit('endCrawler', {
        scidx: this.ud._id
      });
      this.isCrawling = false;
    }


    this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1),this.rotEnv.z + this.detune);
    this.mesh.translateOnAxis(new THREE.Vector3(0,-1,0), this.transEnv.z * 0.005);

    if(this.mesh.position.y < -1.1)
    {
      this.mesh.position.y = 1.1;
      this.needsNewGroup = true;

    }
    else if (this.mesh.position.y > 1.1) {
      this.mesh.position.y = -1.1;
      this.needsNewGroup = true;
    }

    if(this.mesh.position.x < -(this.w_width + 0.1) )
    {
      this.mesh.position.x = this.w_width + 0.1;
      this.needsNewGroup = true;

    }
    else if (this.mesh.position.x > this.w_width + 0.1)
    {
      this.mesh.position.x = -(this.w_width + 0.1);
      this.needsNewGroup = true;
    }





  }

  this.move = function(rotTarget, transTarget)
  {

    var pan = this.mesh.position.x/this.w_width;


    if(!this.isCrawling)
    {
      this.socket.emit('startCrawler', {
        scidx: ud._id,
        pan: pan
      });
    }

    this.rotEnv.targetVal = rotTarget;
    this.transEnv.targetVal = transTarget;
    this.isCrawling = true;

  }

  this.changeState = changeState;
  this.getState = getState;

  this.changeState(this.currStateIdx); //set to state zero



}

BlobManager = function(_width, _socket)
{

  this.w_width = _width;
  this.blobs = {};
  this.socket = _socket;

  this.update = function(ellapsedTime) //actually will be more like update
  {

    Object.keys(this.blobs).forEach(function(e)
    {
      this.blobs[e].update(ellapsedTime);

    }.bind(this));
  }

  this.addBlob = function(pos, ud)
  {
    //debug code
    this.blobs[ud._id] = new Blob(pos, ud, this.w_width, this.socket);
    return this.blobs[ud._id];
  }

  this.clearAll = function(scene)
  {

    Object.keys(this.blobs).forEach(function(uid)
    {
      scene.remove(this.blobs[uid].mesh);
      delete this.blobs[uid];
    }.bind(this))

  }

}
