console.log("importing globals");

express = require('express');
exports.app = express();
http = require('http').Server(exports.app);
io = require('socket.io')(http);


//exports.DEBUG = true;
//exports.NO_SC = true;

exports.port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}

if(typeof(mongoURL) == "undefined")
{
	exports.URL = "localhost:27017/ConditionalLove";
}
else {
	exports.URL = mongoURL;
}

//simple db using monk & mongodb

exports.MONK = require('monk');
exports.DB = exports.MONK(exports.URL);
exports.DB .addMiddleware(require('monk-middleware-debug'))

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

var osc = require("osc");

exports.udpPort = new osc.UDPPort({
		localAddress: "127.0.0.1",
		localPort: 12345
});

exports.udpPort.open();
