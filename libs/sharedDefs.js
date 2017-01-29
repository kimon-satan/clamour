window.BlobUniforms = {

	time: 		{value: 1.0, locked: true }, //used to store global time not used in shader
	c_time: 		{value: 1.0, locked: true },
	o_time: 		{value: 1.0, locked: true },
	r_time: 		{value: 1.0, locked: true },
	shake:      {value: 0.1,  min: 0.0, max: 1.0},
	scale:      {value: 0.1,  min: 0.0, max: 1.0}, // this needs work
	seed:      {value: 0.0,  locked: true},
	slices:      {value: 8.0,  min: 1.0, max: 20.0},
	segments:      {value: 1.0,  min: 1.0, max: 10.0},
	cell_detail:   {value: 0.0,  min: 0.0, max: 4.0},
	theta_warp:      {value: 1.5,  min: 0.0, max: 4.0},
	warp_skew:      {value: 1.5, min: 0.0, max: 6.0},
	cell_detune:      {value: .25,  min: 0., max: 1., step: 0.01},
	c_size:      {value: 0.5,  min: 0.1, max: 0.8},
	c_scale:      {value: 1.0,  min: 0.1, max: 1.0},
	c_freq:      {value: 1.0,  min: 0.1, max: 10.0, },
	c_fade:      {value: 0.0,  min: 0.0, max: 1.0},
	c_amp:      {value: 0.1,  min: 0.0, max: 1.0},
	r_amp:      {value: 0.1,  min: 0.0, max: 0.8},
	r_freq:      {value: 1.0,  min: 0.1, max: 10.0, },

	o_amp:      {value: 0.1,  min: 0.0, max: 0.8},
	o_step:      {value: 20.0,  min: 0.0, max: 30.0},
	o_freq:      {value: 1.0,  min: 0.1, max: 10.0, },

	edge_amp:      {value: 0.,  min: 0.0, max: 1.0},
	edge_freq:      {value: 2.,  min: 0.01, max: 10.0},
	o_distort: 	{value: new THREE.Vector2(.4,2.),  min: 0.0, max: 4.0},

	bg_color:        {value: new THREE.Vector3(0.0),  type: "color"},
	fg_color:        {value: new THREE.Vector3(0.0),  type: "color"},
	hl_color:        {value: new THREE.Vector3(0.0),  type: "color"},
	fg_pow:      {value: 1.,  min: 0.01, max: 3.0},
	hl_pow:      {value: 1.,  min: 0.01, max: 3.0},
	hl_mul:      {value: 0.5,  min: 0., max: 1.0},
	hl_freq:      {value: 4.,  min: 2., max: 15.}

};

window.GraphicStates = [
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

		fg_color: "COL1",
		bg_color: "BLACK",
		hl_color: "COL2",

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
		bg_color: "COL3"
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
		fg_color: "BLACK",
		bg_color: "COL1",
		hl_color: "COL2",
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

	//5 //dying

	{
		fg_pow: 0.2,
		hl_pow: 0.6,
		hl_mul: 0.6,
		hl_freq: 6.5,
		c_freq: 0.0,
		o_freq: 0.0,
		r_freq: 0.0,
		cell_detail: 1.0,
		fg_color: "BLACK",
		bg_color: "GRAY1",
		hl_color: "GRAY2"
	},

	//6
	{
		hl_color: "BLACK",
		hl_mul: 0.1,
	}

]

//////////////////////////////// shared blob functions ////////////////////////

function changeState(idx)
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

function getState(idx)
{

	for(property in this.uniforms)
	{
		if(typeof(this.uniforms[property].value) == "number")
		{
			if(GraphicStates[idx][property] !== undefined)
			{
				this.uniforms[property].value = GraphicStates[idx][property];

			}

			this.currState[property] = this.uniforms[property].value;

		}
		else if(this.uniforms[property].value instanceof THREE.Vector3)
		{
			if(GraphicStates[idx][property] !== undefined)
			{

				this.uniforms[property].value.copy(GraphicStates[idx][property]);
				if(this.uniforms[property].type == "color")
				{

					switch(GraphicStates[idx][property])
					{
						case "COL1": this.uniforms[property].value.copy(this.col1) ;break;
						case "COL2": this.uniforms[property].value.copy(this.col2) ;break;
						case "COL3": this.uniforms[property].value.copy(this.col3) ;break;
						case "BLACK": this.uniforms[property].value.copy(this.black) ;break;
						case "GRAY1": this.uniforms[property].value.copy(this.gray1) ;break;
						case "GRAY2": this.uniforms[property].value.copy(this.gray2) ;break;
					}
				}
			}

			this.currState[property]  = new THREE.Vector3().copy(this.uniforms[property].value);
		}
		else if(this.uniforms[property].value instanceof THREE.Vector2)
		{
			if(GraphicStates[idx][property] !== undefined)
			{

				this.uniforms[property].value.copy(GraphicStates[idx][property]);
			}

			this.currState[property] = new THREE.Vector2().copy(this.uniforms[property].value);
		}
	}

}

function updateUniforms()
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

function incrementState(idx)
{



	if(idx != this.currStateIdx + 1){
		this.changeState(idx - 1);
	}

	this.currStateIdx = idx;

	//beginning a new state

	this.prevState = {};
	this.stateDeltas = {};

	for(property in GraphicStates[idx])
	{

		if(typeof(this.uniforms[property].value) == "number")
		{
			this.prevState[property] = this.currState[property];
			this.stateDeltas[property] = GraphicStates[idx][property] - this.currState[property];
		}
		else if(this.uniforms[property].value instanceof THREE.Vector3)
		{

			this.prevState[property] = new THREE.Vector3().copy(this.currState[property]);

			if(this.uniforms[property].type == "color")
			{
				console.log("color")

				var c = new THREE.Vector3();

				switch(GraphicStates[idx][property])
				{

					case "COL1": c.copy(this.col1) ;break;
					case "COL2": c.copy(this.col2) ;break;
					case "COL3": c.copy(this.col3) ;break;
					case "BLACK": c.copy(this.black) ;break;
				}

				this.stateDeltas[property] = new THREE.Vector3().subVectors(c ,this.currState[property] );
			}
			else
			{
				this.stateDeltas[property] = new THREE.Vector3().subVectors(GraphicStates[idx][property],this.currState[property] );
			}


		}
		else if(this.uniforms[property].value instanceof THREE.Vector2)
		{
			this.prevState[property] = new THREE.Vector2().copy(this.currState[property].value);
			this.stateDeltas[property] = new THREE.Vector2().subVectors(GraphicStates[idx][property],this.currState[property] );
		}
	}
}
