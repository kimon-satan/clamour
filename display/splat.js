

/*
	NB. perhaps a more efficient way is to have separate geometries for each player
	this would allow for uniforms which are currently attributes
	not sure how much overhead this really saves
*/

Spot = function (owner)
{
	this.attributes = {
		center: new THREE.Vector2(),
		decenter: new THREE.Vector2(),
		spread: 1.0,
		size: 100 ,
		noise_seed: Math.random() ,
		col1: [1.0,0.0,0.0],
		col2: [1.0,1.0,1.0],
		phase: 0,
		freq: 1,
		glowWave: 0,
		fade: 0
	}

	this.owner = owner;
	this.index = 0;

	this.isGlowing = false;
	this.isDecaying = false;
	this.isTransforming = false;

	this.decayEnv = new Envelope(5,45);
	this.decayEnv.z = 1.0


	this.decay = function()
	{
		if(this.decayEnv.targetVal > 0)
		{
			this.decayEnv.targetVal = 0;
		}

		if(this.decayEnv.z > 0.01)
		{
			this.decayEnv.step();
			this.attributes.fade = this.decayEnv.z;
		}
		else
		{
			this.attributes.fade = 0;
		}

	}

}

const MAX_PARTICLES = 20000; //could be higher wait and see

SplatManager = function(_prop, _socket)
{
	this.spots = {};
	this.playerInfo = {};
	this.glowWaveEnvs = [];

	this.socket = _socket;

	this.geo = new THREE.BufferGeometry();
	this.geo.dynamic = true;

	this.highestIndex = -1;

	//allocate space for particles
	this.verts = new Float32Array(MAX_PARTICLES * 3);
	this.decenters = new Float32Array(MAX_PARTICLES * 2);
	this.color1s = new Float32Array(MAX_PARTICLES * 3);
	this.color2s = new Float32Array(MAX_PARTICLES * 3);
	this.sizes = new Float32Array(MAX_PARTICLES);
	this.phases = new Float32Array(MAX_PARTICLES);
	this.freqs = new Float32Array(MAX_PARTICLES);
	this.glowWaves = new Float32Array(MAX_PARTICLES);
	this.fades = new Float32Array(MAX_PARTICLES);
	this.noise_seeds = new Float32Array(MAX_PARTICLES);
	this.spreads = new Float32Array(MAX_PARTICLES);

	this.geo.addAttribute('noise_seed', new THREE.BufferAttribute(this.noise_seeds, 1));
	this.geo.addAttribute('position', new THREE.BufferAttribute(this.verts, 3));
	this.geo.addAttribute('decenter', new THREE.BufferAttribute(this.decenters, 2));
	this.geo.addAttribute('spread', new THREE.BufferAttribute(this.spreads, 1));
	this.geo.addAttribute('color1', new THREE.BufferAttribute(this.color1s, 3));
	this.geo.addAttribute('color2', new THREE.BufferAttribute(this.color2s, 3));
	this.geo.addAttribute('phase', new THREE.BufferAttribute(this.phases, 1));
	this.geo.addAttribute('freq', new THREE.BufferAttribute(this.freqs, 1));
	this.geo.addAttribute('glowWave', new THREE.BufferAttribute(this.glowWaves, 1));
	this.geo.addAttribute('fade', new THREE.BufferAttribute(this.fades, 1));
	this.geo.addAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

	this.prop = _prop;

	this.uniforms =
	{
		time: {value: 0.0},
		mouse: {value: new THREE.Vector2(0,0) },
		scale: {value: 1.0,  min: 1.0, max: 10.0}

	}

	this.material = new THREE.ShaderMaterial( {
		uniforms: this.uniforms,
		vertexShader: splatVertexShader,
		fragmentShader: splatFragmentShader,
		transparent: true,
		blending: THREE.NormalBlending
	} );

	this.geo.setDrawRange(0,-1);
	this.mesh = new THREE.Points( this.geo , this.material);

	this.updateSpots = function(ellapsedTime){


		this.uniforms.time.value = ellapsedTime;

		for(var id in this.playerInfo)
		{
				this.glowWaveEnvs[this.playerInfo[id].scidx - 1].step();

				if(this.playerInfo[id].transform)
				{

					this.playerInfo[id].transEnv.step();

					if(this.playerInfo[id].transEnv.z < 0.05)
					{
						this.playerInfo[id].transEnv.z = 0;
						//callback

						this.socket.emit('endTone', //calls back to server which communicates with player client
						{
							scidx: this.playerInfo[id].scidx,
							id: id
						});

						this.playerInfo[id].transform = false;

						this.playerInfo[id].callback();

					}
				}
		}

		for(var id in this.spots)
		{


			for(var i = 0; i < this.spots[id].length; )
			{


				if(this.spots[id][i].isTransforming)
				{
					this.spots[id][i].attributes.spread = this.playerInfo[id].transEnv.z;
					this.spots[id][i].attributes.fade = Math.max(0.05, this.spots[id][i].attributes.fade * 0.95); // a bit of a hack
					if(this.spots[id][i].attributes.spread < 0.1e-5)this.spots[id][i].attributes.fade = 0;

					this.updateAttributes(this.spots[id][i]);

					if(this.spots[id][i].attributes.spread < 0.1e-5)
					{

						delete this.spots[id][i];
						this.spots[id].splice(i,1);
					}
					else
					{
						i++;
					}


				}
				else if(this.spots[id][i].isDecaying)
				{
					this.spots[id][i].decay();

					this.updateAttributes(this.spots[id][i]);

					if(this.spots[id][i].attributes.fade < 0.1e-5)
					{

						delete this.spots[id][i];
						this.spots[id].splice(i,1);
					}
					else
					{
						i++;
					}
				}
				else
				{
					if(this.spots[id][i].isGlowing)
					{
						//bug here
						this.spots[id][i].attributes.glowWave = this.glowWaveEnvs[this.playerInfo[id].scidx - 1].z;
						this.updateAttributes(this.spots[id][i]);
					}
					i++
				}
			}


		}

		this.highestIndex = this.findHighestIndex(this.highestIndex);
		this.geo.setDrawRange(0, this.highestIndex);

	}

	this.findHighestIndex = function(index)
	{
		var c = 0;
		while(this.fades[index] < 0.1e-5 || this.spreads[index] < 0.1e-5 )
		{
			index -= 1;
			c ++;
			if(index == 0)break;
			if(c > 1000)break;
		}
		return index;
	}

	this.updateGlow = function(id ,val)
	{
		this.glowWaveEnvs[id - 1].targetVal = val;
	}

	this.updateAttributes = function(spot){

		this.fades[spot.index] = spot.attributes.fade;
		this.glowWaves[spot.index] = spot.attributes.glowWave;
		this.spreads[spot.index] = spot.attributes.spread;

		this.geo.attributes.glowWave.needsUpdate = true;
		this.geo.attributes.fade.needsUpdate = true;
		this.geo.attributes.spread.needsUpdate = true;
	}

	this.clearAll = function()
	{

		for(p in this.spots){

			for(var i = 0; i < this.spots[p].length; )
			{

				var index = this.spots[p][i].index;
				this.fades[index] = 0;

				delete this.spots[p][i];
				this.spots[p].splice(i,1);
			}
		}

		this.spots = {};
		this.playerInfo = {};
		this.geo.setDrawRange(0, 0);

		this.highestIndex = 0;

	}

	this.addSplat = function(ud)
	{

		var id = ud._id;

		if(this.spots[id] == undefined)
		{

			var colArray = getColors(ud.colSeed, ud.colMode);
			this.spots[id]= new Array();

			var scidx = Object.keys(this.playerInfo).length + 1;
			var pan = ud.splatPan;

			this.playerInfo[id] = {
				scidx: scidx,
				energy: 0.1,
				isGlowing: false,
				transform: false,
				transEnv: new Envelope(1,45),
				freq: 0.05 + Math.random() * 0.25,
				phase: Math.random() * Math.PI * 2.0,
				pan: pan,
				col1: hslToRgb(colArray[0].x, colArray[0].y, colArray[0].z),
				col2: hslToRgb(colArray[1].x, colArray[1].y, colArray[1].z),
				col3: hslToRgb(colArray[2].x, colArray[2].y, colArray[2].z),
				center: new THREE.Vector2( pan * this.prop,  (2* Math.random() - 1.) * .85 )
			 }

			 this.glowWaveEnvs.push(new Envelope(0.05, 60));

		}else{

			this.playerInfo[id].energy = Math.min(1.0,0.1 + this.playerInfo[id].energy);

			if(this.playerInfo[id].energy == 0.4)
			{

				this.socket.emit('addTone', {
					scidx: this.playerInfo[id].scidx ,
					freq: this.playerInfo[id].freq,
					phase: this.playerInfo[id].phase,
					pan: this.playerInfo[id].pan,
				});
				this.beginGlow(id);
			}
			else if(this.playerInfo[id].energy > 0.4)
			{
				var glowTarget = (this.playerInfo[id].energy - 0.3)/0.6;

				this.socket.emit('updateTone', {scidx: this.playerInfo[id].scidx, amp: glowTarget});


			}


		}



		var numParticles = 25 + this.playerInfo[id].energy * 50;
		var seed  = Math.random();
		var spread = 0.15 + this.playerInfo[id].energy * 0.15;
		var splatter = 0.5 + (1.0 - this.playerInfo[id].energy) * 0.5;
		var maxSize = 50 + this.playerInfo[id].energy * 25;

		var detune = new THREE.Vector2((2 * Math.random() - 1.) * .1,  (2* Math.random() - 1.) * .1)

		for (var i = 0; i < numParticles; i++)
		{
			var theta = Math.random() * Math.PI * 2.0;
			var n = (noise.simplex3(Math.cos(theta) * .5, Math.sin(theta) * .5, seed) + 1.0)/2.0;
			var rho = (spread + n * spread) * Math.pow(Math.random(), 0.5);
			var x = Math.sin(theta) * rho;
			var y = Math.cos(theta) * rho;
			var l = Math.max( 0.01, 1.0 - rho * 2.0);

			var spot = new Spot(id);

			spot.attributes.size = 5 + Math.random() * 25.0;
			spot.attributes.center.copy(this.playerInfo[id].center);
			spot.attributes.decenter.set(x,y);
			spot.attributes.spread = 1.0;
			spot.attributes.freq = this.playerInfo[id].freq;
			spot.attributes.phase = this.playerInfo[id].phase + Math.random() * 0.05;
			spot.attributes.fade = 1.0;
			spot.attributes.col1 = (Math.random() > 0.5) ? this.playerInfo[id].col1 : this.playerInfo[id].col2;
			spot.attributes.col2 = this.playerInfo[id].col2;

			if(spot.attributes.size < Math.min(75, maxSize * this.playerInfo[id].energy))
			{
				//spot.isDecaying = Math.random() > 0.5;
			}

			if(!spot.isDecaying)spot.isGlowing = this.playerInfo[id].isGlowing;

			this.spots[id].push(spot);

			this.addToShader(spot);

		}

		for(var a in this.geo.attributes)
		{
			this.geo.attributes[a].needsUpdate = true;
		}

		this.geo.setDrawRange(0, this.highestIndex + 1);

	}

	this.beginGlow = function(id)
	{

		this.playerInfo[id].isGlowing = true;

		for(var spot in this.spots[id])
		{
				if(!this.spots[id][spot].isDecaying)
				{
					this.spots[id][spot].isGlowing = true;

				}
		}
	}

	this.addToShader = function(spot)
	{
		for(var idx = 0; idx < MAX_PARTICLES; idx++)
		{
			if(this.fades[idx] < 0.1e-5){

				this.fades[idx] = spot.attributes.fade;
				this.sizes[idx] = spot.attributes.size;
				this.phases[idx] = spot.attributes.phase;
				this.freqs[idx] = spot.attributes.freq;
				this.glowWaves[idx] = spot.attributes.glowWave;
				this.noise_seeds[idx] = spot.attributes.noise_seed;
				this.spreads[idx] = spot.attributes.spread;

				this.verts[idx * 3 + 0] = spot.attributes.center.x; //x
				this.verts[idx * 3 + 1] = spot.attributes.center.y; //y
				this.verts[idx * 3 + 2] = 0; //z

				this.decenters[idx * 2 + 0] = spot.attributes.decenter.x; //x
				this.decenters[idx * 2 + 1] = spot.attributes.decenter.y; //y

				for(var j = 0; j < 3; j++)
				{
					this.color1s[idx * 3 + j] = spot.attributes.col1[j]; //r
					this.color2s[idx * 3 + j] = spot.attributes.col2[j]; //r
				}

				spot.index = idx;

				if(idx > this.highestIndex)
				{
					this.highestIndex = idx;
				}

				break;
			}
		}
	}

	this.getEnergy = function(uid)
	{
		if(this.playerInfo[uid] != undefined)
		{
			return this.playerInfo[uid].energy;
		}

		return 0;
	}

	this.transform = function(uid, callback)
	{
		for(var i = 0; i < this.spots[uid].length; i++)
		{
			this.spots[uid][i].isTransforming = true;
		}

		this.playerInfo[uid].transform = true;
		this.playerInfo[uid].transEnv.targetVal = 0;
		this.playerInfo[uid].transEnv.z  = 1.0;

		this.playerInfo[uid].callback = callback;

		this.socket.emit('transTone',
		{
			id: uid, //we need this to transform the player's device too
			scidx: this.playerInfo[uid].scidx ,
			pan: this.playerInfo[uid].pan
		});

	}




}
