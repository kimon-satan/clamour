var globals = require('./globals.js');
var helpers = require('./helpers.js');

exports.response = function(socket)
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

		Object.keys(globals.AllOptions).forEach(function(e){
			usrobj[e] = globals.AllOptions[e];
		})

		usrobj.colSeed = Math.random();
		usrobj.colMode = Math.floor(Math.random() * 4);
		usrobj.blobSeed = Math.random();

		if(msg == "new")
		{

			globals.UserData.insert(usrobj,{}, function(err,res)
			{
				if(err) throw err;
				console.log('hello new user: ' + res._id);
				id = res._id;
				socket.join(res._id);
				socket.emit('welcome', res);
				globals.sockets[res._id] = socket; //store socket on global list
			});

		}
		else
		{

			globals.UserData.findOne(msg,{}, function(err,res)
			{
				if(err) throw err;

				if(!res)
				{
					//insert a new user instead
					globals.UserData.insert(usrobj, {}, function(err,res)
					{
						if(err) throw err;
						console.log('hello new user: ' + res._id);
						id = res._id;
						socket.join(res._id);
						socket.emit('welcome', res);
						globals.sockets[res._id] = socket; //store socket on global list
					});
				}
				else
				{
					id = res._id;
					console.log('welcome back user: ' + id);
					res.connected = true;
					socket.join(res._id);
					//join any exitsting Rooms
					for(var i = 0; i < res.rooms.length; i++)
					{
						//console.log("joining " + res.rooms[i]);
						socket.join(res.rooms[i]);
					}

					globals.UserData.update( id,{$set: {connected: true}}, {}, function(){
							socket.emit('welcome', res);
					});

					//NB  . overwrites if necessary
					globals.sockets[res._id] = socket; //store socket on global list

				}

			});
		}

	});

	socket.on('update_user', function(msg)
	{
		globals.UserData.update({_id: msg._id},{$set: msg});
	});

	socket.on('splat', function(msg){

		//console.log("splat", msg);

		var args = ["pan", msg.splatPan, "rate", msg.splatRate, "pos", msg.splatPos];

		globals.udpPort.send({
				address: "/splat",
				args: args,
		}, "127.0.0.1", 57120);


		globals.display.emit('cmd', {type: "splat", val: msg});

	});

	socket.on('moveBlob', function(msg){

		//TODO OSC to supercollider here
		globals.display.emit('cmd', {type: "moveBlob", val: msg});

	});



	socket.on('disconnect', function()
	{
		console.log('a player disconnected ' + id);
		globals.UserData.update({_id: id},{$set: {connected: false}});
	});

}
