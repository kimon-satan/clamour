
love = undefined;

var voteDisplayer;

var lastFrameTime, framePeriod, fps, mode;

lastFrameTime = 0;

var socket = io('/display');

$('document').ready(function(){

	setupInstructions();
})


socket.on('cmd', function(msg){

	//console.log(msg);
	if (msg.type == "instruct")
	{
		setupInstructions();
	}
	else if (msg.type == "love" )
	{
		setupLove();
	}
	else if (msg.type == "story" )
	{
		story(msg.img);
	}
	else if (msg.type == "vote" )
	{
		if(msg.cmd == "reset" || msg.cmd == "new")
		{
			$('#displayscreen').empty();
			voteDisplayer = new VoteDisplayer();
		}
		else
		{
			voteDisplayer.cmd(msg);
		}
	}
	else if (msg.type == "end")
	{
		love.splatManager.clearAll();
		love.blobManager.clearAll(love.scene);
		love.branchManager.clearAll(love.scene);
		love.grid.visible = false;
	}
	else if (msg.type == "clear")
	{
		if(mode == "love")
		{
			love.splatManager.clearAll();
			love.blobManager.clearAll(love.scene);
			love.branchManager.clearAll(love.scene);
			love.grid.visible = true;
		}
		else
		{
			$('#displayscreen').empty();
		}
	}
	else if(msg.type == "splat")
	{
		love.splat(msg);
	}
	else if(msg.type == "transform")
	{
		love.transform(msg);
	}
	else if(msg.type == "moveBlob")
	{
		love.moveBlob(msg);
	}
	else if(msg.type == "update")
	{
		love.splatManager.updateGlow(msg.id, msg.val);
	}



});

////////////////////////////////////////////INSTRUCTIONS/////////////////////////////

function setupInstructions()
{
	$('#displayscreen').empty();
	$('#displayscreen').append( " \
		<div id='displayInstructions'> \
		<h1>Conditional Love - Instructions</h1> \
		<h3>1. Take out your phone or laptop</h3> \
		<h3>2. Join the wifi network ConditionalLove</h3> \
		<h3>3. Open a browser</h3> \
		<h3>4. Type the address love.local (no www.)</h3> \
		<h3><i>Ask for help if it doesn't work</i></h3></div>"
	);

	mode = "instruct";
}

function story(img)
{
	$('#displayscreen').empty();
	if(img != "blank")
	{
		$('#displayscreen').append("<div id='storyContainer'><img src=" + img + "></div>");
	}

	mode = "story";
}


///////////////////////////////////////LOVE//////////////////////////////////////////

function setupLove ()
{
	$('#displayscreen').empty();
	var d = $('#displayscreen');
	if(d.length > 0)
	{
		if(love == undefined)
		{
			love = new Love(socket);
		}
		else{
			$('#displayscreen').append( love.renderer.domElement );
			love.canvas = love.renderer.domElement;
		}
	}
	else
	{
		window.setTimeout(setupLove, 10);
	}

	mode = "love";
}

newBranch = function(parent)
{
	//FIXME ... this should be part of love class
	var branch = love.branchManager.addBranch(parent);
	parent.branch = branch;
	love.scene.add(branch.mesh);
}


Love = function(socket)
{
	this.renderer = new THREE.WebGLRenderer();
	this.renderer.setSize( window.innerWidth, window.innerHeight );

	$('#displayscreen').append( this.renderer.domElement );
	this.canvas = this.renderer.domElement;

	var p = this.renderer.domElement.width/this.renderer.domElement.height;
	this.camera = new THREE.OrthographicCamera(-p, p, -1, 1, -100, 100);
	this.camera.position.z = 1;
	this.startTime = new Date().getTime();
	this.accumulator = 0;
	this.ellapsedTime = 0;
	this.resolution = new THREE.Vector2(this.renderer.domElement.width,this.renderer.domElement.height);
	this.fps = 0;

	this.scene = new THREE.Scene();
	this.splatManager = new SplatManager(p, socket);
	this.blobManager = new BlobManager(p, socket);
	this.branchManager = new BranchManager(newBranch);
	this.scene.add(this.splatManager.mesh);


	this.mousePos = new THREE.Vector2();

	var gridGeometry = new THREE.Geometry();

	this.cellNorm = 0.2;
	var l = Math.sqrt(p*p + 1.0) + this.cellNorm;
	var num = l * 2.0/this.cellNorm;

	for(var i = 0; i < num; i++)
	{
		var d = i * this.cellNorm;
		gridGeometry.vertices.push( new THREE.Vector3(-l , -l + d, -10 ) );
		gridGeometry.vertices.push( new THREE.Vector3( l , -l + d, -10 ) );
		gridGeometry.vertices.push( new THREE.Vector3( -l + d, -l , -10 ) );
		gridGeometry.vertices.push( new THREE.Vector3( -l + d, l, -10 ) );
	}

	var g_material = new THREE.LineBasicMaterial( { color: 0x666666 } );
	this.grid = new THREE.LineSegments( gridGeometry, g_material );
	this.grid.visible = true;
	this.scene.add( this.grid);

/////////////////////////////////////

	this.canvas.addEventListener('mousedown', function(e)
	{

		this.isMouseDown = true;

	}.bind(this)
	, false);

	this.canvas.addEventListener("mousemove", function (e)
	{

	}.bind(this)
	, false);

	this.canvas.addEventListener('mouseup', function()
	{
		this.isMouseDown = false;


	}.bind(this)
	, false);

	//////////////////////////////////////////////////////////////////

	this.splat = function(msg)
	{
		this.splatManager.addSplat(msg.val);
		if(msg.val.state >= 4 && msg.val.state_z > 0.9) // utilmately make these flexible
		{
			if(this.splatManager.getEnergy(msg.val._id) >= 0.9)
			{

				var pos = new THREE.Vector2().copy(this.splatManager.playerInfo[msg.val._id].center);
				var blob = this.blobManager.addBlob(pos, msg.val);
				blob.updateState(msg.val.state_z);
				blob.updateUniforms();

				this.splatManager.transform(msg.val._id, function()
				{
							newBranch(blob);
							love.scene.add(blob.mesh);
				});

			}
		}
	}

	this.transform = function(msg)
	{
		for(var i = 0; i < msg.val.length; i++)
		{
			if(this.splatManager.playerInfo[msg.val[i]._id] != undefined)
			{
				if(!this.splatManager.playerInfo[msg.val[i]._id].transform)
				{
					var pos = new THREE.Vector2().copy(this.splatManager.playerInfo[msg.val[i]._id].center);
					var blob = this.blobManager.addBlob(pos, msg.val[i]);
					blob.updateState(msg.val[i].state_z);
					blob.updateUniforms();

					this.splatManager.transform(msg.val[i]._id, function()
					{
								newBranch(blob);
								love.scene.add(blob.mesh);
					});
				}
			}
		}
	}

	this.moveBlob = function(msg)
	{
		if(this.blobManager.blobs[msg.val._id].currStateIdx != msg.val.state)
		{
			this.blobManager.changeState(msg.val._id, msg.val.state);
		}
		this.blobManager.blobs[msg.val._id].updateState(msg.val.state_z);
		this.blobManager.blobs[msg.val._id].updateUniforms();
		this.blobManager.moveBlob(msg.val._id,  msg.val.rot, msg.val.trans * 0.5, msg.val.death);
	}


	//////////////////////////////////////////////////////////////////////////////////////

	this.draw = function()
	{
		var n_et = (new Date().getTime() - this.startTime) * 0.001;
		this.accumulator += (n_et - this.ellapsedTime);
		this.ellapsedTime = n_et;

		if(this.accumulator > 1.0/60)
		{
			framePeriod = this.ellapsedTime - lastFrameTime;
			this.fps = (this.fps + 1.0/framePeriod)/2.0;
			this.accumulator = 0;
			this.splatManager.updateSpots(this.ellapsedTime);
			//debug code
			this.blobManager.update(this.ellapsedTime);
			this.branchManager.update(this.ellapsedTime);
			this.renderer.render( this.scene, this.camera );
			lastFrameTime = this.ellapsedTime;
		}


		requestAnimationFrame(this.draw);
	}.bind(this);

	this.draw();

}
