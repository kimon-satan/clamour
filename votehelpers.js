var globals = require('./globals.js');
var helpers = require('./helpers.js');

exports.loadDictionary = function(cb)
{
	///////////////DEPRECATED//////////////////

	// //load the audio samples
	// globals.udpPort.send(
	// {
	// 	address: "/loadSamples",
	// 	args: [globals.settings.samplePath]
	// },
	// "127.0.0.1", 57120);

	//load the story object

	// fs.readFile(globals.settings.dictionaryPath, 'utf8', function (err, data)
	// {
	// 	globals.dictionary = JSON.parse(data);
	//
	// 	if(typeof(cb) == "function")
	// 	{
	// 		cb(err);
	// 	}
	// });
}

exports.listVotes = function()
{
	var ids = globals.voteDisplaySlots.a.concat(globals.voteDisplaySlots.b);
	var p = globals.Votes.find({_id: {$in: ids }},{sort: {pos: 1}});

	p = p.then((docs)=>
	{
		var r = "";
		for(var i = 0; i < docs.length; i++)
		{
			r += "pos: " + docs[i].pos;

			if(docs[i].open)
			{
				r += ", choice: " + docs[i].pair[0] + "," + docs[i].pair[1];
				r += ", pop: " + docs[i].population + ", voting: " + docs[i].voting.length + ", notvoted: " + docs[i].notvoted.length;
			}
			else
			{
				r += ", text: " + docs[i].pair[docs[i].winnerIdx];
			}
			r += "\n";
		}

		return Promise.resolve(r);

	});

	return p;

}

exports.startVote = function(msg)
{

	var response = "";
	var options = helpers.parseOptions(msg.args);

	var num = (options.num != undefined) ? options.num : 1;  // we need this for the helper

	//TODO deal with override here - don't let override slot in progress
	var pos = options.pos;
	var append = options.append;
	var prepend = options.prepend;
	var pair = options.choice;
	var vote;

	if(pos == undefined)
	{
		//try to find an empty slot
		var a = globals.voteDisplaySlots.a.indexOf(0);
		var b  = globals.voteDisplaySlots.b.indexOf(0);
		if(a != -1)
		{
			pos = "a" + a;
		}
		else if(b != -1)
		{
			pos = "b" + b;
		}
		else
		{
			return Promise.resolve("No free display slots for vote");
		}

	}

	var p = Promise.resolve();

	for(var i = 0; i < 2; i++)
	{
		let m = pair[i].match(/([ab])(\d)/);

		if(m)
		{
			var vid = globals.voteDisplaySlots[m[1]][Number(m[2])];
			if(!vid)continue;

			p = p.then(_=>
			{
				return globals.Votes.findOne(vid)
			});

			p = p.then((doc)=>
			{
				if(doc.winnerIdx != -1)
				{
					pair[pair.indexOf(m[0])] = doc.pair[doc.winnerIdx];

					//remove old vote from globals.voteDisplaySlots
					//will be updated when new vote is sent to display
					globals.voteDisplaySlots[m[1]][Number(m[2])] = 0;
					return Promise.resolve();
				}
				else
				{
					return Promise.resolve("winner isn't chosen for " + m[0]);
				}
			});

		}
	}

	p = p.then(_=>
	{
		var response = "choice: ";

		for(var i = 0; i < pair.length; i++)
		{
			response += pair[i] + ", ";
		}

		return helpers.useRoom(msg);
	});


	p = p.then((rm)=>
	{
		return globals.Rooms.findOne({room: rm});
	})

	p = p.then((doc)=>
	{
		return globals.Votes.insert(
			{ pair: pair,
				available: [[],[]],
				winAvailable: [false,false],
				scores: [0,0],
				voting: [],
				voted: [],
				notvoted: doc.population,
				population: doc.population.length,
				num: num,
				room: doc.room,
				pos: pos,
				open: true,
				winnerIdx: -1,
				append: append,
				prepend: prepend
		});
	});

	p = p.then((data)=>
	{
		vote = data;
		globals.voteDisplaySlots[pos[0]][Number(pos[1])] = data._id;
		return Promise.resolve();
	});

	if(globals.NO_SC)
	{
		p = p.then(_=>
		{
			vote.available = [[ 0, 1, 2, 3, 4, 5, 6, 7 ], [ 0, 1, 2, 3, 4, 5, 6, 7 ]];
			return globals.Votes.update({_id : vote._id},{$set: {available: data.available}});
		});

		p = p.then(_=>
		{
			//just trigger the function
			helpers.sendVote(vote, vote.num);
			return Promise.resolve(data);
		});
	}
	else
	{
		//Tell SC to record the phrases
		var winPair = [pair[0], pair[1]];

		if(append != undefined || prepend != undefined)
		{
			p = p.then(_=>
			{
				var slot_id;
				if(append)
				{
					slot_id = globals.voteDisplaySlots[append[0]][append[1]];// TODO deal with empty slots
				}
				else
				{
					slot_id = globals.voteDisplaySlots[prepend[0]][prepend[1]]; // TODO deal with empty slots
				}
				return globals.Votes.findOne(slot_id);
			});

			p = p.then((doc)=>
			{
				if(prepend)
				{
					for(var i = 0; i < 2; i++)winPair[i] += " " + doc.pair[doc.winnerIdx];
				}
				else
				{
					for(var i = 0; i < 2; i++)winPair[i] = doc.pair[doc.winnerIdx] + " " + winPair[i];
				}
				return globals.Votes.update(vote._id, {$set: {concatText: doc.pair[doc.winnerIdx]}});
			});

		}

		p = p.then(_=>
		{
			globals.udpPort.send({
					address: "/recordWinPhrase",
					args: [String(vote._id) + "_win", winPair[0],winPair[1]],
			}, "127.0.0.1", 57120);

			globals.udpPort.send({
					address: "/recordPhrases",
					args: [String(vote._id), pair[0],pair[1]],
			}, "127.0.0.1", 57120);

			return Promise.resolve();
		});
	}

	p = p.then(_=>
	{
		globals.pendingVotes.push(String(vote._id));
		return Promise.resolve(response);
	})

	p.catch((reason)=>{
		console.log("Error - vnew " + reason) ;
	})

	return p;
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

					if(helpers.validateId(omsg.id))
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

				if(helpers.validateId(player._id) && helpers.validateId(omsg.id))
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
			if(helpers.validateId(omsg.id))
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


//private helper functions

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
