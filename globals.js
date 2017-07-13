console.log("importing globals");

express = require('express');
exports.app = express();
http = require('http').Server(exports.app);

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

exports.AllOptions =
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
