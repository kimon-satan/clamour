var globals = require('./globals.js');
var helpers = require('./helpers.js');
var votehelpers = require('./votehelpers.js');

exports.response = function(socket)
{

	var id;

	if(globals.DEBUG)console.log('a player connected ');
	socket.emit("whoareyou", "?")

	socket.on('hello', function(msg)
	{

		if(msg == "new")
		{
			newUser(socket)

			.then((doc)=>
			{
				id = doc;
			})
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
					newUser(socket)

					.then((doc)=>
					{
						id = doc;
					})
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
						if(globals.DEBUG)console.log("joining " + res.rooms[i]);
						socket.join(res.rooms[i]);
					}

					globals.UserData.update(
						id,
						{$set: {connected: true}},
						{},
						function()
						{
							socket.emit('welcome', res);
						}
						);

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


		if(!helpers.validateId(id))
		{
			console.log("incorrect user id: " + id);
			return;
		}



		var usrobj;
		var p = globals.UserData.findOne({_id: String(id)});

		p = p.then((data)=>
		{
			usrobj = data;
			return globals.Votes.findOne({voteid: msg.id});
		})

		p = p.then((data)=>
		{

			if(data == null)
			{
				globals.UserData.update(id,{$set: {currentVoteId: -1, currentVotePair: ["",""]}});
				return Promise.reject("vote " + msg.id + " could not be found ");
			}
			else if(!data.open)
			{
				globals.UserData.update(id,{$set: {currentVoteId: -1, currentVotePair: ["",""]}});
				return Promise.reject("vote concluded");
			}

			if(msg.choice >= 0)
			{

				data.scores[msg.choice] += 1.0/data.population;

				votehelpers.getDisplaySlots()

				.then((doc)=>
				{

					if(!globals.NO_SC)
					{

						helpers.sendSCMessage({
								address: "/speakPhrase",
								args: [
									"id", String(data._id),
									"choice", msg.choice,
									"voice", usrobj.voiceNum,
									"pan", usrobj.voicePan,
									"rate", usrobj.voicePitch,
									"amp", globals.settings.votesAudioSettings.voteAmp
								]
						});
					}


					globals.display.emit('cmd',
					{
						type: "vote", cmd: "displayVote" ,
						val: {
							choice: msg.choice,
							text: data.pair,
							font: usrobj.font,
							col: usrobj.fontCol,
							score: data.scores,
							pos: data.pos,
							slots: doc
						}
					});
				})



			}

			return globals.Votes.update(
				{
					_id: data._id},
					{$push: {voted: id},
				$pull: {voting: id},
			$set:{scores: data.scores}
			});

		})

		p = p.then((data)=>
		{
			return globals.Votes.findOne({voteid: msg.id});
		})

		p = p.then((data)=>
		{

			if(data.voted.length == data.population)
			{
				//resolve the vote if there are no voters left
				votehelpers.concludeVote(data);
			}
			else
			{
				//initiate the next voter if there is one
				votehelpers.sendVote(data);
			}

			return globals.UserData.update(id,{$set: {currentVoteId: -1, currentVotePair: ["",""]}});

		});

		p.catch((reason)=>
		{
			console.log("Error - voted " + reason) ;
		})


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

		var args = [
			"pan", msg.splatPan,
			"rate", msg.splatRate,
			"pos", msg.splatPos,
			"amp", globals.settings.loveAudioSettings.splatAmp,
			"freq", msg.splatFreq
		];

		helpers.sendSCMessage({
				address: "/splat",
				args: args,
		});


		globals.display.emit('cmd', {type: "love", cmd: "splat", val: msg});

	});

	socket.on('moveBlob', function(msg){

		//TODO OSC to supercollider here ?
		globals.display.emit('cmd', {type: "love", cmd: "moveBlob" , val: msg});

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
				clearInterval(globals.checkinProcs[id]);
				delete globals.checkinProcs[id];
			}
		}
		catch(e)
		{
			console.log("Error - disconnect" + e);
		}
	});

	//a process to check players are with us
	globals.checkinProcs[id] = setInterval(function()
	{
		socket.emit('checkAlive',function(data)
		{
			if(data != null)
			{
				globals.checkins[data] = Date.now();
			}
		});
	},5000);

}


function newUser(socket)
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

	return globals.UserData.insert(usrobj)

	.then((doc)=>
	{
		if(globals.DEBUG)console.log('hello new user: ' + doc._id);
		socket.join(doc._id);
		socket.emit('welcome', doc);
		globals.checkins[doc._id] = Date.now();
		globals.sockets[doc._id] = socket; //store socket on global list

		if(globals.welcomeRoom != undefined)
		{
			//TODO
			return helpers.joinRoom([doc._id], globals.welcomeRoom)

			.then((rm)=>
			{
				globals.players.to(doc._id).emit('cmd', {cmd: 'change_mode', value: {mode: rm.mode}});

			})

			.then(_=>
			{
				var r = /([a-z]*\.[a-z]*)_\d/;
				var m = r.exec(globals.welcomeRoom); //its a subroom

				if(m)
				{
					//also join the parent room
					helpers.joinRoom([doc._id], m[1]);
				}

				return Promise.resolve(doc._id);
			})
		}
		else
		{
			return Promise.resolve(doc._id);
		}

	})
}
