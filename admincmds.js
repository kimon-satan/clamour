var globals = require('./globals.js');
var helpers = require('./helpers.js');
var votehelpers = require('./votehelpers.js');
var storyhelpers = require('./storyhelpers.js');
require('./libs/utils.js'); //just for generateTempId


exports.response = function(socket)
{
	console.log('an admin connected');

	socket.on('cmd', function(msg)
	{
		if(msg.cmd == "change_mode")
		{
			var options = helpers.parseOptions(msg.args);

			options.mode = msg.mode;

			if(msg.mode == "story")
			{
				globals.DisplayState.mode = "story";
				globals.display.emit('cmd', {type: 'story', cmd: 'change'});
				storyhelpers.startClip();
			}
			else if(msg.mode == "love")
			{
				globals.DisplayState.mode = "love";
				globals.display.emit('cmd', {type: 'love', cmd: 'change'});
			}

			helpers.useRoom(msg)

			.then((rm)=>
			{
				//handle subrooms for story
				if(msg.mode == "story")
				{
					storyhelpers.handleSubrooms(rm, options, msg.cli_id);
				}

				globals.players.to(rm).emit('cmd', {cmd: 'change_mode', value: options});

				//update the disconnected players too
				globals.UserData.update({connected: false},{$set: {mode: msg.mode}});

			});

		}
		else if(msg.cmd == "chat_update")
		{
			globals.players.to(msg.room).emit('cmd', {cmd: 'chat_update', value: msg.value});
		}
		else if(msg.cmd == "chat_clear")
		{
			globals.players.to(msg.room).emit('cmd', {cmd: 'chat_clear'});
		}
		else if(msg.cmd == "chat_newline")
		{
			globals.players.to(msg.room).emit('cmd', {cmd: 'chat_newline'});
		}
		else if(msg.cmd == "story_clear")
		{
			storyhelpers.clear();
		}
		else if(msg.cmd == "story_update")
		{
			storyhelpers.update(msg);
		}
		else if(msg.cmd == "story_newline")
		{
			storyhelpers.newline(msg);
		}
		else if(msg.cmd == "story_next")
		{
			storyhelpers.next(msg);
		}
		else if(msg.cmd == "sreset")
		{
			storyhelpers.reset(msg);
		}
		else if(msg.cmd == "sreload")
		{
			storyhelpers.load(function(resp)
			{
					globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});
		}
		else if (msg.cmd == "sgoto")
		{
			storyhelpers.goto(msg);
		}
		else if(msg.cmd == "lplayers")
		{
			listPlayers( msg.args, msg.room, function(r)
			{
					globals.admin.emit('server_report', {id: msg.cli_id, room: msg.room, isproc: msg.isproc , msg: r}); //same room response
			})
		}
		else if(msg.cmd == "lrooms")
		{
			listRooms( msg.args, msg.room, function(r)
			{
					globals.admin.emit('server_report', {id: msg.cli_id, room: msg.room, isproc: msg.isproc , msg: r}); //same room response
			})
		}
		else if(msg.cmd == "close")
		{
			globals.Rooms.find({room: msg.room}).then((docs)=>
			{
					if(docs.length > 0)
					{
						for(var i =0; i < docs[0].population.length; i++)
						{
							//NB. the player might have disappeared
							if(globals.sockets[docs[0]['population'][i]] != undefined)
							{
								globals.sockets[docs[0]['population'][i]].leave(docs[0]['room']); // all leave the room
							}
						}
						globals.Rooms.remove({room: msg.room});
						globals.UserData.update({},{$pull: {rooms: msg.room}},{multi: true} );
						globals.admin.emit('server_report', {id: msg.cli_id , msg: "room: " +  msg.room + " removed", room: "" });
					}
					else
					{
						globals.admin.emit('server_report', {id: msg.cli_id , msg: "room: " +  msg.room + " can't be found", room: "" });
					}
			});

		}
		else if(msg.cmd == "closeall")
		{
			closeAll(function(){
				globals.admin.emit('server_report', {id: msg.cli_id , msg: "all rooms removed" });
			})
		}
		else if(msg.cmd == "get_rooms")
		{
			globals.Rooms.find({}).then((docs)=>
			{
				if(docs.length < 1)
				{
					globals.admin.emit('server_report', {id: msg.cli_id, msg: "there are no rooms"});
				}
				else
				{
					var res = [];
					for(var i = 0; i < docs.length; i++)
					{
						res.push(docs[i].room);
					}
					globals.admin.emit('server_report', {id: msg.cli_id, suslist: res, susmode: "room", selected: msg.room});
				}
			});
		}
		else if(msg.cmd == "create_room")
		{
			helpers.useRoom(msg, null);
		}
		else if(msg.cmd == "add")
		{
			var options = helpers.parseOptions(msg.args);
			var room;

			if(options.room)
			{
				room = options.room;
			}
			else if(msg.room)
			{
				room = msg.room;
			}
			else
			{
				globals.admin.emit('server_report', {id: msg.cli_id});
				return;
			}

			var selector = helpers.parseFilters(msg.args);

			selector.roomName = room;
			helpers.selectAndJoin(selector)

			.then(_=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id});
			})
		}
		else if(msg.cmd == "sub")
		{
			//create subrooms

			if(msg.room == "" || msg.room == undefined)
			{
				globals.admin.emit('server_report', {id: msg.cli_id});
				return;
			}

			helpers.parseOptions(msg.args, function(options)
			{
				if(options['rooms'] != undefined)
				{
					helpers.subRoom(msg.room, options['rooms'], function(r)
					{
						globals.admin.emit('server_report', {id: msg.cli_id, msg: r});
					})
				}
			});
		}
		else if(msg.cmd == "set")
		{
			var options = helpers.parseOptions(msg.args);
			helpers.useRoom(msg)
			.then((rm)=>
			{
				globals.players.to(rm).emit('cmd', {cmd: 'set_params', value: options});

				//update the disconnected players too
				globals.UserData.update({connected: false},{$set: options});
			});

		}
		else if(msg.cmd == "cleanup")
		{
			//NB. disconnected users can somehow still appear as connected ... look into this
			globals.UserData.find({connected: false}).then((docs)=>
			{
				if(docs == null)return;

				var users = [];

				for(var i = 0; i < docs.length; i++)
				{
					delete globals.sockets[docs[i]._id]; //does this work ?
					delete globals.checkins[docs[i]._id];
					clearInterval(globals.procs[docs[i]._id]);
					globals.UserData.remove(docs[i]._id);
					users.push(docs[i]._id);
				}

				globals.Rooms.update({},{$pull: {population: {$in: users }}},{multi: true}); //remove these users from anyglobals.Rooms
				globals.admin.emit('server_report', {id: msg.cli_id, msg: users.length + " disconnected users removed "});
			});
		}
		else if(msg.cmd == "resetall")
		{
			closeAll(function()
			{
				//clear the Databases
				globals.sockets = {};
				globals.UserData.remove({});
				votehelpers.reset();
				globals.checkins = {};
				globals.admin.emit('server_report', {id: msg.cli_id, msg: "all databases reset", room: ""});
				globals.players.emit('whoareyou'); //causes any connected players to reset

			})
			globals.display.emit('cmd', {type: 'all', cmd: 'clear'});
			globals.DisplayState.mode = "text";
			globals.display.emit("cmd", {type: "text", cmd: "change"});
			globals.storyChapter = 0;
			globals.storyClip = 0;

			var keys = Object.keys(globals.procs);
			for(var i = 0; i < keys.length; i++)
			{
				clearInterval(globals.procs[keys[i]]);
				clearTimeout(globals.procs[keys[i]]);
			}

			helpers.sendSCMessage(
			{
					address: "/resetPhrases",
					args: []
			});
		}
		else if(msg.cmd == "reload")
		{
			helpers.loadSettings()

			.then(_=>{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: ""});
			})

		}
		else if(msg.cmd == "stats")
		{
			//TODO make istats

			globals.UserData.find({},'connected').then((docs)=>{
				var resp = "";
				resp += "players: " + docs.length + "\n";
				var numconnected = 0;

				docs.forEach(function(e)
				{
					if(e.connected)numconnected += 1;
				})

				resp += "connected: " + numconnected;
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});

			});

		}
		else if(msg.cmd == "end")
		{
			helpers.sendSCMessage(
			{
					address: "/allOff",
					args: []
			});
			globals.admin.emit('server_report', {id: msg.cli_id});
			globals.display.emit("cmd", {type: "all", cmd: "end"});
			globals.DisplayState.mode = "end";
			globals.players.emit('cmd', {cmd: 'change_mode', value: {mode: "blank"}});

		}
		else if(msg.cmd == "vnew")
		{
			votehelpers.startVote(msg)

			.then((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			})

			.catch((resp)=>{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});

		}
		else if(msg.cmd == "vman")
		{
			votehelpers.startManual(msg)

			.then((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp.text, isinteract: true, pos: resp.pos});
			})

			.catch((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});

		}
		else if (msg.cmd == "vman_update")
		{
			votehelpers.manualUpdate(msg.value)

			globals.admin.emit('server_report', {id: msg.cli_id, msg: ""});

		}
		else if(msg.cmd == "vend")
		{
			votehelpers.endVote(msg)

			.then((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			})

			.catch((resp)=>{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});
		}
		else if(msg.cmd == "vadd")
		{
			votehelpers.addThreadsToVote(msg)

			.then((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			})

			.catch((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});
		}
		else if (msg.cmd == "vcall")
		{
			votehelpers.startCall(msg);
			globals.admin.emit('server_report', {id: msg.cli_id, msg: ""});
		}
		else if (msg.cmd == "vclear")
		{
			votehelpers.reset();
			globals.admin.emit('server_report', {id: msg.cli_id, msg: ""});
		}
		else if(msg.cmd == "lvotes")
		{
			//make a list of votes
			votehelpers.listVotes().then((doc)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, isproc: msg.isproc , msg: doc});
			})
		}


		//console.log('admin command: ' , msg);

	});

	/////////////////////////////////////////////////////////////////////
	//SOUND COMMANDS

	socket.on('sound_cmd', function(msg)
	{
		if(msg.cmd == "reloadsamples")
		{
			helpers.sendSCMessage(
			{
				address: "/loadSamples",
				args: [globals.settings.samplePath]
			});
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "play")
		{
			var options = helpers.parseOptions(msg.args);
			helpers.playSound(options);
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "killsound")
		{
			helpers.sendSCMessage({
					address: "/allOff",
					args: []
			});
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "setscaddr")
		{
				var options = helpers.parseOptions(msg.args);
				globals.scAddr = options.addr;
				globals.admin.emit('server_report', {id: msg.cli_id, msg: "new address is " + options.addr});
		}
	});

	/////////////////////////////////////////////////////////////////////
	//DISPLAY COMMANDS

	socket.on('disp_cmd', function(msg)
	{

		if(msg.cmd == "dinstruct") //TODO rationalise this
		{
			globals.DisplayState.mode = "text";
			globals.display.emit("cmd", {type: "text", cmd: "change"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dlove")
		{
			globals.DisplayState.mode = "love";
			globals.display.emit("cmd", {type: "love", cmd: "change"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dvote")
		{
			globals.DisplayState.mode = "vote";
			globals.display.emit("cmd", {type: "vote", cmd: "change"});
			votehelpers.updateDisplay();
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dstory")
		{
			globals.DisplayState.mode = "story";
			globals.display.emit("cmd", {type: "story", cmd: "change"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dclear")
		{

			//TODO
			globals.display.emit("cmd", {type: "all", cmd: "clear"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dsplat")
		{
			if(msg.args.length > 0)
			{
					var id = msg.args[0];
			}
			else
			{
					var id = generateTempId(5);
			}

			globals.display.emit("cmd", {type: "love", cmd: "splat", val: {_id: id,
				colSeed: globals.LoveParameters.colSeed,
				colMode: globals.LoveParameters.colMode,
				blobSeed: Math.random(),
				splatPan: (Math.random() * 2.0 - 1.0) * 0.85,
			}});

			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dtransform")
		{

			//transforms splats into blobs
			var selector = helpers.parseFilters(msg.args, msg.room);

			if(selector)
			{
				helpers.selectPlayers(selector, function(uids)
				{
					globals.UserData.find({_id: {$in: uids}, isMobile: false}).then((docs)=>
					{
						globals.display.emit("cmd", {type: "love", cmd: "transform", val: docs});
						globals.admin.emit('server_report', {id: msg.cli_id, msg: docs.length + " splats have been transformed"});
					})
				})
			}
			else
			{
				//use the room population
				globals.Rooms.find({room: msg.room}).then((docs)=>
				{
					if(docs.length > 0)
					{
						globals.UserData.find({_id: {$in: docs[0].population}, isMobile: false}).then((docs2)=>
						{
							globals.display.emit("cmd", {type: "love", cmd: "transform", val: docs2});
							globals.admin.emit('server_report', {id: msg.cli_id, msg: docs2.length + " splats have been transformed"});
						});
					}
					else
					{
						globals.admin.emit('server_report', {id: msg.cli_id, msg: "room not found"});
					}
				})
			}
		}

	})

	socket.on('disconnect', function()
	{
		console.log('an admin disconnected');
	});

}

//////////////////////HELPER FUNCTIONS/////////////////////////
//TODO MOVE TO HELPERS ?


function listPlayers(args, room, cb)
{

	var selector = helpers.parseFilters(args, room);
	if(!selector)selector = {};
	var so = helpers.generateSearchObj(selector);

	//number filters don't work here
	var results = "";

	globals.UserData.find(so).then((docs)=>
	{

		for(var i = 0; i < docs.length; i++)
		{
			var e = docs[i];
			var id = String(e._id);
			var str = id.substring(0,3) + "..." + id.substring(id.length -3, id.length) ;
			str += (e.connected) ? " connected " : " dormant ";
			str += ",  mode: " + e.mode;

			if(e.mode == "love")
			{
				str += ", state: " + Math.round((e.state + e.state_z)*100)/100;
				str += ", maxState: " + e.maxState;
				str += ", isSplat: " + e.isSplat;
				str += ", isMobile: " + e.isMobile;
				str += ", isDying: " + e.isDying;
				str += ", death: " + Math.round(e.death * 100)/100;
				str += ", envTime: " + e.envTime;
			}
			else if(e.mode == "vote")
			{
				var vid = String(e.currentVoteId);
				if(vid.length > 3)
				{
					str += ", id: " + vid.substring(0,3) + "..." + vid.substring(-3);
					if(typeof(e.currentVotePair) == "object" && e.currentVotePair != null)str += ", pair: [" + e.currentVotePair[0] + ", " + e.currentVotePair[1] + "]";
				}


			}
			results += str + "\n";
		}

		cb(results);
	});
}

function listRooms(args, room, cb)
{
	var results = "";
	globals.Rooms.find({})

	.then((docs)=>
	{

		if(docs)
		{
			for(var i = 0; i < docs.length; i++)
			{

				var str = docs[i].room;
				if(docs[i].population) str += " :: " + docs[i].population.length;
				if(docs[i].room == room)str += " *";
				results += str + "\n";
			}

		}
		cb(results);
	});
}

function closeAll(cb)
{
	//all users leave any rooms
	globals.Rooms.find({}).then((docs)=>
	{
		if(docs.length > 0)
		{
			for(var i =0; i < docs[0].population.length; i++)
			{
				if(globals.sockets[docs[0]['population'][i]] != undefined)
				{
					globals.sockets[docs[0]['population'][i]].leave(docs[0]['room']); // all leave the room
				}
			}
		}

		cb();
		globals.Rooms.remove({});
		globals.UserData.update({},{$set: {rooms:[]}},{multi: true} );
	});
}
