console.log("importing globals");

express = require('express');
exports.app = express();
http = require('http').Server(exports.app);

//exports.DEBUG = true;
exports.NO_SC = true;

//simple db using monk & mongodb
exports.URL = 'localhost:27017/ConditionalLove';
exports.MONK = require('monk');
exports.DB = exports.MONK(exports.URL);
exports.DB .addMiddleware(require('monk-middleware-debug'))

exports.DB.then(() => {
	console.log('Connected correctly to server')
})

exports.UserData = exports.DB.get('UserData');
exports.Votes = exports.DB.get('Votes');
exports.Rooms = exports.DB.get('Rooms'); //This might become a variable ?
exports.Presets = exports.DB.get('Presets'); //not using so far - probably should just be json

exports.usrobj =
{
	mode: "wait",
	connected: true,
	rooms: [],
	groups: [],
	currentVoteId: -1,
	currentVotePair: [0,0]
}

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

exports.fonts = [
	"AlexBrush",
	"Pacifico",
	"Chunkfive",
	"KaushanScript",
	"Ostrich",
	"Oswald",
	"Arial",
	"Times"];

exports.fontColours = [
	"255,0,0",
	"0,255,0",
	"255,255,0",
	"255,0,255",
	"0,255,255",
	"255,180,0",
	"0,150,0",
	"100,100,255"
];

var k = Object.keys(exports.LoveParameters);

for(var i = 0; i < k.length; i++)
{
	exports.usrobj[k[i]] = exports.LoveParameters[k[i]];
}

exports.storyCurrText = [""];
exports.storyNumChars = 0;
exports.storyRooms = [];



io = require('socket.io')(http);
exports.admin = io.of('/admin');
exports.display = io.of('/display');
exports.players = io.of('/player');
exports.sockets = {};
exports.checkins = {};
exports.procs = {}; //all timeout and interval processes

exports.pendingVotes = [];
exports.voteDisplayIndexes = {}; //TODO this should go

exports.voteDisplaySlots =
{
	a: [0,0,0,0],
	b: [0,0,0,0]
};

exports.currentConcludedVote = null;

var osc = require("osc");

exports.udpPort = new osc.UDPPort({
		localAddress: "127.0.0.1",
		localPort: 12345
});

exports.udpPort.open();
