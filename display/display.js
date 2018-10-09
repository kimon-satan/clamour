var globals;
var love;
var voteDisplayer, textDisplayer;
var story;
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

	textDisplayer = new TextDisplayer(simple_canvas);
	voteDisplayer = new VoteDisplayer(simple_canvas);
	love = new Love(socket, threejs_canvas);
	story = new Story(simple_canvas);

	textDisplayer.setActive(true);

})


socket.on('cmd', function(msg)
{

	//console.log(msg);
	if (msg.type == "instruct")
	{
		$('#simple_display').show();
		$('#threejs_display').hide();
		voteDisplayer.setActive(false);
		story.setActive(false);
		love.setActive(false);
		textDisplayer.setActive(true);
	}
	else if (msg.type == "love" )
	{
		$('#simple_display').hide();
		$('#threejs_display').show();
		voteDisplayer.setActive(false);
		story.setActive(false);
		love.setActive(true);
		textDisplayer.setActive(false);
		console.log("love");
	}
	else if (msg.type == "story" )
	{
		console.log("story");
		$('#simple_display').show();
		$('#threejs_display').hide();
		voteDisplayer.setActive(false);
		love.setActive(false);
		story.setActive(true);
		textDisplayer.setActive(false);
		//story(msg);
		mode = "story";
	}
	else if (msg.type == "vote" )
	{

		if(msg.cmd == "reset" || msg.cmd == "new")
		{
			voteDisplayer.setActive(true);
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
			textDisplayer.setActive(false);
			voteDisplayer.setActive(false);
			love.setActive(true);
			love.splatManager.clearAll();
			love.blobManager.clearAll(love.scene);
			love.branchManager.clearAll(love.scene);
			love.grid.visible = true;
		}
		else
		{
			//
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

// TODO:

//1. clean up commands interface
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
