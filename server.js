
var globals = require('./globals.js');
var helpers;
var votehelpers;
var storyhelpers;
var admincmds;
var displaycmds;
var playercmds;

for(var i = 2; i < process.argv.length; i++)
{
	var s = process.argv[i];
	if(s.substring(0,2) == "--")
	{
		var arg = s.substring(2);
		if(arg == "nosc")
		{
			globals.NO_SC = true;
		}
		else if(arg == "local")
		{
			globals.IS_LOCAL = true;
		}
		else if(arg == "debug")
		{
			globals.DEBUG = true;
		}
	}
}

const TCP_PORT = 6969;

globals.setup().then(_=>{

	helpers = require('./helpers.js');
	votehelpers = require('./votehelpers.js');
	storyhelpers = require('./storyhelpers.js');
	admincmds = require('./admincmds.js');
	displaycmds = require('./displaycmds.js');
	playercmds = require('./playercmds.js');

	var path = require('path');
	var net  = require('net');
	var osc = require("osc");
	var fs = require('fs');

	//check the various collections exist if not create them

	globals.Presets.findOne({type: "love", name: "default"}).then((doc)=> {

		if(doc == null)
		{
			console.log("creating default parameters");
			globals.Presets.insert({name: "default", options: globals.LoveParameters});
		}

	});

	//load global settings from JSON file
	fs.readFile('config/settings.json', 'utf8', function (err, data)
	{
			if (err) throw err;
			globals.settings = JSON.parse(data);
			storyhelpers.load();
			//exports.loadDictionary(); //needs to be called from elsewhere
	});


	//check whether any existing users rejoin

	setTimeout(function()
	{
		globals.UserData.find({connected: true}, '_id').then((docs)=>
		{
			if(docs != null)
			{

				for(var i = 0; i < docs.length; i++)
				{
					if(globals.sockets[docs[i]._id] == undefined) //no socket has been created
					{
						globals.UserData.update({_id: docs[i]._id}, {$set: {connected: false}});
					}
				}
			}
		});

	},3000);

	setInterval(function()
	{

		time = Date.now();
		var k = Object.keys(globals.checkins);
		for(var i = 0; i < k.length; i++)
		{
				var delta = time - globals.checkins[k[i]];
				if(globals.DEBUG)console.log(k[i], delta);
				if(delta > 20000) //20 secs = dormant
				{
					if(globals.DEBUG)console.log(k[i] + " is dormant");
					try
					{
						if(helpers.validateId(k[i]))
						{
							globals.UserData.update({_id: k[i]},{$set: {connected: false}})
							.catch((err)=>{
								console.log("Error - checkins : " + err);
								globals.checkins[k[i]];
							});
							delete globals.checkins[k[i]];
						}
						else
						{
							// delete globals.checkins[k[i]];
							console.log(globals.checkins[k[i]]);
							throw k[i] + " is not a valid id";
						}
					}
					catch (e)
					{
						console.log("Error - checkins: " + e);
					}

				}
		}


	}, 5000);

	//We define a route handler / that gets called when we hit our website home.

	globals.app.use("/admin",express.static(__dirname + "/admin"));
	globals.app.use("/style",express.static(__dirname + "/style"));
	globals.app.use("/libs",express.static(__dirname + "/libs"));
	globals.app.use("/player",express.static(__dirname + "/player"));
	globals.app.use("/tests",express.static(__dirname + "/tests"));
	globals.app.use("/display",express.static(__dirname + "/display"));
	globals.app.use("/samples",express.static(__dirname + "/samples"));
	globals.app.use("/images",express.static(__dirname + "/images"));
	globals.app.use("/fonts",express.static(__dirname + "/fonts"));
	globals.app.use("/config",express.static(__dirname + "/config"));

	//three types of user
	 globals.app.get('/admin', function(req, res){
		 res.sendFile(__dirname + '/admin/admin.html');
	 });
	 //
	 globals.app.get('/display', function(req, res){
		 res.sendFile(__dirname + '/display/display.html');
	 });
	//
	globals.app.get('/tests', function(req, res){
		res.sendFile(__dirname + '/tests/tests.html');
	});

	//
	 globals.app.get('/', function(req, res){
		 res.sendFile(__dirname + '/player/player.html');
	 });

	globals.admin.on('connection', admincmds.response);
	globals.display.on('connection', displaycmds.response);
	globals.players.on('connection', playercmds.response);

	//We make the http server listen
	http.listen(globals.port, function () {
	  console.log('Server listening at port %d', globals.port);
	});

	//////////////////////////TCP SERVER//////////////////////////////

	if(globals.IS_LOCAL)
	{
		//an OSC handler
		globals.udpPort.on('message', incomingHandler);

	}
	else
	{
		net.createServer(function(sock)
		{

				// We have a connection - a socket object is assigned to the connection automatically
				console.log('CONNECTED: ' + sock.remoteAddress +':'+ sock.remotePort);
				globals.tcpSocks[sock.remotePort.toString()] = sock;

				// Add a 'data' event handler to this instance of socket
				sock.on('data', incomingHandler);

				// Add a 'close' event handler to this instance of socket
				sock.on('close', function(data)
				{
					console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
					delete globals.tcpSocks[sock.remotePort.toString()];
				});


		}).listen(TCP_PORT, "localhost");

		console.log('TCP server listening on ' + TCP_PORT);
	}
});






//////////////MESSAGE HANDLER////////////////////////////////

function incomingHandler(msg)
{

	if(!globals.IS_LOCAL)
	{
		var s = msg.toString();
		var r = /\{.*?\}/g
		var m = r.exec(s);
		while(m != null)
		{
			try
			{
				msg = JSON.parse(m[0],s);

				if(msg.address == "/poll")
				{
					 globals.display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
				}

				if(msg.address == "/phraseComplete")
				{
					votehelpers.handlePhraseComplete(msg).catch((err)=>
					{
						console.log(err);
					});
				}

				if(msg.address == "/resumeVote") //TODO change name
				{
					globals.players.emit('cmd',{cmd: 'resume_vote'});
					//allows other votes to happen
					globals.currentConcludedVote = null;
				}

				if(msg.address == "/winSampleDone")
				{
					votehelpers.concludeDisplayAndPlayers();
				}

				m = r.exec(s);
			}
			catch(e)
			{
				console.log(m);
				console.log(e);
			}
		}


	}



}
