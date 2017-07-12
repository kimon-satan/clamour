
var express = require('express');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var osc = require("osc");
var sockets = {};

var udpPort = new osc.UDPPort({
		localAddress: "127.0.0.1",
		localPort: 12345
});

udpPort.open();

//update the graphics

udpPort.on('message', (msg, rinfo) => {

		if(msg.address == "/poll")
		{
			 display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
		}

});

require('./libs/utils.js'); //include the global utils functions

//simple db using monk & mongodb
const url = 'localhost:27017/ConditionalLove';
const monk = require('monk');
const db = monk(url);

db.then(() => {
	console.log('Connected correctly to server')
})

const UserData = db.get('UserData');
const UserGroups = db.get('UserGroups'); //not used so far
const Presets = db.get('Presets'); //not using so far - probably should just be json
const Rooms = db.get('Rooms'); //This might become a variable ?


const allOptions =
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



//check the various collections exist if not create them

Presets.findOne({type: "play", name: "default"}).then((doc)=> {

	if(doc == null)
	{
		 console.log("creating default parameters");
		 Presets.insert({name: "default", options: allOptions});
	}

});






//We define a route handler / that gets called when we hit our website home.

app.use("/admin",express.static(__dirname + "/admin"));
app.use("/style",express.static(__dirname + "/style"));
app.use("/libs",express.static(__dirname + "/libs"));
app.use("/player",express.static(__dirname + "/player"));
app.use("/display",express.static(__dirname + "/display"));
app.use("/samples",express.static(__dirname + "/samples"));
app.use("/images",express.static(__dirname + "/images"));

//three types of user
 app.get('/admin', function(req, res){
	 res.sendFile(__dirname + '/admin/admin.html');
 });
 //
 app.get('/display', function(req, res){
	 res.sendFile(__dirname + '/display/display.html');
 });

//
 app.get('/', function(req, res){
	 res.sendFile(__dirname + '/player/player.html');
 });


var admin = io.of('/admin');

admin.on('connection', function(socket)
{
	console.log('an admin connected');

	socket.on('cmd', function(msg)
	{

		//console.log(msg);

		if(msg.cmd == "change_mode")
		{
			parseOptions(msg.args, function(options)
			{
				options = {};
				options.mode = msg.mode;
				useRoom(msg, function(rm)
				{
					players.to(rm).emit('cmd', {cmd: 'change_mode', value: options});
				});

			});
		}
		else if(msg.cmd == "chat_update")
		{
			players.to(msg.room).emit('cmd', {cmd: 'chat_update', value: msg.value});
		}
		else if(msg.cmd == "chat_clear")
		{
			players.to(msg.room).emit('cmd', {cmd: 'chat_clear'});
		}
		else if(msg.cmd == "chat_newline")
		{
			players.to(msg.room).emit('cmd', {cmd: 'chat_newline'});
		}
		else if(msg.cmd == "lplayers")
		{
			listPlayers( msg.args, msg.room, function(r)
			{
					admin.emit('server_report', {id: msg.cli_id, room: msg.room, isproc: msg.isproc , msg: r}); //same room response
			})
		}
		else if(msg.cmd == "lrooms")
		{
			listRooms( msg.args, msg.room, function(r)
			{
					admin.emit('server_report', {id: msg.cli_id, room: msg.room, isproc: msg.isproc , msg: r}); //same room response
			})
		}
		else if(msg.cmd == "close")
		{
			Rooms.remove({room: msg.room},{},function(e,r)
			{
					if(e == null)
					{
						admin.emit('server_report', {id: msg.cli_id , msg: "room: " +  msg.room + " removed" });
					}
					else
					{
						admin.emit('server_report', {id: msg.cli_id , msg: "room: " +  msg.room + " can't be found" });
					}
			});

			UserData.update({},{$pull: {rooms: msg.room}},{multi: true} );
		}
		else if(msg.cmd == "closeall")
		{
			Rooms.remove({},{},function(){
				admin.emit('server_report', {id: msg.cli_id , msg: "all rooms removed" });
			});

			UserData.update({},{$set: {rooms: []}},{multi: true} );
		}
		else if(msg.cmd == "get_rooms")
		{
			Rooms.find({}).then((docs)=>
			{
				if(docs.length < 1)
				{
					admin.emit('server_report', {id: msg.cli_id, msg: "there are no rooms"});
				}
				else
				{
					var res = [];
					for(var i = 0; i < docs.length; i++)
					{
						res.push(docs[i].room);
					}
					admin.emit('server_report', {id: msg.cli_id, suslist: res, susmode: "room", selected: msg.room});
				}

			});
		}
		else if(msg.cmd == "create_room")
		{
			useRoom(msg, null);
		}
		/*else if(msg.cmd == "group")
		{

			if(!msg.args)
			{
				admin.emit('server_report', {id: msg.cli_id, msg: ""});
				return;
			}

			var name = undefined;

			if(msg.args[0].substring(0,1) != "-")
			{
				name = msg.args[0];
				msg.args.splice(0,1);
			}

			if(msg.args[0] == "-d")
			{

				var s_args = {};
				s_args.orig = msg.args[1];
				s_args.numGps = parseInt(msg.args[2]);
				//Meteor.call("createSubGroups", Meteor.user()._id, s_args, function(e,r){cli.cmdReturn(e,r)});

			}
			else if(msg.args[0] == "-r")
			{

				if(name == undefined)
				{
					UserGroups.remove({});
					UserData.update({},{$set: {groups: []}},{multi: true});
					admin.emit('server_report', {id: msg.cli_id, msg: "all groups removed"});
				}
				else
				{
					UserGroups.remove({name: name});
					UserData.update({},{$pull: {groups: name}},{multi: true});
					admin.emit('server_report', {id: msg.cli_id, msg:  name + " removed"});
				}

			}else{

				//remove references to the group in any other players
				UserData.update({},{$pull:{groups: name}},{multi: true}, function(){

					createGroup(name, msg.args, {room: msg.room}, function(rsp)
					{
							admin.emit('server_report', {id: msg.cli_id, msg: rsp});
					});
				});


			}
		}*/
		else if(msg.cmd == "lgroups")
		{
			var results = "";

			UserGroups.find({}).then((docs)=>
			{


				if(docs != null){
					docs.forEach(function(e)
					{

						var str = e.name + " :: " + e.members.length;
						results += str + "\n";

					});

				}

				admin.emit('server_report', {id: msg.cli_id, msg: results});

			});

		}
		else if(msg.cmd == "transform")
		{
			var selector = parseFilters(msg.args, msg.room);

			admin.emit('server_report', {id: msg.cli_id, msg: ""});

			if(selector)
			{

				var so = generateSearchObj(selector);

				UserData.find(so).then((docs)=>
				{
					docs.forEach(function(e)
					{
						if(!e.isMobile) //only if not transformed
						{
							display.emit("cmd", {type: "transform", val: e});
						}
					});
				})

			}
			else
			{

				if(msg.room != undefined)
				{
					Rooms.find({room: msg.room}, 'population').then((docs)=>{

						if(docs == null)return;
						if(docs[0] != undefined)
						{

							docs[0].population.forEach(function(e){
								//FIXME !!!
								UserData.find({_id: e}).then((docs2)=>
								{
									docs2.forEach(function(e2)
									{
										display.emit("cmd", {type: "transform", val: e2});
									});
								})
							});

						}

					});
				}
			}
		}
		else if(msg.cmd == "set")
		{
			parseOptions(msg.args, function(options)
			{
				useRoom(msg, function(rm)
				{
					players.to(rm).emit('cmd', {cmd: 'set_params', value: options});
				});
			});
		}
		else if(msg.cmd == "cleanup")
		{


				UserData.find({connected: false}).then((docs)=>{
					if(docs == null)return;

					var users = [];

					docs.forEach(function(e){

						UserData.remove(e._id);
						users.push(e._id);

					});
					Rooms.update({},{$pull: {population: {$in: users }}}); //remove these users from any rooms
																																		//TODO remove users from groups too
					admin.emit('server_report', {id: msg.cli_id, msg: docs.length + " disconnected users removed "});
				});

		}
		else if(msg.cmd == "resetall")
		{
			//clear the Databases
			UserData.remove({});
			Rooms.remove({});
			UserGroups.remove({});
			admin.emit('server_report', {id: msg.cli_id, msg: "all databases reset"});
			players.emit('whoareyou'); //causes any connected players to reset
			//TODO display reset
		}
		else if(msg.cmd == "stats")
		{

			UserData.find({},'connected').then((docs)=>{

				var resp = "";

				resp += "players: " + docs.length + "\n";

				var numconnected = 0;

				docs.forEach(function(e){
					if(e.connected)numconnected += 1;
				})

				resp += "connected: " + numconnected;

				admin.emit('server_report', {id: msg.cli_id, msg: resp});
			});


		}
		else if(msg.cmd == "startmisty")
		{
			udpPort.send({
					address: "/startMisty",
					args: []
			}, "127.0.0.1", 57120);
			admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "killsound")
		{
			udpPort.send({
					address: "/allOff",
					args: []
			}, "127.0.0.1", 57120);
			admin.emit('server_report', {id: msg.cli_id});
		}
		else if(msg.cmd == "end")
		{
			udpPort.send({
					address: "/allOff",
					args: []
			}, "127.0.0.1", 57120);
			admin.emit('server_report', {id: msg.cli_id});
			display.emit("cmd", {type: "end"});
			players.emit('cmd', {cmd: 'change_mode', value: {mode: "blank"}});

		}


		//console.log('admin command: ' , msg);

	});

	socket.on('disp_cmd', function(msg)
	{

		//console.log(msg);

		if(msg.cmd == "shinstruct")
		{
			display.emit("cmd", {type: "instruct"});
			admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "shdisplay")
		{
			display.emit("cmd", {type: "display"});
			admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "cldisplay")
		{
			display.emit("cmd", {type: "clear_display"});
			admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "splat")
		{
			if(msg.args.length > 0)
			{
					var id = msg.args[0];
			}
			else
			{
					var id = generateTempId(5);
			}

			display.emit("cmd", {type: "splat", val: {_id: id,
				colSeed: allOptions.colSeed,
				colMode: allOptions.colMode,
				blobSeed: Math.random(),
				splatPan: (Math.random() * 2.0 - 1.0) * 0.85,
			}});
			admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "dispBlob")
		{
			if(msg.args.length > 0)
			{
					var id = msg.args[0];
			}
			else
			{
					var id = generateTempId(5);
			}

			display.emit("cmd", {type: "blob", val: {_id: id,
				colSeed: Math.random(),
				colMode: Math.floor(Math.random() * 4),
				blobSeed: Math.random()
			}});
			admin.emit('server_report', {id: msg.cli_id}); //empty response
		}

	})

	socket.on('disconnect', function()
	{
		console.log('an admin disconnected');
	});

});

var display = io.of('/display');

display.on('connection', function(socket)
{

	console.log("a display connected");

	socket.on('addTone', function(msg){

		console.log("addTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/addTone",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('updateTone', function(msg){

		console.log("updateTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/updateTone",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('endTone', function(msg){

		console.log("endTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/endTone",
				args: args,
		}, "127.0.0.1", 57120);

		players.to(msg.id).emit('cmd', {cmd: 'set_params', value: {isMobile: true, isSplat: false}});

	})

	socket.on('startCrawler', function(msg){

		console.log("startCrawler", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/startCrawler",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('updateCrawler', function(msg){

		console.log("updateCrawler", msg);
		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/updateCrawler",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('endCrawler', function(msg){

		console.log("endCrawler", msg);
		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/endCrawler",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('transTone', function(msg){

		console.log("transTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/transTone",
				args: args,
		}, "127.0.0.1", 57120);



	})




});
//io is everyone
var players = io.of('/player');

players.on('connection', function(socket)
{

	var id;

	console.log('a player connected ');
	socket.emit("whoareyou", "?")

	socket.on('hello', function(msg)
	{

		//make all options

		var usrobj = {
				mode: "wait",
				connected: true,
				rooms: [],
				groups: []
		}

		Object.keys(allOptions).forEach(function(e){
			usrobj[e] = allOptions[e];
		})

		usrobj.colSeed = Math.random();
		usrobj.colMode = Math.floor(Math.random() * 4);
		usrobj.blobSeed = Math.random();

		if(msg == "new")
		{

			UserData.insert(usrobj,{}, function(err,res)
			{
				if(err) throw err;
				console.log('hello new user: ' + res._id);
				socket.join(res._id);
				id = res._id;
				socket.emit('welcome', res);
				sockets[res._id] = socket; //store the socket for later use
			});

		}
		else
		{

			UserData.findOne(msg,{}, function(err,res)
			{
				if(err) throw err;
				if(!res)
				{
					//insert a new user instead
					UserData.insert(usrobj, {}, function(err,res)
					{
						if(err) throw err;
						console.log('hello new user: ' + res._id);
						id = res._id;
						socket.join(res._id);
						socket.emit('welcome', res);
					});
				}
				else
				{

					socket.join(res._id);
					id = res._id;
					console.log('welcome back user: ' + id);
					res.connected = true;
					//join any exitsting rooms
					for(var i = 0; i < res.rooms.length; i++)
					{
						console.log("joining " + res.rooms[i]);
						socket.join(res.rooms[i]);
					}

					UserData.update( id,{$set: {connected: true}},{},function(){
							socket.emit('welcome', res);
					});

				}
				sockets[res._id] = socket; //store the socket for later use

			});
		}

	});

	socket.on('update_user', function(msg)
	{
		UserData.update({_id: msg._id},{$set: msg});
	});

	socket.on('splat', function(msg){

		console.log("splat", msg);

		var args = ["pan", msg.splatPan, "rate", msg.splatRate, "pos", msg.splatPos];

		udpPort.send({
				address: "/splat",
				args: args,
		}, "127.0.0.1", 57120);


		display.emit('cmd', {type: "splat", val: msg});

	});

	socket.on('moveBlob', function(msg){

		//TODO OSC to supercollider here


		display.emit('cmd', {type: "moveBlob", val: msg});

	});



	socket.on('disconnect', function()
	{
		console.log('a player disconnected ' + id);
		UserData.update({_id: id},{$set: {connected: false}});
	});

});


//We make the http server listen on port 3000.
http.listen(3000, function(){
	console.log('listening on *:3000');
});


//////////////////////HELPER FUNCTIONS/////////////////////////


function listPlayers(args, room, cb)
{

	var selector = parseFilters(args, room);
	if(!selector)selector = {};
	var so = generateSearchObj(selector);

	//number filters don't work here

	var results = "";

	UserData.find(so).then((docs)=>
	{

		docs.forEach(function(e)
		{
			var id = String(e._id);
			var str = id.substring(0,3) + "..." + id.substring(id.length -3, id.length) ;
			str += (e.connected) ? " connected " : " dormant ";
			str += ",  mode: " + e.mode;

			if(e.mode == "play")
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

	Rooms.find({}).then((docs)=>
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


function selectPlayers(args, cb)
{

	var searchObj = generateSearchObj(args);
	console.log(searchObj);

	UserData.find(searchObj, '_id').then((docs) =>
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

function addRoomToPlayers(args, cb)
{

		if(typeof(args) == "undefined")return false;

		var subRooms;

		selectPlayers(args, function(uids)
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
				if(typeof(sockets[uids[i]]) != "undefined")
				{
					console.log("player " + uids[i] + " joining " + args.roomName)
					sockets[uids[i]].join(args.roomName);
					if(subRooms.length > 0)
					{
						var idx = i%subRooms.length;
						var subRoom = args.roomName + "_" + idx;
						sockets[uids[i]].join(subRoom);
						subRooms[i].push(uids[i]);
					}
				}
			}

			//callback here
			cb(msg); // it is safe to send a command to the room

			//now update the databases - this can be asynchronous

			//add the room to the userdata
			//remove old versions first
			UserData.update({_id: { $in: uids} }, {$pull : {rooms: args.roomName}}, {multi: true}, function(){
				UserData.update({_id: { $in: uids} },{ $push : {rooms: args.roomName}}, {multi: true});
			})

			Rooms.update({room: args.roomName},{room: args.roomName, population: uids}, {upsert: true});

			//add any subrooms too

			for(var i = 0; i < subRooms.length; i++)
			{
				var subRoomName = args.roomName + "_" + i;
				var subRoom = subRooms[i];
				Rooms.update({room: subRoomName},{room: subRoomName, population: subRoom},{upsert: true});
				//remove old versions first

				UserData.update({_id: { $in: subRoom}},{ $pull : {rooms: subRoomName}}, {multi: true}, function(){
					console.log(subRoom) // TODO FIX ME
					UserData.update({_id: { $in: subRoom}},{ $push : {rooms: subRoomName}}, {multi: true});
				});
			}

		});

}


function useRoom(msg, cb) //add an optional cmd
{
	//attempt to get a selection object
	var selector = parseFilters(msg.args, msg.room);
	console.log(selector)
	if(selector)
	{
		//we are making a new room
		if(selector.roomName == undefined)selector.roomName = generateTempId(5);
		selector.mode = msg.mode;

		addRoomToPlayers(selector, function(resp)
		{
			admin.emit('server_report', {msg: resp, id: msg.cli_id, room: selector.roomName });
			if(typeof(cb) != "undefined")cb(selector.roomName);

		});
	}
	else
	{
		//use the existing room
		admin.emit('server_report', {id: msg.cli_id, room: msg.room}); //same room response
		if(typeof(cb) != "undefined")cb(msg.room);
	}

}


function parseFilters(args, currentRoom)
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


function parseOptions(args, cb)
{

	//parses args into an object options

	var options = {};

	if(args.length == 0)
	{
		cb(options);
		return;
	}

	//Deal with options for player state
	var params = Object.keys(allOptions);

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

	loadPresets(args, options, function(res)
	{

			//saving presets will go here
			cb(options);

	});

	//saving presets

	// i = args.indexOf("-s");
	//
	// if(i > -1){
	//   args.splice(i,1);
	//   Meteor.call("createPreset", Meteor.user()._id, {type: type, name: args[i], options: options},function(e,r){cli.cmdReturn(e,r)});
	//   args.splice(i,1);
	//
	// }else{
	//   //cli.newCursor();
	// }

	//we need to add code to check current options

	// for(var i in options){
	//   gCurrentOptions[type][i] = options[i]; //copy the changes to current options
	// }



}

function loadPresets(args, options, cb)
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
