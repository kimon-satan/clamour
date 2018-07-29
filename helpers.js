var globals = require('./globals.js');
var randomWords = require('random-words');
var fs = require('fs');

//Handle incoming OSC - TODO move to server.js

globals.udpPort.on('message', (msg, rinfo) => {

		if(msg.address == "/poll")
		{
			 globals.display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
		}

		if(msg.address == "/phraseComplete")
		{

			try
			{

				var isWin = false;
				if(msg.args[0].match("_win"))
				{
					var id = exports.validateId(msg.args[0].replace("_win", ""));
					isWin = true;
				}
				else
				{
					id = exports.validateId(msg.args[0]);
				}

				if(!id)
				{
					console.log("Error /phraseComplete: Invalid argument msg.args[0] " + msg.args[0]);
					return;
				}

				var p = globals.Votes.findOne({_id: id});
				var vote;

				p = p.then((data)=>
				{
					if(data != null && exports.validateId(data._id))
					{
						vote = data;
						if(isWin)
						{
							vote.winAvailable[msg.args[1]] = true;
							return globals.Votes.update({_id: vote._id}, {$set: {winAvailable: vote.winAvailable}});
						}
						else
						{
							vote.available[msg.args[1]].push(msg.args[2]);
							return globals.Votes.update({_id: vote._id}, {$set: {available: vote.available}});
						}

					}
					else
					{
						return Promise.reject("vote not found");
					}
				})

				p = p.then(_=>
				{
					//We're ready to start a vote
					var i = globals.pendingVotes.indexOf(String(vote._id));
					//Check that this is a pending vote and that the two win conditions are available

					if(i > -1 && (vote.winAvailable[0] && vote.winAvailable[1]))
					{
						//console.log("start vote")
						globals.pendingVotes.splice(i,1);
						//WARNING: possibility of race condition ... ? probably not as SC records phrases one by one
						exports.sendVote(vote, vote.num);
						return Promise.resolve();
					}

				})

				p.catch((reason)=>{
					console.log("Error - phraseComplete: " + reason);
				});

			}
			catch(e)
			{
				console.log("Error caught /phraseComplete: " + e);
			}


		}

		if(msg.address == "/resumeVote") //TODO change name
		{
			globals.players.emit('cmd',{cmd: 'resume_vote'});
			//allows other votes to happen
			globals.currentConcludedVote = null;
		}

		if(msg.address == "/winSampleDone")
		{

			if(globals.currentConcludedVote.append || globals.currentConcludedVote.prepend)
			{
				var pos = globals.currentConcludedVote.pos;
				globals.voteDisplaySlots[pos[0]][Number(pos[1])] = 0;
			}

			globals.display.emit('cmd', {
				type: "vote", cmd: "concludeVote" ,
				val:{
					winner: globals.currentConcludedVote.winnerIdx,
					pos: globals.currentConcludedVote.pos,
					append: globals.currentConcludedVote.append,
					prepend: globals.currentConcludedVote.prepend,
					concatText: globals.currentConcludedVote.concatText,
					slots: globals.voteDisplaySlots
				}
			});


			//TODO adapt for append/prepend
			globals.players.emit('cmd',{
				cmd: "display_winner",
				value: globals.currentConcludedVote.pair[globals.currentConcludedVote.winnerIdx]
			});

		}

});

///////////////////////////////////////////////////////////////////////////////////////

exports.validateId = function(id)
{
	if(typeof(id) != "string")
	{
		id = String(id);
	}

	if(id.length != 24)
	{
		return false;
	}
	else
	{
		return id;
	}

}

exports.choose = function(list)
{
	return list[Math.floor(Math.random() * list.length)];
}


//////////////////////////ROOMS////////////////////////

exports.genRoomName = function()
{
	return randomWords({ exactly: 2, join: '-' });
}

exports.joinRoom = function(uids, roomName, cb)
{
	//get each player to join the room
	for(var i = 0; i < uids.length; i++)
	{
		if(typeof(globals.sockets[uids[i]]) != "undefined")
		{
			if(globals.DEBUG)console.log("player " + uids[i] + " joining " + roomName)
			globals.sockets[uids[i]].join(roomName);
		}
	}

	globals.Rooms.update({room: roomName},{room: roomName, population: uids},{upsert: true}, cb);

	//callback here
	//if(cb != undefined)cb(); // it is safe to send a command to the room

	//now update the databases - this can be asynchronous

	//add the room to UserData
	//remove old versions first
	globals.UserData.update({_id: { $in: uids} }, {$pull : {rooms: roomName}}, {multi: true})
	.then(_=>
	{
		globals.UserData.update({_id: { $in: uids} },{ $push : {rooms: roomName}}, {multi: true});
	});


}

exports.useRoom = function(msg, cb) //add an optional cmd
{
	//attempt to get a selection object
	var selector = exports.parseFilters(msg.args, msg.room);

	if(selector)
	{
		//we are making a new room
		if(selector.roomName == undefined)selector.roomName = exports.genRoomName();
		selector.mode = msg.mode;

		exports.selectAndJoin(selector, function(resp)
		{
			if(typeof(cb) == "function")cb(selector.roomName);
			globals.admin.emit('server_report', {msg: resp, id: msg.cli_id, room: selector.roomName });
		});
	}
	else
	{
		//use the existing room

		if(typeof(cb) == "function")cb(msg.room);
		globals.admin.emit('server_report', {id: msg.cli_id});
	}
}

exports.selectPlayers = function(args, cb)
{

	var searchObj = exports.generateSearchObj(args);

	globals.UserData.find(searchObj, '_id').then((docs) =>
	{
		//only the name field will be returned
		//repackage into a simple array
		var uids = [];
		for(var i = 0; i < docs.length; i++)
		{
			uids.push(docs[i]._id);
		}

		if(typeof(args.numPlayers) != "undefined")
		{

			shuffleArray(uids);
			if(args.numPlayers > 0)
			{
				var numPlayers = Math.min(uids.length , args.numPlayers);
			}
			else
			{
				var numPlayers = Math.max(uids.length - args.numPlayers, 1); //for inverse selection
			}
			uids = uids.slice(0,numPlayers);
		}

		cb(uids);

	});

}

exports.selectAndJoin = function(args, cb)
{
		if(typeof(args) == "undefined")return false;
		exports.selectPlayers(args, function(uids)
		{
			var msg =  args.mode + " with " + uids.length + " players with room: " + args.roomName;
			exports.joinRoom(uids, args.roomName, function()
			{
				cb(msg);
			});
		});
}

exports.subRoom =  function(room, numRooms, cb)
{
	globals.Rooms.find({room: room}).then((docs)=>
	{
		if(docs.length > 0)
		{
			var n = Math.max(2, parseInt(numRooms));
			var numPerSub = Math.ceil(docs[0].population.length / n);
			var subPops = [];
			while(docs[0].population.length > 0)
			{
				//TODO check when non divisible
				subPops.push(docs[0].population.splice(0,numPerSub));
			}

			for(var i =0; i < subPops.length; i++)
			{
				exports.joinRoom(subPops[i], room + "_" + i);
			}

			cb(n + " subrooms of " + room + " created");
		}
		else
		{
			cb();
		}

	})
}

//////////////////////////CMD LINE PARSING////////////////////////

exports.parseFilters = function(args, currentRoom)
{

	if(!args)return false;

	//parses an array arguments and finds the filter arguments assempling them into an object

	var selector = {filters: []};

	for(var i = 0; i < args.length; i++)
	{
		if(args[i][0] == "f" || args[i][0] == "n")
		{

			var filter = {};
			filter.not = args[i][0] == "n";

			switch(args[i][1])
			{
				case "room":
					filter.mode = "room";
					if(args[i][2] == "")
					{
						filter.room = currentRoom;
					}
					else
					{
						filter.room = args[i][2];
					}
				break;

				case "love":	//TODO - create a single list of room types
				case "chat":
				case "blank":
				case "vote":
				case "wait":
				case "story":
				case "broken":
				case "connected":
					filter.mode = args[i][1];
				break;

				case "state":
				case "envTime":
				case "death":
					filter.mode = args[i][1];
					filter[filter.mode] = args[i][2];
				break;

				case "isMobile":
				case "isDying":
				case "isSplat":
					filter.mode = args[i][1];
					filter[filter.mode] = (args[i][2] == "T") ? true : false;
				break;

				case "":
				break;

				default:

					if(!isNaN(args[i][1]))
					{
						selector.numPlayers = parseInt(args[i][1]);
						if(filter.not)selector.numPlayers *= -1; //means select all but that number
						filter = null;
					}
					else
					{
						filter.mode = "room"; //assume it's a room name
						filter.room = args[i][1];
					}
			}

			if(filter != null)selector.filters.push(filter);

		}
		else if(args[i][0] == "name")
		{
			if(args[i][1] != "")selector.roomName = args[i][1];
		}
	}

	if(selector.filters.length == 0 &&
		selector.roomName == undefined &&
		selector.numPlayers == undefined)
	{
			selector = false; //there are no filter actions
	}
	else if(
		selector.filters.length == 0 &&
		currentRoom != undefined &&
		selector.numPlayers == undefined &&
		selector.roomName != undefined
	)
	{
		selector.filters.push({not: false, mode: "room", room: currentRoom}); //add the current room
	}

	return selector;
}

exports.parseOptions = function(args, cb)
{

	//parses args into an object option
	var options = {};

	if(args.length == 0)
	{
		cb(options);
		return;
	}

	for(var i = 0; i < args.length; i++)
	{
		if(args[i][0] != "f" && args[i][0] != "n")
		{
				if(args[i][1].match(/\[.*?\]/)) //as many args
				{
					//repackage as an array
					try
					{
						//well formed with numbers or quotes
						options[args[i][0]] = JSON.parse(args[i][1]);
					}
					catch(e)
					{
						//TODO test this
						var m = args[i][1].match(/\["?(.*?)"?,"?(.*?)"?\]/); //NB. max two args
						options[args[i][0]] = [m[1],m[2]];
					}

				}
				else if(args[i][1].match(/\([^,],[^,]\)/)) //only two args
				{
					//repackage as an object
					var str = args[i][1].match(/\((\d),(\d)\)/);
					options[args[i][0]] = {min: parseFloat(str[1]), max: parseFloat(str[2])};
				}
				else
				{
					options[args[i][0]] = isNumber(args[i][1]) ? parseFloat(args[i][1]) : args[i][1];
					if(options[args[i][0]] == "T")options[args[i][0]] = true; //handle booleans
					if(options[args[i][0]] == "F")options[args[i][0]] = false;
				}

			}
	}

	cb(options);
}

exports.generateSearchObj = function(args)
{

	//converts my custom filter object into a mongodb search

	var searchObj = {};

	if(typeof(args.filters) == "undefined")args.filters = [];

	for(var i = 0; i < args.filters.length; i++){

	var filter = args.filters[i];

	switch(filter.mode){

		case "chat":	//TODO - as above
		case "play":
		case "wait":
		case "blank":
		case "vote":
		case "story":
		case "broken":
			searchObj.mode = filter.not ? {$ne: filter.mode} : filter.mode;
		break;
		case "connected":
			searchObj[filter.mode]= !filter.not;
		break;
		case "isMobile":
		case "isDying":
		case "isSplat":
			searchObj[filter.mode] = filter.not ? !filter[filter.mode] : filter[filter.mode];
		break;
		case "room":
			searchObj.rooms = filter.not  ? {$nin: [filter.room]} : {$in: [filter.room]}
		break;
		case "state":
		case "envTime":
		case "death":
			searchObj[filter.mode] = filter.not ? {$ne: parseInt(filter[filter.mode])} : parseInt(filter[filter.mode]);
		break;
		case "group":
			if(typeof(searchObj.groups) == "undefined"){
				searchObj.groups = filter.not ?  {$nin: [filter.group]} : {$in: [filter.group]}
			}else{

				if(filter.not){
					if(typeof(searchObj.groups['$nin']) == "undefined"){
						searchObj.groups['$nin'] = [filter.group];
					}else{
						searchObj.groups['$nin'].push(filter.group);
					}

				}else{

					if(typeof(searchObj.groups.$in) == "undefined"){
						searchObj.groups['$in'] = [filter.group];
					}else{
						searchObj.groups['$in'].push(filter.group);
					}
				}
			}
		break;
		}

	}

	return searchObj;

}

/////////////////////////////LOADING////////////////////////////////

exports.loadPresets = function(args, options, cb)
{
	var i = args.indexOf("-p");


	if(i > -1)
	{
			args.splice(i,1);

			Presets.findOne({type: type, name: args[i]}).then((doc)=>{

				if(doc)
				{

					var preset = doc.options;
					if(preset)
					{
						for(var x in preset)
						{
							options[x] = preset[x];
						}
					}

				}

				args.splice(i,1);
				loadPresets(args, options, cb);

			});
	}
	else
	{
		cb(options);
	}

}

exports.loadSettings = function()
{
	//load global settings from JSON file
	fs.readFile('config/settings.json', 'utf8', function (err, data)
	{
			if (err) throw err;
			globals.settings = JSON.parse(data);
			exports.loadStory();
			exports.loadDictionary();
	});
}

/////////////////////////////STORY//////////////////////////////////

exports.loadStory = function(cb)
{
	//load the audio samples
	globals.udpPort.send(
	{
		address: "/loadSamples",
		args: [globals.settings.samplePath]
	},
	"127.0.0.1", 57120);

	//load the story object

	fs.readFile(globals.settings.storyPath, 'utf8', function (err, data)
	{
		globals.story = JSON.parse(data);
		globals.storyChapter = 0;
		globals.storyClip = 0;
		globals.storyCurrText = [""];
		globals.storyNumChars = 0;

		if(cb != undefined)
		{
			cb(err);
		}
	});
}

exports.incrementStoryClip = function()
{
	globals.storyClip += 1;

	if(globals.storyClip > globals.story[globals.storyChapter].clips.length - 1)
	{
		if(globals.storyChapter < globals.story.length -1)
		{
			globals.storyChapter += 1;  //increment the stage
			globals.storyClip = 0;
		}
		else
		{
			globals.storyClip = globals.story[globals.storyChapter].clips.length - 1; //stay where we are
		}
	}

}

exports.playSound = function(options)
{
		//TODO add loop ?
		var args = [];

		if(options.path)
		{
			var p = options.path.split("/");
			options.dir = p[0];
			options.file = p[1];
			delete options.path;
		}

		if(options.dir && options.file)
		{
			args.push("dir");
			args.push(options.dir);
			args.push("file");
			args.push(options.file);
			delete options.file;
			delete options.dir;
		}
		else
		{
			console.log("Error: no valid file path provided")
			return;
		}


		var k = Object.keys(options);
		for(var i = 0; i < k.length; i++)
		{
			args.push(k[i]);
			args.push(options[k[i]]);
		}

		globals.udpPort.send(
		{
			address: "/playStereo",
			args: argsVote
		},
		"127.0.0.1", 57120);
}

exports.startStoryClip = function(room)
{
	var img = globals.story[globals.storyChapter].clips[globals.storyClip].img;
	if(img)
	{
		var img_path = globals.settings.imagePath + img;
	}
	else
	{
		var img_path = "blank";
	}
	globals.display.emit('cmd', {type: 'story', img: img_path});


	var audio_options = globals.story[globals.storyChapter].clips[globals.storyClip].audio;
	if(audio_options)
	{
		var cloned = Object.assign({}, audio_options);
		exports.playSound(cloned);
	}
	else
	{
		//we need to trigger the end of the old sound
		globals.udpPort.send(
		{
			address: "/allOff",
		},
		"127.0.0.1", 57120);
	}

	//NB. at some point we might need the option not to clear the screen
	if(room != undefined)globals.players.to(room).emit('cmd', {cmd: 'chat_clear'});

	globals.storyCurrText = [""];
	globals.storyNumChars = 0;

}


////////////////////////////VOTING////////////////////////////////////

exports.loadDictionary = function(cb)
{
	// //load the audio samples
	// globals.udpPort.send(
	// {
	// 	address: "/loadSamples",
	// 	args: [globals.settings.samplePath]
	// },
	// "127.0.0.1", 57120);

	//load the story object

	fs.readFile(globals.settings.dictionaryPath, 'utf8', function (err, data)
	{
		globals.dictionary = JSON.parse(data);

		if(typeof(cb) == "function")
		{
			cb(err);
		}
	});
}


exports.sendVote = function(data, num)
{

		if(!data.open)return;

		var omsg = {pair: data.pair, id: data._id};

		if(num == undefined)num = 1;

		//only select voices which are currently in the available category
		var p = globals.UserData.find(
			{_id: {$in: data.notvoted},
			currentVoteId: -1,
			 voiceNum: {$in: data.available[0], $in: data.available[1]}}
		 );

		p = p.then((docs)=>
		{

			let r = Math.max(num - docs.length, 0); // remainder
			let promises = [];

			if(r > 0)
			{
				//console.log( r + " too few voters for the pool " , num, docs.length );

				//we ran out of voters before the pool could be complete
				//store and kill these on reset just to be safe
				globals.procs[omsg.id + "_" + generateTempId(5)] = setTimeout(function()
				{

					if(exports.validateId(omsg.id))
					{
						var pp = globals.Votes.findOne({_id: omsg.id}); //findOne sends an error immediately for bad id input

						pp.then((res)=>
						{
							if(res) //otherwise the vote must have expired ... terminate the process
							{
								if(res.notvoted.length > 0)
								{
									exports.sendVote(res,r);
								}
								else if(res.open && globals.procs[omsg.id + "_concludeVote"] == undefined)
								{
									globals.procs[omsg.id + "_concludeVote"] = setTimeout(function()
									{
										exports.concludeVote(res);
									},10000);// 10 seconds delay for stragglers
								}
							}

						});

						pp.catch((err)=>{
							console.log("Error: sendVote timeout - " + err);
						})
					}

				},
				500); // call the function again
			}

			for(var i = 0; i < num - r; i++)
			{

				var idx = Math.floor(Math.random() * docs.length);
				var player = docs[idx];
				docs.splice(idx, 1);

				if(exports.validateId(player._id) && exports.validateId(omsg.id))
				{

					globals.players.to(player._id).emit('cmd',{cmd: 'new_vote', value: omsg});

					promises.push(
						globals.Votes.update({_id: omsg.id}, {$push: {voting: player._id}, $pull: {notvoted: player._id}})
					);
					promises.push(
						globals.UserData.update({_id: player._id},{$set: {currentVoteId: data._id, currentVotePair: player.pair }})
					);

				}

			}

			return Promise.all(promises);

		})

		p = p.then(_=>
		{
			if(exports.validateId(omsg.id))
			{
				return globals.Votes.findOne({_id: omsg.id});
			}

		});

		p.catch((reason)=>{
			console.log("Error - sendVote: " + reason);
		})

}


exports.concludeVote = function(data)
{

	var triggerVoteComplete = function(data)
	{
		//sends a message to SC and display with the winner

		if(globals.currentConcludedVote != null)
		{
			if(globals.currentConcludedVote._id == data._id)
			{
				console.log("already concluded");
			}
			else
			{
				console.log("vote full try again");
				globals.procs[data._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete,1500);
			}
			return;
		}

		globals.udpPort.send({
				address: "/voteComplete", //pause audio in SC
				args: [String(data._id), data.winnerIdx]
		}, "127.0.0.1", 57120);

		globals.currentConcludedVote = data;
		globals.players.emit('cmd',{cmd: 'pause_vote'});

		if(globals.NO_SC)
		{
			//otherwise this happens when

			//TODO adapt for append/prepend
			globals.display.emit('cmd', {
				type: "vote", cmd: "concludeVote" ,
				val: {
					winner: globals.currentConcludedVote.winnerIdx,
					pos: globals.currentConcludedVote.pos
				}
			});

			//TODO adapt for append/prepend
			globals.players.emit('cmd',{
				cmd: "display_winner",
				value: globals.currentConcludedVote.pair[globals.currentConcludedVote.winnerIdx]
			});

			globals.procs[generateTempId(10)] = setTimeout(function(){
				globals.players.emit('cmd',{cmd: 'resume_vote'});
				//allows other votes to happen
				globals.currentConcludedVote = null;
			},1000);
		}

	}

	globals.Votes.findOne(data._id).then((doc)=>
	{
		data = doc;

		//1. reset any hanging voters
		for(var i = 0; i < data.voting.length; i++)
		{
			globals.players.to(data.voting[i]).emit('cmd',{cmd: 'cancel_vote', value: data._id});
			globals.UserData.update({_id: data.voting[i]},{$set: {currentVoteId: -1 , currentVotePair: ["",""]}})
		}

		if(!data.open)return;

		data.winnerIdx = (data.scores[0] > data.scores[1]) ? 0 : 1;
		data.open = false;

		globals.procs[data._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete.bind(this,data),1500);

		//2. update other record if append or prepend
		if(data.append || data.prepend)
		{
			if(data.append)
			{
				var id = globals.voteDisplaySlots[data.append[0]][data.append[1]];
				var s = data.concatText + " " + data.pair[data.winnerIdx]; //the final string
			}
			else
			{
				var id = globals.voteDisplaySlots[data.prepend[0]][data.prepend[1]];
				var s = data.pair[data.winnerIdx] + " " + data.concatText; //the final string
			}

			globals.Votes.update(id,{$set: {pair: [s,s]}});
		}

		//3. update the vote as concluded with the winner
		globals.Votes.update(data._id, data);

	})

}
