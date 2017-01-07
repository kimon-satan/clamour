Blob = function()
{
  this.scene; // ?
  this.uniforms = {};

  Object.keys(BlobUniforms).forEach(function(e)
  {
    this.uniforms[e] = {};
    Object.keys(BlobUniforms[e]).forEach(function(i)
    {
      this.uniforms[e][i] = BlobUniforms[e][i];
    }.bind(this))
  }.bind(this))

  var colArray = getColors(0, 0);

  this.col1 = convertRGB(colArray[0]);
  this.col2 = convertRGB(colArray[1]);
  this.col3 = convertRGB(colArray[2]);
  this.black = new THREE.Vector3(0., 0. ,0.);

  this.uniforms.bg_color = {value: new THREE.Vector3(0.0),  type: "color"};
  this.uniforms.fg_color = {value: new THREE.Vector3(1.0,1.0,1.0),  type: "color"};
  this.uniforms.hl_color = {value: new THREE.Vector3(1.0,1.0,1.0),  type: "color"};

  var p = window.innerWidth/ window.innerHeight;
  this.geometry = new THREE.PlaneBufferGeometry( 0.2 * p, 0.2 ); //quarter turn
  this.geometry.rotateZ(Math.PI/2);
  //
  this.material = new THREE.ShaderMaterial( {
		uniforms: this.uniforms,
		vertexShader: blobVertexShader,
		fragmentShader: blobFragmentShader,
		transparent: true,
		depthWrite: false
	} );

	this.mesh = new THREE.Mesh( this.geometry, this.material );


  this.draw = function()
  {
     //this.mesh.rotation.z += 0.005;
    // this.mesh.rotateZ(0.05);
    // this.mesh.matrixWorld.needsUpdate = true;
    //console.log(this.mesh.rotation.z);
  }

}

BlobManager = function(_resolution, _socket)
{

  this.socket = _socket;
  this.blobs = {};




  this.draw = function() //actually will be more like update
  {
    Object.keys(this.blobs).forEach(function(e)
    {

    }
    );
  }

}
