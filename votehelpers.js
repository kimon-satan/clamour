var globals = require('./globals.js');
var helpers = require('./helpers.js');


exports.listVotes = function()
{
	var ids = globals.voteDisplaySlots.a.concat(globals.voteDisplaySlots.b);
	var p = globals.Votes.find({_id: {$in: ids }},{sort: {pos: 1}})
	.catch((e)=>{
		console.log("caught u !");
	});

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

exports.getVoteFromSlot = function(slot)
{
	var m = slot.match(/[ab]\d/);

	if(!m)
	{
		return Promise.reject("Error - incorrect slot format");
	}

	var slot_id = globals.voteDisplaySlots[slot[0]][slot[1]];

	if(!slot_id)return Promise.reject("No vote at " + slot);

	var p = globals.Votes.findOne(slot_id);

	p = p.then((doc)=>
	{
		if(!doc)
		{
			return Promise.reject("No valid vote at " + slot);
		}
		else
		{
			return Promise.resolve(doc);
		}
	});

	return p;
}


exports.handlePhraseComplete = function(msg)
{

	var id = helpers.validateId(msg.args[0]);

	if(!id)
	{
		return Promise.reject("Error /phraseComplete: Invalid argument msg.args[0] " + msg.args[0]);
	}

	var p = globals.Votes.findOne({_id: id});
	var vote;

	p = p.then((data)=>
	{
		if(data != null && helpers.validateId(data._id))
		{
			vote = data;
			vote.available[msg.args[1]].push(msg.args[2]);
			return globals.Votes.update({_id: vote._id}, {$set: {available: vote.available}});
		}
		else
		{
			return Promise.reject("vote not found");
		}
	});

	p = p.then(_=>
	{
		//We're ready to start a vote
		var i = globals.pendingVotes.indexOf(String(vote._id));
		//Check that this is a pending vote and that the two win conditions are available

		if(i > -1)
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

	return p;
}


exports.startVote = function(msg)
{

	var response = "";
	var options = helpers.parseOptions(msg.args);

	var num = (options.num != undefined) ? options.num : 1;  // we need this for the helper

	//TODO deal with override here - don't let override slot in progress
	var pos = options.pos;
	var pair = options.choice;
	var winPair;
	var vote;

	if(pos == undefined)
	{
		//try to find an empty slot
		pos = findEmptySlot();
		if(!pos)
		{
			return Promise.reject("No free display slots for vote");
		}
	}

	if(pair == undefined)
	{
		return Promise.reject("choice not defined");
	}
	else if(typeof(pair) != "object")
	{
		return Promise.reject("incorrectly defined");
	}

	var p = handlePairRefs(pair);

	p = p.then(_=>
	{
		response = "choice: ";

		for(var i = 0; i < pair.length; i++)
		{
			response += pair[i] + ", ";
		}

		winPair = [pair[0], pair[1]];

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
				lock: false
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
			return globals.Votes.update(
				{_id : vote._id},
				{$set: {available: vote.available}}
			);
		});

		p = p.then(_=>
		{
			//just trigger the function
			exports.sendVote(vote, vote.num);
			return Promise.resolve(response);
		});
	}
	else
	{
		p = p.then(_=>
		{
			//Tell SC to record the phrases

			// helpers.sendSCMessage({
			// 		address: "/recordWinPhrase",
			// 		args: [String(vote._id) + "_win", winPair[0],winPair[1]],
			// });

			helpers.sendSCMessage({
					address: "/recordPhrases",
					args: [String(vote._id), pair[0],pair[1]],
			});

			return Promise.resolve();
		});

		p = p.then(_=>
		{
			globals.pendingVotes.push(String(vote._id));
			return Promise.resolve(response);
		});
	}

	p.catch((reason)=>
	{
		console.log("Error - vnew " + reason) ;
	})

	return p;
}

exports.addThreadsToVote = function(msg)
{
	var options = helpers.parseOptions(msg.args);

	var pos = options.pos;

	if(pos == undefined)
	{
		return Promise.reject("No position specified");
	}

	var p = exports.getVoteFromSlot(pos);

	p = p.then((doc)=>
	{
		if(!doc.open)
		{
			return Promise.reject("Vote is currently closed");
		}
		else
		{
				exports.sendVote(doc,options.num);
				return Promise.resolve();
		}
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
						globals.UserData.update({_id: player._id},{$set: {currentVoteId: data._id, currentVotePair: data.pair }})
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


exports.endVote = function(msg)
{
	var options = helpers.parseOptions(msg.args);

	var pos = options.pos;

	if(pos == undefined)
	{
		return Promise.reject("No position specified");
	}

	var p = exports.getVoteFromSlot(pos);

	p = p.then((doc)=>
	{
		exports.concludeVote(doc);
	})

	return p;
}

exports.concludeVote = function(data)
{

	var p = globals.Votes.findOne(data._id).then((doc)=>
	{
		data = doc; //get the most up to date version

		//1. reset any hanging voters
		for(var i = 0; i < data.voting.length; i++)
		{
			globals.players.to(data.voting[i]).emit('cmd',{cmd: 'cancel_vote', value: data._id});
			globals.UserData.update({_id: data.voting[i]},{$set: {currentVoteId: -1 , currentVotePair: ["",""]}})
		}

		if(!data.open)return Promise.reject("vote already concluded");

		data.winnerIdx = (data.scores[0] > data.scores[1]) ? 0 : 1;
		data.open = false;

	});

	p = p.then(_=>
	{
		return globals.Votes.update(data._id, data);
	})

	//3. update the vote as concluded with the winner
	p = p.then(_=>
	{
		globals.procs[data._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete.bind(this,data),1500);
	});

	p.catch((err)=>{
		console.log(err);
	})

	return p;

}


exports.startManual = function(msg)
{
	var p = Promise.resolve();
	var response = "";
	var options = helpers.parseOptions(msg.args);

	var pos = options.pos;

	if(pos == undefined)
	{
		return Promise.reject("No position specified");
	}

	var slot = globals.voteDisplaySlots[pos[0]][Number(pos[1])];

	if(slot == 0)
	{
		p = globals.Votes.insert(
				{ pair: ["",""],
					available: [[],[]],
					scores: [0,0],
					voting: [],
					voted: [],
					notvoted: 0,
					population: 0,
					num: 0,
					room: "",
					pos: pos,
					open: false,
					winnerIdx: 0,
					lock: false
			});
	}
	else
	{
		p = globals.Votes.findOne({_id: slot});
	}

	p = p.then((doc)=>
	{
		globals.voteDisplaySlots[pos[0]][Number(pos[1])] = doc._id;

		if(doc.open)
		{
			return Promise.reject("Vote is currently open");
		}
		else
		{
			var t = doc.pair[doc.winnerIdx];
			return Promise.resolve({text: t, pos: pos});
		}
	})

	return p;
}

exports.manualUpdate = function(msg)
{
	var slot = globals.voteDisplaySlots[msg.pos[0]][Number(msg.pos[1])];

	console.log(slot);

	var p = globals.Votes.update({_id: slot},{$set: {pair: [msg.text, msg.text]}});

	console.log(msg.text);

	globals.display.emit('cmd', {
		type: "vote", cmd: "updateVote" ,
		val: {
			winner: 0,
			text: [msg.text, ""],
			pos: msg.pos,
			slots: globals.voteDisplaySlots //Indicates the current state of the slots
		}
	});
}


/////////////////////////////// private helper functions ////////////////////////////

var findEmptySlot = function()
{
	var pos = false;
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
	return pos;
}

var handlePairRefs = function(pair)
{
	var p = Promise.resolve();

	for(var i = 0; i < pair.length; i++)
	{
		pair[i] = String(pair[i]);
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

	return p;
}


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
			globals.procs[data._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete.bind(null, data),1500);
		}
		return;
	}

	globals.currentConcludedVote = data;

	if(globals.NO_SC)
	{
		//otherwise this happens when

		exports.concludeDisplayAndPlayers();

		globals.procs[generateTempId(10)] = setTimeout(function()
		{
			globals.players.emit('cmd',{cmd: 'resume_vote'});
			//allows other votes to happen
			globals.currentConcludedVote = null;
		},500);
	}
	else
	{

		helpers.sendSCMessage({
				address: "/voteComplete", //pause audio in SC
				args: [String(data._id) + "_win_" + data.winnerIdx + "_7"]
		});



	}
	//console.log(data);
	var t = globals.currentConcludedVote.pair[globals.currentConcludedVote.winnerIdx];
	globals.players.emit('cmd',{cmd: 'pause_vote', value: t});

	globals.display.emit('cmd',
	{
		type: "vote", cmd: "concludeVote" ,
		val:{
			pos: globals.currentConcludedVote.pos,
			text: globals.currentConcludedVote.pair,
			winner: globals.currentConcludedVote.winnerIdx,
			slots: globals.voteDisplaySlots
		}
	});


}
