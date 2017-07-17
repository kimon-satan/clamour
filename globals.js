console.log("importing globals");

express = require('express');
exports.app = express();
http = require('http').Server(exports.app);
var fs = require('fs');


//simple db using monk & mongodb
exports.URL = 'localhost:27017/ConditionalLove';
exports.MONK = require('monk');
exports.DB = exports.MONK(exports.URL);

exports.DB.then(() => {
	console.log('Connected correctly to server')
})

exports.UserData = exports.DB.get('UserData');
exports.Rooms = exports.DB.get('Rooms'); //This might become a variable ?
exports.Presets = exports.DB.get('Presets'); //not using so far - probably should just be json

exports.LoveParameters =
{
		state: 0,
		state_z: 0,
		isSplat: false,
		isMobile: false,
		isDying: false,
		maxState: 2,
		envTime: 8,
		blobSeed: 0.01,
		colSeed: 0.01,
		colMode: 0, //0 -> 3 (int),
		death: 0
}

io = require('socket.io')(http);
exports.admin = io.of('/admin');
exports.display = io.of('/display');
exports.players = io.of('/player');
exports.sockets = {};
exports.checkins = {};

var osc = require("osc");

exports.udpPort = new osc.UDPPort({
		localAddress: "127.0.0.1",
		localPort: 12345
});

exports.udpPort.open();

//update the graphics

exports.udpPort.on('message', (msg, rinfo) => {

		if(msg.address == "/poll")
		{
			 exports.display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
		}

});

//load global settings from JSON

fs.readFile('config/settings.json', 'utf8', function (err, data)
{
		if (err) throw err;
		exports.settings = JSON.parse(data);

		//load the audio samples
		exports.udpPort.send(
		{
			address: "/loadSamples",
			args: [exports.settings.samplePath]
		},
		"127.0.0.1", 57120);

		//load the story object

		fs.readFile(exports.settings.storyPath, 'utf8', function (err, data)
		{
			exports.story = JSON.parse(data);
		});

});

setInterval(function(){

	time = Date.now();

	Object.keys(exports.checkins).forEach(function(k)
	{
			var delta = time - exports.checkins[k];
			if(exports.DEBUG)console.log(k, delta);
			if(delta > 20000) //20 secs = dormant
			{
				if(exports.DEBUG)console.log(k + " is dormant");
				exports.UserData.update({_id: k},{$set: {connected: false}});
				delete exports.checkins[k];
			}
	})


}, 5000);
