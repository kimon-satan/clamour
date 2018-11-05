var globals = require('./globals.js');
var helpers = require('./helpers.js');
//var votehelpers = require('./votehelpers.js');

exports.response = function(socket)
{


	console.log("a display connected");


	socket.on('addTone', function(msg){

		var args = [];
		var k = Object.keys(msg);

		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(msg[k[i]]);
		}

		helpers.sendSCMessage({
				address: "/addTone",
				args: args,
		});

	})

	socket.on('updateTone', function(msg)
	{

		var args = [];

		msg.amp *= globals.settings.loveAudioSettings.toneMul;
		var k = Object.keys(msg);

		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(msg[k[i]]);
		}

		helpers.sendSCMessage({
				address: "/updateTone",
				args: args,
		});

	})

	socket.on('endTone', function(msg){

		//console.log("endTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendSCMessage({
				address: "/endTone",
				args: args,
		});

		globals.players.to(msg.id).emit('cmd', {cmd: 'set_params', value: {isMobile: true, isSplat: false}});

	})

	socket.on('startCrawler', function(msg){

		//console.log("startCrawler", msg);

		var args = [];

		var k = Object.keys(msg);

		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(msg[k[i]]);
		}

		helpers.sendSCMessage({
				address: "/startCrawler",
				args: args,
		});

	})

	socket.on('updateCrawler', function(msg){

		var args = [];

		msg.mul = globals.settings.loveAudioSettings.crawlerMul;

		var k = Object.keys(msg);

		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(msg[k[i]]);
		}

		helpers.sendSCMessage({
				address: "/updateCrawler",
				args: args,
		});

	})

	socket.on('endCrawler', function(msg){

		var args = [];

		var k = Object.keys(msg);

		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(msg[k[i]]);
		}

		helpers.sendSCMessage({
				address: "/endCrawler",
				args: args,
		});

	})

	socket.on('transTone', function(msg){


		var args = [];

		msg.amp = globals.settings.loveAudioSettings.transAmp;
		var k = Object.keys(msg);

		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(msg[k[i]]);
		}

		helpers.sendSCMessage({
				address: "/transTone",
				args: args,
		});

		globals.players.to(msg.id).emit('cmd', {cmd: 'set_params', value: {isSplat: false}});
	})


	//TODO - more here depending on version
	socket.emit("hello", {state: globals.DisplayState, settings: globals.settings});

	if(globals.DisplayState.mode == "vote")
	{
		votehelpers.updateDisplay();
	}

}
