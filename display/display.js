// TODO:
//3. screen resize event
//4. cookies/local storage to save state (at least some of it)

var settings;
var displays;

var mode;
var lastFrameTime, framePeriod, fps;
var simple_canvas;
var threejs_canvas;
lastFrameTime = 0;

var socket = io('/display');

$('document').ready(function()
{
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

	displays.text.setActive(true);

	var p = new Promise(function(resolve, reject)
	{
		$.getJSON("/config/settings.json", function(json)
		{
			resolve(json);
		});
	})

	.then((doc)=>
	{
		settings = doc;

		return new Promise(function(resolve, reject)
		{
			$.getJSON("/" + settings.storyPath, function(json)
			{
				resolve(json);
			});
		})
	})

	.then((doc)=>
	{
		displays.story = new StoryDisplay(settings.imagePath, doc, simple_canvas);
	})




})


socket.on('cmd', function(msg)
{

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
