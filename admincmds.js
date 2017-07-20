var globals = require('./globals.js');
var helpers = require('./helpers.js');
require('./libs/utils.js'); //just for generateTempId

exports.response = function(socket)
{
	console.log('an admin connected');

	socket.on('cmd', function(msg)
	{
		if(msg.cmd == "change_mode")
		{
			helpers.parseOptions(msg.args, function(options)
			{
				options.mode = msg.mode;

				if(msg.mode == "story")
				{
					helpers.startStoryClip();
				}
				else if(msg.mode == "love")
				{
					globals.display.emit('cmd', {type: 'love'});
				}

				//handle users
				helpers.useRoom(msg, function(rm)
				{
					//handle display ... TODO - perhaps an override for no display switching
					globals.players.to(rm).emit('cmd', {cmd: 'change_mode', value: options});
				});
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
		else if(msg.cmd == "story_update")
		{

			globals.storyCurrText[globals.storyCurrText.length - 1] = msg.value;

			//get the story text ... compare original with
			if(globals.story[globals.storyStage].clips[globals.storyClip].texts != undefined)
			{
				var num_chars = 0;
				for(var i = 0; i < globals.storyCurrText.length; i++)
				{
					num_chars += globals.storyCurrText[i].length;
				}

				var txts = globals.story[globals.storyStage].clips[globals.storyClip].texts;
				var txtStats = globals.story[globals.storyStage].clips[globals.storyClip].textStats;

				if(txts.length > 1)
				{
					//TODO implement new lines for dummy text
					console.log(txtStats[0].total, num_chars);
					var prog = Math.min(1.0,num_chars/(txtStats[0].total * 0.9)); // slightly optimisitic to account for typos etc
					console.log(prog);
					// for(var i = 1; i < txts.length; i++)
					// {
					// 	var l = prog * txts[i].length;
					// 	globals.players.to(msg.room).emit('cmd', {cmd: 'chat_update', value: txts[i].substring(0,l)});
					// }
				}
				else
				{
					globals.players.to(msg.room).emit('cmd', {cmd: 'chat_update', value: msg.value});
				}
			}
		}
		else if(msg.cmd == "story_newline")
		{
			globals.storyCurrText.push("");
		}
		else if(msg.cmd == "story_next")
		{
			helpers.incrementStoryClip();
			helpers.startStoryClip(msg.room);
		}
		else if(msg.cmd == "storyreset")
		{
			globals.storyStage = 0;
			globals.storyClip = 0;
			globals.storyCurrText = [""];
			helpers.startStoryClip(msg.room);
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "reloadstory")
		{
			helpers.loadStory(function(resp)
			{
					globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});
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
		else if(msg.cmd == "sub")
		{
			if(msg.room == "" || msg.room == undefined)
			{
				globals.admin.emit('server_report', {id: msg.cli_id});
				return;
			}

			helpers.parseOptions(msg.args, function(options)
			{
				if(options['rooms'] != undefined)
				{
					globals.Rooms.find({room: msg.room}).then((docs)=>
					{
						if(docs.length > 0)
						{
							var n = Math.max(2, parseInt(options['rooms']));
							var numPerSub = Math.ceil(docs[0].population.length / n);
							var subPops = [];
							while(docs[0].population.length > 0)
							{
								//TODO check when non divisible
								subPops.push(docs[0].population.splice(0,numPerSub));
							}

							for(var i =0; i < subPops.length; i++)
							{
								helpers.joinRoom(subPops[i], msg.room + "_" + i);
							}

							globals.admin.emit('server_report', {msg: n + " subrooms of " + msg.room + " created", id: msg.cli_id});
						}
						else
						{
							globals.admin.emit('server_report', {id: msg.cli_id});
						}

					})
				}
			});
		}
		else if(msg.cmd == "set")
		{
			helpers.parseOptions(msg.args, function(options)
			{
				helpers.useRoom(msg, function(rm)
				{
					globals.players.to(rm).emit('cmd', {cmd: 'set_params', value: options});
				});
			});
		}
		else if(msg.cmd == "cleanup")
		{
			//NB. disconnected users can somehow still appear as connected ... look into this
			globals.UserData.find({connected: false}).then((docs)=>
			{
				if(docs == null)return;

				var users = [];

				docs.forEach(function(e)
				{
					delete globals.sockets[e._id]; //does this work ?
					delete globals.checkins[e._id];
					clearInterval(globals.procs[e._id]);
					globals.UserData.remove(e._id);
					users.push(e._id);
				});

				globals.Rooms.update({},{$pull: {population: {$in: users }}}); //remove these users from anyglobals.Rooms
				globals.admin.emit('server_report', {id: msg.cli_id, msg: docs.length + " disconnected users removed "});
			});
		}
		else if(msg.cmd == "resetall")
		{
			closeAll(function()
			{
				//clear the Databases
				globals.sockets = {};
				globals.UserData.remove({});
				globals.admin.emit('server_report', {id: msg.cli_id, msg: "all databases reset", room: ""});
				globals.players.emit('whoareyou'); //causes any connected players to reset
				Object.keys(globals.procs).forEach(function(id)
				{
					clearInterval(globals.procs);
				});
			})
			globals.display.emit("cmd", {type: "instruct"});
			globals.display.emit('cmd', {type: 'clear_display'});
			globals.storyStage = 0;
			globals.storyClip = 0;
		}
		else if(msg.cmd == "stats")
		{

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
			globals.udpPort.send(
			{
					address: "/allOff",
					args: []
			},
			"127.0.0.1", 57120);
			globals.admin.emit('server_report', {id: msg.cli_id});
			globals.display.emit("cmd", {type: "end"});
			globals.players.emit('cmd', {cmd: 'change_mode', value: {mode: "blank"}});

		}


		//console.log('admin command: ' , msg);

	});

	/////////////////////////////////////////////////////////////////////
	//SOUND COMMANDS

	socket.on('sound_cmd', function(msg)
	{
		if(msg.cmd == "reloadsamples")
		{
			globals.udpPort.send(
			{
				address: "/loadSamples",
				args: [globals.settings.samplePath]
			},
			"127.0.0.1", 57120);
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "play")
		{
			helpers.parseOptions(msg.args, function(options)
			{
				helpers.playSound(options);
				globals.admin.emit('server_report', {id: msg.cli_id});
			});
		}
		else if(msg.cmd == "killsound")
		{
			globals.udpPort.send({
					address: "/allOff",
					args: []
			}, "127.0.0.1", 57120);
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
	});

	/////////////////////////////////////////////////////////////////////
	//DISPLAY COMMANDS

	socket.on('disp_cmd', function(msg)
	{

		if(msg.cmd == "dinstruct")
		{
			globals.display.emit("cmd", {type: "instruct"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dlove")
		{
			globals.display.emit("cmd", {type: "love"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dstory")
		{
			globals.display.emit("cmd", {type: "story"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dclear")
		{
			globals.display.emit("cmd", {type: "clear"});
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

			globals.display.emit("cmd", {type: "splat", val: {_id: id,
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
						globals.display.emit("cmd", {type: "transform", val: docs});
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
							globals.display.emit("cmd", {type: "transform", val: docs2});
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


function listPlayers(args, room, cb)
{

	var selector = helpers.parseFilters(args, room);
	if(!selector)selector = {};
	var so = helpers.generateSearchObj(selector);

	//number filters don't work here
	var results = "";

	globals.UserData.find(so).then((docs)=>
	{

		docs.forEach(function(e)
		{
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
			results += str + "\n";
		});
		cb(results);
	});
}

function listRooms(args, room, cb)
{
	var results = "";
	globals.Rooms.find({}).then((docs)=>
	{
		docs.forEach(function(e)
		{
			var str = e.room + " :: " + e.population.length;
			if(e.room == room)str += " *";
			results += str + "\n";
		});
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