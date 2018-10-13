var globals;
var displays;

var mode;
var lastFrameTime, framePeriod, fps;
var simple_canvas;
var threejs_canvas;
lastFrameTime = 0;

var socket = io('/display');

$('document').ready(function()
{

	$.getJSON("/config/settings.json", function(json)
	{
		globals = json;
	});

	simple_canvas = $('#simple_display')[0];
	$('#simple_display').attr('width', innerWidth);
	$('#simple_display').attr('height', innerHeight);
	$('#simple_display').show();
	threejs_canvas = $('#threejs_display')[0];
	$('#threejs_display').attr('width', innerWidth);
	$('#threejs_display').attr('height', innerHeight);
	$('#threejs_display').hide();

	displays = {};


	displays.text = new TextDisplay(simple_canvas);
	displays.vote = new VoteDisplay(simple_canvas);
	displays.love = new LoveDisplay(socket, threejs_canvas);
	displays.story = new StoryDisplay(simple_canvas);

	displays.text.setActive(true);

})


socket.on('cmd', function(msg)
{
	console.log(msg);

	if(msg.cmd == "change")
	{
		changeDisplay(msg.type)
	}
	else if(msg.type == "all")
	{
		var k = Object.keys(displays);
		for(var i = 0; i < k.length; i++)
		{
			displays[k[i]].cmd(msg);
		}
	}
	else
	{
		displays[msg.type].cmd(msg);
	}

});

function changeDisplay(display)
{
	var k = Object.keys(displays);
	for(var i = 0; i < k.length; i++)
	{
		if(k[i] == display)
		{
			console.log("set active" , k[i])
			displays[k[i]].setActive(true);
		}
		else
		{
			displays[k[i]].setActive(false);
		}
	}

	if(display == "love")
	{
		$('#simple_display').hide();
		$('#threejs_display').show();
	}
	else
	{
		$('#simple_display').show();
		$('#threejs_display').hide();
	}
}

// TODO:
//2. cross-fading images
//3. screen resize event
//4. cookies/local storage to save state (at least some of it)

////////////////////////////////////////////INSTRUCTIONS/////////////////////////////


// function story(msg)
// {
//
// 	//console.log(msg);
//
// 	if(msg.blank)
// 	{
// 		//$('#displayscreen').empty(); //just empty the screen
// 	}
// 	else if(msg.img)
// 	{
// 		// $('#displayscreen').empty();
// 		// var imgtag = $("<img src=" + msg.img + ">");
// 		// var imgdiv = $("<div id='storyContainer'></div>");
//
//
// 		//imgtag.css('width', innerWidth);
// 		//imgtag.css('height', innerHeight);
//
// 		//imgdiv.append(imgtag);
// 		//$('#displayscreen').append(imgdiv);
// 	}
//
// 	mode = "story";
// }


///////////////////////////////////////LOVE//////////////////////////////////////////



newBranch = function(parent)
{
	//FIXME ... this should be part of love class
	var branch = love.branchManager.addBranch(parent);
	parent.branch = branch;
	love.scene.add(branch.mesh);
}
