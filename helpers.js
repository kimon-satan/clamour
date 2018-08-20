var globals = require('./globals.js');
var randomWords = require('random-words');
var fs = require('fs');

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
	return randomWords({ exactly: 2, join: '.' });
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

	globals.UserData.update({_id: { $in: uids} }, {$pull : {rooms: roomName}}, {multi: true})

	.then(_=>
	{
		globals.UserData.update({_id: { $in: uids} },{ $push : {rooms: roomName}}, {multi: true});
	});

	var p = globals.Rooms.update({room: roomName},{room: roomName, population: uids},{upsert: true});

	p = p.then(_=>{
		if(cb != undefined)cb();
		return Promise.resolve();
	});

	return p;
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

		var p = exports.selectAndJoin(selector);

		p = p.then((resp)=>
		{
			globals.admin.emit('server_report', {msg: resp, id: msg.cli_id, room: selector.roomName });

			if(cb != undefined)
			{
				cb(selector.roomName);
			}

			return Promise.resolve(selector.roomName);

		});

		return p;
	}
	else
	{
		//use the existing room
		if(typeof(cb) == "function")
		{
			cb(msg.room);
		}

		globals.admin.emit('server_report', {id: msg.cli_id});

		return Promise.resolve(msg.room);
	}
}

exports.selectPlayers = function(args, cb)
{

	var searchObj = exports.generateSearchObj(args);

	var p = globals.UserData.find(searchObj, '_id');

	p = p.then((docs) =>{
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

		if(cb != undefined)
		{
			cb(uids);
		}

		return Promise.resolve(uids);

	});

	return p;
}

exports.selectAndJoin = function(args, cb)
{
	if(typeof(args) == "undefined")return false;

	var p = exports.selectPlayers(args);
	var msg = "";

	p = p.then((uids)=>
	{
		msg =  args.mode + " with " + uids.length + " players with room: " + args.roomName;
		return exports.joinRoom(uids, args.roomName);
	})

	p = p.then(_=>
	{
		if(cb != undefined)
		{
			cb(msg)
		}

		return Promise.resolve(msg);
	})

	return p;
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

	//TODO UTILMATELY WE DON'T NEED A CALLBACK
	if(cb == undefined)
	{
		return options;
	}
	else
	{
		cb(options);
	}

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

//TODO doesn't belong here
exports.loadSettings = function()
{
	//load global settings from JSON file
	fs.readFile('config/settings.json', 'utf8', function (err, data)
	{
			if (err) throw err;
			globals.settings = JSON.parse(data);
			exports.loadStory();
			//exports.loadDictionary(); //needs to be called from elsewhere
	});
}

/////////////////////////////STORY//////////////////////////////////

exports.loadStory = function(cb)
{
	//load the audio samples
	exports.sendSCMessage(
	{
		address: "/loadSamples",
		args: [globals.settings.samplePath]
	});

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

		exports.sendSCMessage(
		{
			address: "/playStereo",
			args: args
		});
}

exports.startStoryClip = function(room)
{

	//TODO add video handler here
	var vid = globals.story[globals.storyChapter].clips[globals.storyClip].video;
	var img = globals.story[globals.storyChapter].clips[globals.storyClip].img;
	var blank = globals.story[globals.storyChapter].clips[globals.storyClip].blank;

	if(vid)
	{
		var vid_path = globals.settings.videoPath + vid;
		globals.display.emit('cmd', {type: 'story', video: vid_path});
		globals.DisplayState.storyMedia = "video";
	}
	else if(img)
	{
		var img_path = globals.settings.imagePath + img;
		globals.display.emit('cmd', {type: 'story', img: img_path});
		globals.DisplayState.storyMedia = "img";
	}
	else
	{
		globals.display.emit('cmd', {type: 'story', blank: true});
		globals.DisplayState.storyMedia = "blank";
	}


	var audio_options = globals.story[globals.storyChapter].clips[globals.storyClip].audio;
	if(audio_options)
	{
		var cloned = Object.assign({}, audio_options);
		exports.playSound(cloned);
	}
	else
	{
		//we need to trigger the end of the old sound
		exports.sendSCMessage(
		{
			address: "/allOff",
		});
	}

	//NB. at some point we might need the option not to clear the screen
	if(room != undefined)globals.players.to(room).emit('cmd', {cmd: 'chat_clear'});

	globals.storyCurrText = [""];
	globals.storyNumChars = 0;

}


exports.sendSCMessage = function(msg)
{
	//NB. message should be a object literal
	//{address: , args []}

	if(globals.IS_LOCAL)
	{
		globals.udpPort.send(msg, "127.0.0.1" ,57120);
	}
	else
	{
		var k = Object.keys(globals.tcpSocks);
		for(var i = 0; i < k.length; i++)
		{
			globals.tcpSocks[k[i]].write(JSON.stringify(msg));
		}
	}

}
