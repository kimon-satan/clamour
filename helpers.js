//simple db using monk & mongodb

var globals = require('./globals.js');

exports.useRoom = function(msg, cb) //add an optional cmd
{
	//attempt to get a selection object
	var selector = exports.parseFilters(msg.args, msg.room);

	if(selector)
	{
		//we are making a new room
		if(selector.roomName == undefined)selector.roomName = generateTempId(5);
		selector.mode = msg.mode;

		exports.addRoomToPlayers(selector, function(resp)
		{
			if(typeof(cb) != "undefined")cb(selector.roomName);
			globals.admin.emit('server_report', {msg: resp, id: msg.cli_id, room: selector.roomName });
		});
	}
	else
	{
		//use the existing room

		if(typeof(cb) != "undefined")cb(msg.room);
		globals.admin.emit('server_report', {id: msg.cli_id});
	}
}

exports.addRoomToPlayers = function(args, cb)
{

		if(typeof(args) == "undefined")return false;

		var subRooms;

		exports.selectPlayers(args, function(uids)
		{

			var msg =  args.mode + " with " + uids.length + " players with room: " + args.roomName;

			subRooms = [];
			if(args.subRooms != undefined && args.subRooms > 1)
			{
				for(var i = 0; i < args.subRooms; i++ )
				{
					subRooms.push([]);
				}
			}

			//get each player to join the room
			for(var i = 0; i < uids.length; i++)
			{
				if(typeof(globals.sockets[uids[i]]) != "undefined")
				{
					console.log("player " + uids[i] + " joining " + args.roomName)
					globals.sockets[uids[i]].join(args.roomName);
					if(subRooms.length > 0)
					{
						var idx = i%subRooms.length;
						var subRoom = args.roomName + "_" + idx;
						globals.sockets[uids[i]].join(subRoom);
						subRooms[i].push(uids[i]);
					}
				}
			}

			//callback here
			cb(msg); // it is safe to send a command to the room

			//now update the databases - this can be asynchronous

			//add the room to UserData
			//remove old versions first
			globals.UserData.update({_id: { $in: uids} }, {$pull : {rooms: args.roomName}}, {multi: true}, function(){
				globals.UserData.update({_id: { $in: uids} },{ $push : {rooms: args.roomName}}, {multi: true});
			})

			globals.Rooms.update({room: args.roomName},{room: args.roomName, population: uids}, {upsert: true});

			//add any subrooms too

			for(var i = 0; i < subRooms.length; i++)
			{
				var subRoomName = args.roomName + "_" + i;
				var subRoom = subRooms[i];
				globals.Rooms.update({room: subRoomName},{room: subRoomName, population: subRoom},{upsert: true});
				//remove old versions first

				globals.UserData.update({_id: { $in: subRoom}},{ $pull : {rooms: subRoomName}}, {multi: true}, function(){
				console.log(subRoom) // TODO FIX ME
				globals.UserData.update({_id: { $in: subRoom}},{ $push : {rooms: subRoomName}}, {multi: true});
				});
			}

		});

}

exports.selectPlayers = function(args, cb)
{

	var searchObj = exports.generateSearchObj(args);
	console.log(searchObj);

	globals.UserData.find(searchObj, '_id').then((docs) =>
	{
		//only the name field will be returned
		//repackage into a simple array
		var uids = [];
		for(var i = 0; i < docs.length; i++)
		{
			uids.push(docs[i]._id);
		}

		if(typeof(args.numPlayers) != "undefined"){
			shuffleArray(uids);
			if(numPlayers > 0)
			{
				var numPlayers = Math.min(uids.length , args.numPlayers);
			}
			else
			{
				var numPlayers = Math.max(uids.length + args.numPlayers, 1); //for inverse selection
			}
			uids = uids.slice(0,numPlayers);
		}

		cb(uids);

	});

}

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

				case "play":
				case "chat":
				case "wait":
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
		else if(args[i][0] == "sub")
		{
			if(args[i][1] != "")selector.subRooms = parseInt(args[i][1]);
		}
	}

	if(selector.filters.length == 0 &&
		selector.roomName == undefined &&
		selector.subRooms == undefined &&
		selector.numPlayers == undefined)
	{
			selector = false; //there are no filter actions
	}
	else if(
		selector.filters.length == 0 &&
		currentRoom != undefined &&
		selector.numPlayers == undefined &&
		(selector.roomName != undefined || selector.subRooms != undefined)
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
					var str = args[i][1].match(/\[(.*?)\]/)[1];
					options[args[i][0]] = str.split(",");
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

		case "chat":
    case "play":
    case "wait":
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
