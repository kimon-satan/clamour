var globals = require('./globals.js');
var helpers = require('./helpers.js');

exports.response = function(socket)
{

	var id;

	if(globals.DEBUG)console.log('a player connected ');
	socket.emit("whoareyou", "?")

	socket.on('hello', function(msg)
	{

		var usrobj = Object.assign({},globals.usrobj);

		usrobj.colSeed = Math.random();
		usrobj.colMode = Math.floor(Math.random() * 4);
		usrobj.blobSeed = Math.random();

		if(msg == "new")
		{

			globals.UserData.insert(usrobj,{}, function(err,res)
			{
				if(err) throw err;
				if(globals.DEBUG)console.log('hello new user: ' + res._id);
				id = res._id;
				socket.join(res._id);
				socket.emit('welcome', res);
				globals.checkins[id] = Date.now();
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
						if(globals.DEBUG)console.log('hello new user: ' + res._id);
						id = res._id;
						globals.checkins[id] = Date.now();
						socket.join(res._id);
						socket.emit('welcome', res);
						globals.sockets[res._id] = socket; //store socket on global list
					});
				}
				else
				{
					id = res._id;
					if(globals.DEBUG)console.log('welcome back user: ' + id);
					res.connected = true;
					socket.join(res._id);
					globals.checkins[id] = Date.now();
					//join any exitsting Rooms
					for(var i = 0; i < res.rooms.length; i++)
					{
						//if(globals.DEBUG)console.log("joining " + res.rooms[i]);
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

	socket.on('voted', function(msg)
	{

		/*voted { pair: [ 'recognise', 'refute' ],
		type: 'Vobj',
		scores: [ 0, 1 ],
		voting: [],
		voted: [],
		notvoted: [] }*/

		var p = globals.Votes.findOne(msg.id);

		p = p.then((data)=>{
			data.scores[msg.choice] += 1.0/data.population;


			//TODO trigger the audio sample
			globals.Votes.update(data._id, {$push: {voted: id}, $pull: {voting: id}, $set:{scores: data.scores}});
			return globals.Votes.findOne(msg.id);
		})

		p.then((data)=>
		{
			if(data.voted.length == data.population)
			{
				//TODO resolve the vote if there are no voters left
				console.log("vote concluded")
			}
			else
			{
				//initiate the next voter if there is one
				helpers.sendVote(data);
			}
		});

		//reset this users vote
		globals.UserData.update(id,{$set: {currentVoteId: -1, currentVotePair: ["",""]}});

	})

	socket.on('update_user', function(msg)
	{
		globals.UserData.update({_id: msg._id},{$set: msg});
	});

	socket.on('splat', function(msg){

		//if(globals.DEBUG)console.log("splat", msg);

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
		if(globals.DEBUG)console.log('a player disconnected ' + id);
		globals.UserData.update({_id: id},{$set: {connected: false}});
		delete globals.checkins[id];
		clearInterval(globals.procs[id]);
	});

	//a process to check players are with us
	globals.procs[id] = setInterval(function()
	{
		socket.emit('checkAlive',function(data)
		{
			globals.checkins[data] = Date.now();
		});
	},5000)

}
