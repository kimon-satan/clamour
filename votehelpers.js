var globals = require('./globals.js');
var helpers = require('./helpers.js');
var deepcopy = require('deepcopy');

exports.listVotes = function()
{
	var p = globals.Votes.find({},{sort: {pos: 1}})
	.catch((e)=>
	{
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

exports.updateDisplay = function()
{
	getDisplaySlots()

	.then((doc)=>{
		globals.display.emit('cmd', {
			type: "vote", cmd: "updateSlots" ,
			val: doc
		});
	})
}


exports.handlePhraseComplete = function(msg)
{

	if(msg.args[0].substr(0,4) == "call")
	{
		exports.completeCall(msg.args[0]);
		return Promise.resolve();
	}
	else
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
		return Promise.reject("pos not defined");
	}
	if(pair == undefined)
	{
		return Promise.reject("choice not defined");
	}
	else if(typeof(pair) != "object")
	{
		return Promise.reject("choice incorrectly defined");
	}


	response = "choice: ";

	for(var i = 0; i < pair.length; i++)
	{
		response += pair[i] + ", ";
	}

	winPair = [pair[0], pair[1]];

	var p = helpers.useRoom(msg);


	p = p.then((rm)=>
	{
		return globals.Rooms.findOne({room: rm});
	})

	p = p.then((doc)=>
	{
		var v = deepcopy(globals.defaultVote);
		v.pos = pos;
		v.rig = options.rig;
		v.room = doc.room;
		v.notvoted = doc.population;
		v.population = doc.population.length;
		v.pair = pair;
		v.num = num;
		v.open = true;

		return globals.Votes.update({pos: pos},v);
	});

	p = p.then(_=>
	{
		return globals.Votes.findOne({pos: pos});
	})

	if(globals.NO_SC)
	{
		p = p.then((doc)=>
		{
			vote = doc;
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
		p = p.then((doc)=>
		{
			vote  = doc;
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

	var p = globals.Votes.findOne({pos: pos});

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

		if(data.rig != undefined)
		{
			omsg.rig = data.rig;
		}

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

	var p = globals.Votes.findOne({pos: pos});

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

	p = globals.Votes.findOne({pos: pos});

	var t = "";
	p = p.then((doc)=>
	{
		if(doc.open)
		{
			return Promise.reject("Vote is currently open");
		}
		else
		{
			if(doc.winnerIdx > -1)
			{
				t = doc.pair[doc.winnerIdx];
				return Promise.resolve();
			}
			else
			{
				doc.winnerIdx = 0;
				return globals.Votes.update(doc._id, doc);
			}

		}
	})

	p = p.then(_=>{
		return Promise.resolve({text: t, pos: pos});
	})

	return p;
}

exports.manualUpdate = function(msg)
{
	var p = globals.Votes.update({pos: msg.pos},{$set: {pair: [msg.text, msg.text]}})

	.then(_=>
	{
		return getDisplaySlots();
	})

	.then((doc)=>
	{
		globals.display.emit('cmd', {
			type: "vote", cmd: "updateSlots" ,
			val: doc
		});
	})

}

//reset

exports.reset = function()
{
	var positions = ['a0','a1','a2','a3','b0','b1','b2','b3'];
	var promises = [];
	for(var i = 0; i < 8; i++)
	{
		var v = deepcopy(globals.defaultVote);
		v.pos = positions[i];
		promises.push(globals.Votes.update({pos: v.pos},v));
	}

	Promise.all(promises)

	.then(_=>{
		exports.updateDisplay();
		globals.players.emit('cmd',{cmd: 'cancel_vote'});
		globals.players.emit('cmd',{cmd: 'resume_vote'});
		globals.UserData.update({},{$set: {currentVoteId: -1 , currentVotePair: ["",""]}})
	})


}

exports.startCall = function(msg)
{
	var options = helpers.parseOptions(msg.args);

	var seq = options.seq;
	seq = seq.split(",");
	globals.currentCallSeq = seq;

	var text = "";

	var p = Promise.resolve();
	var c = 0;

	for(var i = 0; i < seq.length; i++)
	{
		p = p.then(_=>
		{
			return globals.Votes.findOne({pos: seq[c]});
		})

		p = p.then((doc)=>
		{
			if(doc.winnerIdx > -1)
			{
				text += " " + doc.pair[doc.winnerIdx];
			}
			c++;
			return Promise.resolve();
		})
	}

	p.then(_=>
	{

		if(!globals.NO_SC)
		{
			//send the record message to SC
			helpers.sendSCMessage({address: '/recordCallPhrase', args: ['call_' + helpers.generateTempId(10), text]})
		}
		else
		{
			exports.completeCall();
		}
	})


}

exports.completeCall = function(call_id)
{

	if(!globals.NO_SC)
	{
		helpers.sendSCMessage({
				address: "/speakPhrase",
				args: [call_id, 0, 7, 0, 0.9]
		});
	}

	getDisplaySlots()

	.then((doc)=>
	{

		globals.display.emit('cmd',{
			type: "vote", cmd: "makeCall",
			val: {
				seq: globals.currentCallSeq,
				slots: doc
			}
		})

		var slots = ["a0", "a1", "a2", "a3", "b0", "b1", "b2", "b3"];
		for(var i = 0; i < globals.currentCallSeq.length; i++)
		{
			slots.splice(slots.indexOf(globals.currentCallSeq[i]),1);
		}

		//reset the other slots

		globals.Votes.update({pos: {$in: slots}},{$set:{winnerIdx: -1, pair:["",""]}},{multi: true})
	})




}


/////////////////////////////// private helper functions ////////////////////////////


var getDisplaySlots = function()
{

	var slots = {a: [0,0,0,0], b: [0,0,0,0]};

	return globals.Votes.find({})

	.then((docs)=>
	{
		for(var i = 0; i < docs.length; i++)
		{
			var col = docs[i].pos[0];
			var row = Number(docs[i].pos[1]);

			if(docs[i].open)
			{
				slots[col][row] = "_active_";
			}
			else if(docs[i].winnerIdx > -1)
			{
				slots[col][row] = docs[i].pair[docs[i].winnerIdx];
			}
			else
			{
				slots[col][row] = 0;
			}

		}

		return Promise.resolve(slots);
	})
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

	getDisplaySlots()

	.then((doc)=>
	{
		globals.display.emit('cmd',
		{
			type: "vote", cmd: "updateSlots",
			val:doc
		})
	})



}
