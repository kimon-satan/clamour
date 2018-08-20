console.log("importing globals");

express = require('express');
exports.app = express(); //FIXME  this is all shifty
http = require('http').Server(exports.app);
io = require('socket.io')(http);
var osc = require("osc");

//FLAGS should come from CL args
//exports.DEBUG = true;
//exports.NO_SC = true;
exports.IS_LOCAL = true;


exports.port = (exports.IS_LOCAL) ? 8000 : 80;
exports.tcpSocks = {};

//simple db using monk & mongodb
exports.MONK = require('monk');
exports.URL = 'localhost:27017/ConditionalLove';
exports.DB = exports.MONK(exports.URL);

exports.DB.then(() => {
	console.log('Connected correctly to server')
})

exports.DisplayState = {
	mode: "instruct",
	storyMedia: "blank",
	videoProgress: 0,
	videoLoadProgress: 0
}

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




exports.admin = io.of('/admin');
exports.display = io.of('/display');
exports.players = io.of('/player');
exports.sockets = {};
exports.checkins = {};
exports.checkinProcs = {}; //checkin processes only
exports.procs = {}; //all timeout and interval processes - excluding checkins

exports.pendingVotes = [];
exports.voteDisplaySlots =
{
	a: [0,0,0,0],
	b: [0,0,0,0]
};

exports.currentConcludedVote = null;
exports.scAddr = "127.0.0.1";

if(exports.IS_LOCAL)
{
	exports.udpPort = new osc.UDPPort({
			localAddress: "127.0.0.1",
			localPort: 12345
	});

	exports.udpPort.open();
}
