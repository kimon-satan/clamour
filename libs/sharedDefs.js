window.BlobUniforms = {

	time: 		{value: 1.0, locked: true }, //used to store global time not used in shader
	c_time: 		{value: 1.0, locked: true },
	o_time: 		{value: 1.0, locked: true },
	r_time: 		{value: 1.0, locked: true },
	shake:      {value: 0.1,  min: 0.0, max: 1.0},
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

	bg_color:        {value: new THREE.Vector3(),  type: "color"},
	fg_color:        {value: new THREE.Vector3(),  type: "color"},
	hl_color:        {value: new THREE.Vector3(),  type: "color"},
	fg_pow:      {value: 1.,  min: 0.01, max: 3.0},
	hl_pow:      {value: 1.,  min: 0.01, max: 3.0},
	hl_mul:      {value: 0.5,  min: 0., max: 1.0},
	hl_freq:      {value: 4.,  min: 2., max: 15.}

};
