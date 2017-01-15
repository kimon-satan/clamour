function Branch(pos, col1, col2){


	this.maxPoints = 500;
	this.numPoints = 0;
	this.startPos = new THREE.Vector3().copy(pos);
  this.startPos.z = -10.0;
	this.endPos = undefined;
	this.direction = undefined;

	//attributes
	this.vertices = new Float32Array( this.maxPoints * 6);
	this.indexes = new Uint16Array( (this.maxPoints - 1)  * 6);
	this.miters = new Float32Array( this.maxPoints * 2 * 2);
	this.miter_dims = new Float32Array( this.maxPoints * 2);

	this.loc_line_prog = new Float32Array( this.maxPoints * 2);
	this.glob_line_prog = new Float32Array( this.maxPoints * 2);

	this.noise_mul = 0.01 + Math.random() * 0.04;
	this.seed = Math.random();

	this.uniforms = {
		thickness:  {value: 0.01},
		col_freq: {value: 1.0  + Math.random() * 7.0 },
		color1: {value: col1},
		color2: {value: col2}
	};


	this.createGeometry = function()
	{

		for(var i = 0; i < this.maxPoints; i++)
		{
			this.indexes[i*6] = i * 2 + 2;
			this.indexes[i*6+1] = i * 2 + 1;
			this.indexes[i*6+2] = i * 2 + 0;
			this.indexes[i*6+3] = i * 2 + 3;
			this.indexes[i*6+4] = i * 2 + 1;
			this.indexes[i*6+5] = i * 2 + 2;

			for(var j = 0; j < 6; j ++)
			{
				this.vertices[i * 6 + j] = 0;
			}

			this.miters[i * 4] = 0;
			this.miters[i * 4 + 1] = 0;
			this.miters[i * 4 + 2] = 0;
			this.miters[i * 4 + 3] = 0;
			this.miter_dims[i * 2] = 0;
			this.miter_dims[i * 2 + 1] = 0;

			this.glob_line_prog[i * 2] = i/this.maxPoints;
			this.glob_line_prog[i * 2 + 1] = i/this.maxPoints;

		}


		this.endPos = new THREE.Vector2().copy(this.startPos);

		this.geometry = new THREE.BufferGeometry();
		this.geometry.dynamic = true;

		//overriden attributes
		this.geometry.addAttribute( 'position', new THREE.BufferAttribute( this.vertices, 3 ) );
		this.geometry.addAttribute('index', new THREE.BufferAttribute( this.indexes, 1));

		//custom attributes
		this.geometry.addAttribute( 'loc_line_prog', new THREE.BufferAttribute( this.loc_line_prog, 1 ) );
		this.geometry.addAttribute( 'glob_line_prog', new THREE.BufferAttribute( this.glob_line_prog, 1 ) );
		this.geometry.addAttribute( 'miter', new THREE.BufferAttribute( this.miters, 2 ) );
		this.geometry.addAttribute( 'miter_dims', new THREE.BufferAttribute( this.miter_dims, 1 ) );

		this.geometry.addGroup(0, 0, 0);
	}

	this.newGroup = function(){

    var prev_g = this.geometry.groups[this.geometry.groups.length -1];
    var idx = prev_g.start + prev_g.count;
    prev_g.count -= 6;
    this.geometry.addGroup(idx , 0, 0);
		this.geometry.groupsNeedUpdate = true;

	}

	this.updateVertices = function(pos)
	{

    if(this.numPoints == this.maxPoints)return; //don't add any more if out of veritces

    this.endPos.copy(pos);

		this.numPoints = Math.min(this.numPoints + 1, this.maxPoints);

		this.uniforms.thickness.value = Math.max(0.001 , (this.numPoints/this.maxPoints) * 0.02);

		var i = this.numPoints - 1;

		this.geometry.groups[this.geometry.groups.length -1].count += 6;

		this.vertices[i * 6 + 0] = pos.x;
		this.vertices[i * 6 + 1] = pos.y;
		this.vertices[i * 6 + 2] = 0.;

		//a copy
		this.vertices[i * 6 + 3] = pos.x;
		this.vertices[i * 6 + 4] = pos.y;
		this.vertices[i * 6 + 5] = 0.;

    var groupIndex = this.geometry.groups[this.geometry.groups.length -1].count/6;

		if(groupIndex < 3)return;

		var ppi = i - 2;
		var pi = i - 1;

		var p0 = new THREE.Vector2(this.vertices[ppi * 6], this.vertices[ppi*6+1]);
		var p1 = new THREE.Vector2(this.vertices[pi * 6], this.vertices[pi*6+1]);
		var p2 = new THREE.Vector2(this.vertices[i * 6], this.vertices[i*6+1]);

		var a = new THREE.Vector2();
		var b = new THREE.Vector2();

		a.subVectors(p1, p0)
		a.normalize();
		b.subVectors(p2,p1);
		b.normalize();

		var normal = new THREE.Vector2(-a.y,a.x);

		//for the ends

		//make the most recent point the normal
		this.miters[i * 4] = normal.x;
		this.miters[i * 4 + 1] = normal.y;
		this.miters[i * 4 + 2] = normal.x;
		this.miters[i * 4 + 3] = normal.y;
	  this.miter_dims[i * 2] = 1.0;
		this.miter_dims[i * 2 + 1] = -1.0;


		if(groupIndex == 3)
		{
			//construct first normal using the following segment

			this.miters[ppi * 4] = -b.y;
			this.miters[ppi * 4 + 1] = b.x;
			this.miters[ppi * 4 + 2] = -b.y;
			this.miters[ppi * 4 + 3] = b.x;
			this.miter_dims[ppi * 2] = 1.0;
			this.miter_dims[ppi * 2 + 1] = -1.0;

		}

		//for all other points

		var tang = new THREE.Vector2();
		tang.addVectors(a,b);
		tang.normalize();

		var miter = new THREE.Vector2( -tang.y, tang.x );
		miter.normalize();

		//length of miter on either side
		var l = miter.dot(normal);

		this.miters[pi * 4] = miter.x;
		this.miters[pi * 4 + 1] = miter.y;

		this.miters[pi * 4 + 2] = miter.x;
		this.miters[pi * 4 + 3] = miter.y;

		this.miter_dims[pi * 2] = l;
		this.miter_dims[pi * 2 + 1] = -l; //signed to flip the vertex

		this.recalLPs();

		this.geometry.groupsNeedUpdate = true;
		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.loc_line_prog.needsUpdate = true;
    this.geometry.attributes.glob_line_prog.needsUpdate = true;
		this.geometry.attributes.miter.needsUpdate = true;
		this.geometry.attributes.miter_dims.needsUpdate = true;




	}

	this.growOut = function()
	{
		if(this.endPos === undefined || this.numPoints < 10 || this.numPoints == this.maxPoints )return;

		var n = noise.simplex2(this.numPoints/this.maxPoints * 10.  , this.seed );
    this.direction.normalize();
    var norm = new THREE.Vector2(-this.direction.y , this.direction.x).multiplyScalar(n * 0.05);
    this.direction.add(norm);
    this.direction.setLength(0.002);

    var np = new THREE.Vector2().copy(this.endPos).add(this.direction);
    var isNewGroup = getModulo(np); //FIXME

    if(isNewGroup){
      this.newGroup();
      this.updateVertices(np);

    }
    else
    {
      this.updateVertices(np);
    }



	}


	this.recalLPs = function()
	{

		//calculate the line progression for all points
		//NB. might be more useful in relation to maxPoints with a uniform for the progress
		for(var i = 0; i < this.numPoints; i++)
		{
			this.loc_line_prog[i * 2] = i/this.numPoints;
			this.loc_line_prog[i * 2 + 1] = i/this.numPoints;
		}

		for(var i = this.numPoints; i < this.maxPoints; i++)
		{
			this.loc_line_prog[i * 2] = 1.1;
			this.loc_line_prog[i * 2 + 1] = 1.1;
		}

	}




	var m = [new THREE.ShaderMaterial( {
		uniforms: this.uniforms,
		vertexShader: veinVertexShader,
		fragmentShader: veinFragmentShader,
		side:  THREE.DoubleSide,
		transparent: true
	}) ];

	this.material = new THREE.MultiMaterial(m);

	this.createGeometry();
	this.recalLPs();
	this.mesh = new THREE.Mesh( this.geometry, this.material );
  //this.pmesh = new THREE.Points( this.geometry, this.material );

}


function BranchManager()
{
  this.branches = [];

  this.update = function()
  {

  }
}

///////////////////////////////////////////HELPERS/////////////////////////////////////

//FIXME this will need some work
function getModulo(p)
{
  var isMod = false;
  //modulo the position to make a wrapped space
  var w = width/height + 0.05;
  var h = 1.05;

  if(p.x < -w)
  {
    p.x += w * 2.0;
    isMod = true;
  }
  else if(p.x > w)
  {
    p.x -= w * 2.0;
    isMod = true;
  }

  if(p.y < -h)
  {
    p.y += h * 2.0;
    isMod = true;

  }
  else if(p.y > h)
  {
    p.y -= h * 2.0;
    isMod = true;
  }

  return isMod;
}
