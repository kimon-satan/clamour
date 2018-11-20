var globals = require('./globals.js');
var helpers = require('./helpers.js');
var deepcopy = require('deepcopy');


exports.getDefaults = function()
{
	//TODO
	return {
		pair: ["",""],
		available: [[],[]],
		scores: [0,0],
		voting: [],
		voted: [],
		notvoted: 0,
		population: 0,
		num: 10,
		room: "",
		pos: "a0",
		open: false,
		winnerIdx: -1,
		die: false,
		infinite: false,
		force: false,
		pause: true,
		rig: undefined,
		lock: false
	}
}

exports.listVotes = function()
{
	return globals.Votes.find({},{sort: {pos: 1}})

	.then((docs)=>
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

	})

	.catch((err)=>
	{
		console.log(err);
	})

}

exports.updateDisplay = function()
{
	exports.getDisplaySlots()

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
				console.log("start vote")
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

	if(options.choice != undefined)
	{
		var pair = options.choice;
	}
	else if(options.c != undefined)
	{
		var pair = options.c;
	}

	var vote;

	if(options.pos == undefined)
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

	//TODO check pos is proper format

	response = "choice: ";

	for(var i = 0; i < pair.length; i++)
	{
		response += pair[i] + ", ";
	}

	//deal with override here - don't let override slot in progress
	var p = globals.Votes.findOne({pos: options.pos},{open: 1, locked: 1, infinite: 1, force: 1, voteid: 1});

	p = p.then((doc)=>{

		if(doc.open || doc.locked)
		{
			if(doc.infinite || options.force)
			{

				return exports.concludeVote(doc, true) //supress bing flag

				.then(_=>
				{
					return helpers.useRoom(msg)
				})
			}
			else
			{
				return Promise.reject("open vote here")
			}

		}
		else
		{
			return helpers.useRoom(msg);
		}

	})


	p = p.then((rm)=>
	{
		return globals.Rooms.findOne({room: rm.room});
	})

	p = p.then((doc)=>
	{
		var v = deepcopy(globals.defaultVote);
		v.pos = options.pos;
		if(options.rig != undefined)v.rig = options.rig;
		v.room = doc.room;
		v.notvoted = doc.population;
		v.population = doc.population.length;
		v.pair = pair;
		if(options.num != undefined)v.num = options.num;
		v.open = true;
		if(options.die != undefined)v.die = options.die;
		if(options.inf != undefined)v.infinite = options.inf;
		if(options.pause != undefined)v.pause = options.pause;
		v.voteid = helpers.generateTempId(20);

		return globals.Votes.update({pos: options.pos},v);
	});

	p = p.then(_=>
	{
		return globals.Votes.findOne({pos: options.pos});
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
		var resp = "Error - vnew " + reason;
		console.log(resp);
		return Promise.reject(resp);
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

		var omsg = {pair: data.pair, id: data.voteid};



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

			let deficit = Math.max(num - docs.length, 0); // remainder
			let promises = [];

			if(deficit > 0)
			{

				//we ran out of voters before the pool could be complete
				//store and kill these on reset just to be safe
				globals.procs[omsg.id + "_" + generateTempId(5)] = setTimeout(function()
				{

					globals.Votes.findOne({_id: data._id}) //findOne sends an error immediately for bad id input

					.then((doc)=>
					{
						if(doc) //otherwise the vote must have expired ... terminate the process
						{
							if(doc.notvoted.length > 0)
							{
								exports.sendVote(doc, deficit); //try to start threads for the deficit
							}
							else if(doc.open && globals.procs[omsg.id + "_concludeVote"] == undefined)
							{
								globals.procs[omsg.id + "_concludeVote"] = setTimeout(function()
								{
									exports.concludeVote(doc);
								},8000);// 8 seconds delay for stragglers
							}
						}

					})

					.catch((err)=>{
						console.log("Error: sendVote timeout - " + err);
					})

				},
				500); // call the function again
			}

			num -= deficit;

			while(num > 0 && docs.length > 0)
			{

				var idx = Math.floor(Math.random() * docs.length);
				var player = docs[idx];
				docs.splice(idx, 1);

				if(player.connected) //only send to connected players
				{
					globals.players.to(player._id).emit('cmd',{cmd: 'new_vote', value: omsg});

					promises.push(
						globals.Votes.update({_id: data._id}, {$push: {voting: player._id}, $pull: {notvoted: player._id}})
					);
					promises.push(
						globals.UserData.update({_id: player._id},{$set: {currentVoteId: omsg.id, currentVotePair: data.pair }})
					);

					num -= 1;
				}
				else
				{
					//otherwise transfer the player straight to the voted pool and try again
					promises.push(
						globals.Votes.update({_id: data._id}, {$push: {voted: player._id}, $pull: {notvoted: player._id}})
					);

					if(docs.length == 0)
					{
						globals.Votes.findOne({_id: data._id})

						.then((doc)=>
						{
							if(doc.notvoted.length == 0)
							{
								if(doc.open && globals.procs[omsg.id + "_concludeVote"] == undefined)
								{
									globals.procs[omsg.id + "_concludeVote"] = setTimeout(function()
									{
										exports.concludeVote(doc);
									},8000);// 8 seconds delay for stragglers
								}
							}
							else
							{
								//setTimeout(function()
								//{
									exports.sendVote(doc, num); //try to start threads for the deficit
								//},500);
							}
						})

					}

				}

			}

			return Promise.all(promises);

		})

		p = p.then(_=>
		{
			return globals.Votes.findOne({voteid: omsg.id});
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

exports.concludeVote = function(data, suppressBing)
{

	var p = globals.Votes.findOne(data._id).then((doc)=>
	{
		if(data.voteid != doc.voteid)
		{
			return Promise.reject("vote already concluded");
		}

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
		globals.procs[data._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete.bind(this,data,suppressBing),1500);
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
		return exports.getDisplaySlots();
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
				args: [
					"id", call_id,
					"choice", 0,
					"voice", 7,
					"pan", 0,
					"rate", 0.9,
					"amp", globals.settings.votesAudioSettings.concludeAmp
				]
		});
	}

	exports.getDisplaySlots()

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


exports.getDisplaySlots = function()
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


var triggerVoteComplete = function(data, suppressBing)
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
		if(globals.currentConcludedVote.pause && !suppressBing)
		{
			helpers.sendSCMessage({
					address: "/voteComplete", //pause audio in SC
					args: ["id", String(data._id) + "_win_" + data.winnerIdx + "_7", "amp", globals.settings.votesAudioSettings.bingAmp]
			});
		}
		else if (!globals.currentConcludedVote.pause && !suppressBing)
		{
			helpers.sendSCMessage({
					address: "/playBing", //pause audio in SC
					args: ["amp", globals.settings.votesAudioSettings.bingAmp]
			});
		}

	}

	var t = globals.currentConcludedVote.pair[globals.currentConcludedVote.winnerIdx];

	if(globals.currentConcludedVote.pause && !suppressBing)
	{
		globals.players.emit('cmd',{cmd: 'pause_vote', value: t});
	}
	else
	{
		globals.currentConcludedVote = null;
	}

	exports.getDisplaySlots()

	.then((doc)=>
	{
		globals.display.emit('cmd',
		{
			type: "vote", cmd: "updateSlots",
			val:doc
		})


	})



}
