express = require('express');
exports.app = express();
http = require('http').Server(exports.app);
io = require('socket.io')(http);
var osc = require("osc");
var deepcopy = require('deepcopy');

exports.MONK = require('monk');
exports.URL = 'localhost:27017/ConditionalLove';

exports.tcpSocks = {};
exports.settings;
//FLAGS come from CL args
exports.DEBUG = false;
exports.NO_SC = false;
exports.IS_LOCAL = false;

exports.DisplayState =
{
	mode: "instruct",
	storyMedia: "blank"
}


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

exports.defaultVote = {
	pair: ["",""],
	available: [[],[]],
	scores: [0,0],
	voting: [],
	voted: [],
	notvoted: 0,
	population: 0,
	num: 0,
	room: "",
	pos: "a0",
	open: false,
	winnerIdx: -1,
	die: false,
	infinite: false,
	force: false,
	bing: true,
	rig: undefined,
	lock: false
}

var k = Object.keys(exports.LoveParameters);

for(var i = 0; i < k.length; i++)
{
	exports.usrobj[k[i]] = exports.LoveParameters[k[i]];
}

exports.storyCurrText = [""];
exports.storyNumChars = 0;
exports.storyRooms = [];

exports.welcomeRoom;
exports.sockets = {};
exports.checkins = {};
exports.checkinProcs = {}; //checkin processes only
exports.procs = {}; //all timeout and interval processes - excluding checkins

exports.pendingVotes = [];

exports.currentConcludedVote = null;
exports.scAddr = "127.0.0.1";

exports.setup = function()
{

	exports.port = (exports.IS_LOCAL) ? 8000 : 80;

	exports.admin = io.of('/admin');
	exports.display = io.of('/display');
	exports.players = io.of('/player');

	if(exports.IS_LOCAL)
	{
		exports.udpPort = new osc.UDPPort({
				localAddress: "127.0.0.1",
				localPort: 12345
		});

		exports.udpPort.open();
	}

	exports.DB = exports.MONK(exports.URL);
	return exports.DB.then(_ =>
	{
		console.log('Connected correctly to server');
		exports.UserData = exports.DB.get('UserData');
		exports.Votes = exports.DB.get('Votes');
		exports.Rooms = exports.DB.get('Rooms'); //This might become a variable ?
		exports.Presets = exports.DB.get('Presets'); //not using so far - probably should just be json

		return Promise.resolve();
	})

	.then(_=>
	{
		//create votes if they don't exist

		var positions = ["a0", "a1", "a2", "a3", "b0", "b1", "b2", "b3"];
		var p = Promise.resolve();
		var c = 0;

		for(var i = 0; i < positions.length; i++)
		{
			p = p.then(_=>{

				return exports.Votes.findOne({pos: positions[c]});

			});

			p = p.then((doc)=>
			{
				if(doc == null)
				{
					console.log("creating new vote record " + positions[c]);

					let v = deepcopy(exports.defaultVote);
					v.pos = positions[c];
					exports.Votes.insert(v);
				}
				c++;
			})
		}

	})

}
