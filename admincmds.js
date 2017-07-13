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
				helpers.useRoom(msg, function(rm)
				{
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
		globals.Rooms.remove({room: msg.room},{},function(e,r)
			{
					if(e == null)
					{
						globals.admin.emit('server_report', {id: msg.cli_id , msg: "room: " +  msg.room + " removed" });
					}
					else
					{
						globals.admin.emit('server_report', {id: msg.cli_id , msg: "room: " +  msg.room + " can't be found" });
					}
			});

		globals.UserData.update({},{$pull: {rooms: msg.room}},{multi: true} );
		}
		else if(msg.cmd == "closeall")
		{
		globals.Rooms.remove({},{},function(){
				globals.admin.emit('server_report', {id: msg.cli_id , msg: "allglobals.Rooms removed" });
			});

		globals.UserData.update({},{$set: {rooms: []}},{multi: true} );
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
		else if(msg.cmd == "transform")
		{
			var selector = helpers.parseFilters(msg.args, msg.room);

			globals.admin.emit('server_report', {id: msg.cli_id, msg: ""});

			if(selector)
			{

				var so = helpers.generateSearchObj(selector);

			globals.UserData.find(so).then((docs)=>
				{
					docs.forEach(function(e)
					{
						if(!e.isMobile) //only if not transformed
						{
							globals.display.emit("cmd", {type: "transform", val: e});
						}
					});
				})

			}
			else
			{

				if(msg.room != undefined)
				{
				globals.Rooms.find({room: msg.room}, 'population').then((docs)=>{

						if(docs == null)return;
						if(docs[0] != undefined)
						{

							docs[0].population.forEach(function(e){
								//FIXME !!!
							globals.UserData.find({_id: e}).then((docs2)=>
								{
									docs2.forEach(function(e2)
									{
										globals.display.emit("cmd", {type: "transform", val: e2});
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


			globals.UserData.find({connected: false}).then((docs)=>{
					if(docs == null)return;

					var users = [];

					docs.forEach(function(e){

					globals.UserData.remove(e._id);
						users.push(e._id);

					});
				globals.Rooms.update({},{$pull: {population: {$in: users }}}); //remove these users from anyglobals.Rooms
					globals.admin.emit('server_report', {id: msg.cli_id, msg: docs.length + " disconnected users removed "});
				});

		}
		else if(msg.cmd == "resetall")
		{
			//clear the Databases
			globals.sockets = {};
			globals.UserData.remove({});
			globals.Rooms.remove({});
			globals.admin.emit('server_report', {id: msg.cli_id, msg: "all databases reset"});
			globals.players.emit('whoareyou'); //causes any connected players to reset
			//TODO display reset
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
		else if(msg.cmd == "startmisty")
		{
			globals.udpPort.send({
					address: "/startMisty",
					args: []
			}, "127.0.0.1", 57120);
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
		else if(msg.cmd == "end")
		{
			globals.udpPort.send({
					address: "/allOff",
					args: []
			}, "127.0.0.1", 57120);
			globals.admin.emit('server_report', {id: msg.cli_id});
			globals.display.emit("cmd", {type: "end"});
			globals.players.emit('cmd', {cmd: 'change_mode', value: {mode: "blank"}});

		}


		//console.log('admin command: ' , msg);

	});

	socket.on('disp_cmd', function(msg)
	{

		//console.log(msg);

		if(msg.cmd == "shinstruct")
		{
			globals.display.emit("cmd", {type: "instruct"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "shdisplay")
		{
			globals.display.emit("cmd", {type: "display"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
		}
		else if(msg.cmd == "cldisplay")
		{
			globals.display.emit("cmd", {type: "clear_display"});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
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

			globals.display.emit("cmd", {type: "splat", val: {_id: id,
				colSeed: globals.AllOptions.colSeed,
				colMode: globals.AllOptions.colMode,
				blobSeed: Math.random(),
				splatPan: (Math.random() * 2.0 - 1.0) * 0.85,
			}});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
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

			globals.display.emit("cmd", {type: "blob", val: {_id: id,
				colSeed: Math.random(),
				colMode: Math.floor(Math.random() * 4),
				blobSeed: Math.random()
			}});
			globals.admin.emit('server_report', {id: msg.cli_id}); //empty response
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
