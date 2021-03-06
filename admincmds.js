var globals = require('./globals.js');
var helpers = require('./helpers.js');
var votehelpers = require('./votehelpers.js');
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

				//handle subrooms for story
				helpers.useRoom(msg, function(rm)
				{
					if(msg.mode == "story")
					{
						handleStorySubrooms(rm, options, msg.cli_id);
					}
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
		else if(msg.cmd == "story_clear")
		{
			var txts = globals.story[globals.storyChapter].clips[globals.storyClip].texts;
			if(txts.length > 1 && globals.storyRooms.length > 1)
			{
				//send the clear to room 0
				globals.storyCurrText.push("");
				globals.players.to(globals.storyRooms[0]).emit('cmd', {cmd: 'chat_clear'});

				for(var i = 1; i < globals.storyRooms.length; i++)
				{
					var tidx = i%txts.length;
					if(tidx == 0)
					{
						//send the clear
						globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_clear'});
					}
				}
			}
			else
			{
				globals.storyCurrText.push("");
				globals.players.to(msg.room).emit('cmd', {cmd: 'chat_clear'});
			}

		}
		else if(msg.cmd == "story_update")
		{

			if(globals.story[globals.storyChapter].clips[globals.storyClip].texts != undefined) //check this clip has text
			{
				var txts = globals.story[globals.storyChapter].clips[globals.storyClip].texts;

				if(txts.length > 1 && globals.storyRooms.length > 1) //we only need to bother if there are alternative texts
				{

					//the first room gets the original text
					globals.players.to(globals.storyRooms[0]).emit('cmd', {cmd: 'chat_update', value: msg.value});

					globals.storyCurrText[globals.storyCurrText.length - 1] = msg.value;

					//count the characters
					var num_chars = 0;
					for(var i = 0; i < globals.storyCurrText.length; i++)
					{
						num_chars += globals.storyCurrText[i].length;
					}

					//TODO implement new lines for dummy text
					var prog = Math.min(1.0,num_chars/(txts[0].length * 0.9)); // slightly optimisitic to account for typos etc

					for(var i = 1; i < globals.storyRooms.length; i++)
					{

						//new line and clear will also need to work this out
						var tidx = i%txts.length;
						if(tidx == 0)
						{
							//send the original text
							globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_update', value: msg.value});
						}
						else if(num_chars > globals.storyNumChars)//alternative texts only go forwards ... delete is ignored
						{

							var l = prog * txts[tidx].length;
							var n = txts[tidx].substring(0,l);
							r = /[%$]{1}([^%^$]*?)$/;
							res = r.exec(n);

							//determine room to send

							if(res == null)
							{
								//before any special char
								globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_update', value: n});
							}
							else if(res[0] == "%")
							{
								globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_newline'});
							}
							else if(res[0] == "$")
							{
								globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_clear'});
							}
							else
							{
								globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_update', value: res[1]});
							}
						}


					}

					if(num_chars > globals.storyNumChars)globals.storyNumChars = num_chars;
				}
				else
				{
					//otherwise just send to all
					globals.players.to(msg.room).emit('cmd', {cmd: 'chat_update', value: msg.value});
				}

			}
		}
		else if(msg.cmd == "story_newline")
		{
			var txts = globals.story[globals.storyChapter].clips[globals.storyClip].texts;
			//catch error here
			if(txts.length > 1 && globals.storyRooms.length > 1)
			{
				//send the new line to room 0
				globals.storyCurrText.push("");
				globals.players.to(globals.storyRooms[0]).emit('cmd', {cmd: 'chat_newline'});

				for(var i = 1; i < globals.storyRooms.length; i++)
				{
					var tidx = i%txts.length;
					if(tidx == 0)
					{
						//send the return
						globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_newline'});
					}
				}
			}
			else
			{
				globals.storyCurrText.push("");
				globals.players.to(msg.room).emit('cmd', {cmd: 'chat_newline'});
			}

		}
		else if(msg.cmd == "story_next")
		{
			helpers.incrementStoryClip();
			helpers.startStoryClip(msg.room);
		}
		else if(msg.cmd == "sreset")
		{
			globals.storyChapter = 0;
			globals.storyClip = 0;
			helpers.startStoryClip(msg.room);
			globals.admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "sreload")
		{
			helpers.loadStory(function(resp)
			{
					globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});
		}
		else if (msg.cmd == "sgoto")
		{
			helpers.parseOptions(msg.args, function(options){
				if(options.chapter != undefined)
				{

					if(!isNaN(options.chapter) && options.chapter != '')
					{
						globals.storyChapter = Math.max(0,options.chapter);
						globals.storyClip = 0;
						helpers.startStoryClip(msg.room);
						globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter " + options.chapter + " : " + globals.story[options.chapter].name});
						return;
					}
					else {

						for(var i = 0; i < globals.story.length; i++)
						{
								if(globals.story[i].name == options.chapter)
								{
									globals.storyChapter = i;
									globals.storyClip = 0;
									helpers.startStoryClip(msg.room);
									globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter " + i + " : " + globals.story[i].name});
									return;
								}
						}

					}

				}

				globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter not found"});
			})
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
					helpers.subRoom(msg.room, options['rooms'], function(r)
					{
						globals.admin.emit('server_report', {id: msg.cli_id, msg: r});
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
				globals.Votes.remove({});
				globals.voteDisplaySlots =
				{
					a: [0,0,0,0],
					b: [0,0,0,0]
				};
				globals.checkins = {};
				globals.admin.emit('server_report', {id: msg.cli_id, msg: "all databases reset", room: ""});
				globals.players.emit('whoareyou'); //causes any connected players to reset

			})
			globals.display.emit("cmd", {type: "instruct"});
			globals.display.emit('cmd', {type: 'clear_display'});
			globals.storyChapter = 0;
			globals.storyClip = 0;

			var keys = Object.keys(globals.procs);
			for(var i = 0; i < keys.length; i++)
			{
				clearInterval(globals.procs[keys[i]]);
				clearTimeout(globals.procs[keys[i]]);
			}

			globals.udpPort.send(
			{
					address: "/resetPhrases",
					args: []
			},
			"127.0.0.1", 57120);
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
		else if(msg.cmd == "vjoin")
		{
			votehelpers.joinVotes(msg)

			.then((resp)=>
			{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			})

			.catch((resp)=>{
				globals.admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});

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
			var options = helpers.parseOptions(msg.args);
			helpers.playSound(options);
			globals.admin.emit('server_report', {id: msg.cli_id});
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
		else if(msg.cmd == "dvote")
		{
			globals.display.emit("cmd", {type: "vote", cmd: "new"});
			globals.voteDisplayIndexes = {};
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

function handleStorySubrooms(room, options, cli_id)
{
	if(options.sub != undefined)
	{
		helpers.subRoom(room, options.sub, function(r)
		{
			globals.storyRooms = [];

			globals.admin.emit('server_report', {id: cli_id, msg: r});

			for(var i = 0; i < options.sub; i++)
			{
				globals.storyRooms.push(room + "_" + i);
			}

		})
	}
	else
	{
		//NB. this doesn't guarantee that the right players are memebers
		globals.storyRooms = [];
		var re = new RegExp(room + ".+", "g");
		globals.Rooms.find({room: { $regex: re }}, 'room').then((docs)=>
		{
			for(var i = 0; i < docs.length; i++)
			{
				globals.storyRooms.push(docs[i].room);
			}
			globals.admin.emit('server_report', {id: cli_id, msg: docs.length + " subrooms found"});
		});

	}
}
