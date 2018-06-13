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
		usrobj.voiceNum = Math.floor(Math.random() * 8);
		usrobj.voicePan = -1 + Math.random() * 2;
		usrobj.voicePitch = 0.75 + Math.random() * 0.5;
		//TODO this would work better with 15 * 15 and indexed permutations (guaranteed difference)
		usrobj.font = globals.fonts[Math.floor(Math.random() * globals.fonts.length)];
		usrobj.fontCol = globals.fontColours[Math.floor(Math.random() * globals.fontColours.length)];

		if(msg == "new")
		{

			globals.UserData.insert(usrobj,{}, function(err,res)
			{
				if(err)
				{
					console.log(err);
					//throw err;
				}
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
				if(err)
				{
					console.log(err);
					//throw err;
				}

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

		if(typeof(msg) != "object")
		{
			console.log("null msg");
			return;
		}

		// if(typeof(id) != "string"){
		// 	console.log("incorrect usr id: " + id + "," + typeof(id));
		// 	return;
		// }

		msg.id = helpers.validateId(msg.id);


		if(!msg.id)
		{
			console.log("incorrect msg id: " + msg.id);
			return;
		}
		else if(!helpers.validateId(id))
		{
			console.log("incorrect user id: " + id);
			return;
		}

		try{

			var usrobj;
			var p = globals.UserData.findOne({_id: String(id)});

			p = p.then((data)=>
			{
				usrobj = data;
				return globals.Votes.findOne({_id: msg.id});
			})

			p = p.then((data)=>
			{
				data._id = helpers.validateId(data._id);

				if(data == null)
				{
					return Promise.reject("vote " + msg.id + " could not be found ");
				}
				else if(!data._id)
				{
					return Promise.reject("vote " + msg.id + " return invalid id");
				}

				data.scores[msg.choice] += 1.0/data.population;

				globals.udpPort.send({
						address: "/speakPhrase",
						args: [String(data._id), msg.choice, usrobj.voiceNum, usrobj.voicePan, usrobj.voicePitch]
				}, "127.0.0.1", 57120);

				//assign to the next empty slot
				//naieve version
				if(globals.voteDisplayIndexes[data._id] == undefined)
				{
					//assign a new slot !
					var k = Object.keys(globals.voteDisplayIndexes);
					var slots = [0,0,0,0,0,0,0,0]; //TODO maybe make this a global

					for(var i = 0; i < k.length; i++)
					{
						//console.log(k[i])
						slots[Number(globals.voteDisplayIndexes[k[i]])] = k[i];

					}

					if(slots.indexOf(0) == -1)
					{
						//all slots taken go back to zero
						globals.voteDisplayIndexes[data._id] = 0;
					}
					else
					{
						globals.voteDisplayIndexes[data._id] = slots.indexOf(0);

						//update display -
						//NB. This might not be the eventual point of making this change
						// we might want to put the admin in charge
						globals.display.emit('cmd', {
							type: "vote", cmd: "setNumSlots" ,
							val: {numSlots: Object.keys(globals.voteDisplayIndexes).length
							}});
					}


				}

				globals.display.emit('cmd', {
					type: "vote", cmd: "displayVote" ,
					val: {
						choice: msg.choice,
						text: data.pair[msg.choice],
						font: usrobj.font,
						col: usrobj.fontCol,
						dispIdx: globals.voteDisplayIndexes[data._id],
						score: data.scores
					}
				});

				return globals.Votes.update({_id: data._id},
				{$push: {voted: id},
				$pull: {voting: id},
				$set:{scores: data.scores}
				});
			})

			p = p.then((data)=>
			{
				//NB. perhaps needs try catch
				return globals.Votes.findOne({_id: msg.id});
			})

			p = p.then((data)=>
			{
				if(typeof(data) != "object")
				{
					return Promise.reject("oops");
				}

				if(data.voted.length == data.population)
				{
					//resolve the vote if there are no voters left
					//TODO broken promise here
					helpers.concludeVote(data);

				}
				else
				{
					//TODO broken promise here
					//initiate the next voter if there is one
					helpers.sendVote(data);
				}

				return Promise.resolve();

			});

			p = p.then(_=>
			{
				//NB. perhaps needs try catch
				try{
					return globals.UserData.update(id,{$set: {currentVoteId: -1, currentVotePair: ["",""]}});
				}
				catch(e){
					console.log(e);
				}
			})

			p.catch((reason)=>
			{
				console.log("Error - voted " + reason) ;
			})

		}
		catch(e)
		{
			console.log("Caught Error - voted" + e);
		}
		//reset this users vote


	})

	socket.on('update_user', function(msg)
	{
		if(helpers.validateId(msg._id))
		{
			globals.UserData.update({_id: msg._id},{$set: msg})
			.catch((err)=>{
				console.log("Error - update_user: " + err);
			});
		}
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

		try
		{
			if(helpers.validateId(id))
			{
				globals.UserData.update({_id: id},{$set: {connected: false}})
				.catch((err)=>{
					console.log("Error - disconnect: " + err);
				});
				delete globals.checkins[id];
				clearInterval(globals.procs[id]);
			}
		}
		catch(e)
		{
			console.log("Error - disconnect" + e);
		}
	});

	//a process to check players are with us
	globals.procs[id] = setInterval(function()
	{
		socket.emit('checkAlive',function(data)
		{
			if(data != null)
			{
				globals.checkins[data] = Date.now();
			}
		});
	},5000)

}
