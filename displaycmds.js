var globals = require('./globals.js');
var helpers = require('./helpers.js');

exports.response = function(socket)
{

	console.log("a display connected");

	socket.on('addTone', function(msg){

		//console.log("addTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendTCPMessage({
				address: "/addTone",
				args: args,
		});

	})

	socket.on('updateTone', function(msg){

		//console.log("updateTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendTCPMessage({
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

		helpers.sendTCPMessage({
				address: "/endTone",
				args: args,
		});

		globals.players.to(msg.id).emit('cmd', {cmd: 'set_params', value: {isMobile: true, isSplat: false}});

	})

	socket.on('startCrawler', function(msg){

		//console.log("startCrawler", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendTCPMessage({
				address: "/startCrawler",
				args: args,
		});

	})

	socket.on('updateCrawler', function(msg){

		//console.log("updateCrawler", msg);
		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendTCPMessage({
				address: "/updateCrawler",
				args: args,
		});

	})

	socket.on('endCrawler', function(msg){

		//console.log("endCrawler", msg);
		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendTCPMessage({
				address: "/endCrawler",
				args: args,
		});

	})

	socket.on('transTone', function(msg){

		//console.log("transTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		helpers.sendTCPMessage({
				address: "/transTone",
				args: args,
		});
	})

	socket.on('vidUpdate', function(msg){
		globals.DisplayState.videoProgress = msg;
	})

	socket.on('vidLoading', function(msg){
		globals.DisplayState.videoLoadProgress = msg;
	})

	// socket.on('vidLoaded', function(){
	// 	globals.DisplayState.videoLoadProgress = "loaded";
	// })
}
