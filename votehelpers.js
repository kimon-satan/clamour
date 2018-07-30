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
	var isWin = false;
	var isJoin = false;
	if(msg.args[0].match("_win"))
	{
		isWin = true;
	}
	else if(msg.args[0].match("_join"))
	{
		isJoin = true;
	}

	var id = msg.args[0].replace("_win", "");
	id = id.replace("_join", "");

	var id = helpers.validateId(id);

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
			if(isWin)
			{
				vote.winAvailable[msg.args[1]] = true;
				return globals.Votes.update({_id: vote._id}, {$set: {winAvailable: vote.winAvailable}});
			}
			else if(isJoin)
			{
				vote.joinAvailable[msg.args[1]] = true;
				return globals.Votes.update({_id: vote._id}, {$set: {joinAvailable: vote.joinAvailable}});
			}
			else
			{
				vote.available[msg.args[1]].push(msg.args[2]);
				return globals.Votes.update({_id: vote._id}, {$set: {available: vote.available}});
			}
		}
		else
		{
			return Promise.reject("vote not found");
		}
	});

	if(isJoin)
	{
		p = p.then(_=>
		{
			//both votes need to be updated
			var slot = (vote.joinpre) ? vote.joinpre : vote.joinsuff;
			return exports.getVoteFromSlot(slot);
		})

		p = p.then((doc)=>
		{
			return globals.Votes.update(doc._id, {$set: {joinAvailable: vote.joinAvailable}});
		})
	}
	else
	{
		p = p.then(_=>
		{
			//We're ready to start a vote
			var i = globals.pendingVotes.indexOf(String(vote._id));
			//Check that this is a pending vote and that the two win conditions are available

			if(i > -1 && (vote.winAvailable[0] && vote.winAvailable[1]))
			{
				//console.log("start vote")
				globals.pendingVotes.splice(i,1);
				//WARNING: possibility of race condition ... ? probably not as SC records phrases one by one
				exports.sendVote(vote, vote.num);
				return Promise.resolve();
			}
		})

	}

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
	var append = options.append;
	var prepend = options.prepend;
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
				winAvailable: [false,false],
				joinAvailable: [false,false,false,false],
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
				prepend: prepend,
				lock: false
		});
	});

	p = p.then((data)=>
	{
		vote = data;
		globals.voteDisplaySlots[pos[0]][Number(pos[1])] = data._id;
		return Promise.resolve();
	});

	if(append != undefined || prepend != undefined)
	{
		p = p.then(_=>
		{
			if(append)
			{
				return exports.getVoteFromSlot(append);
			}
			else
			{
				return exports.getVoteFromSlot(prepend);
			}
		});

		p = p.then((doc)=> //TODO what if the vote is in progress ?
		{
			if(!doc.open)
			{
				if(prepend)
				{
					for(var i = 0; i < 2; i++)winPair[i] += " " + doc.pair[doc.winnerIdx];
				}
				else
				{
					for(var i = 0; i < 2; i++)winPair[i] = doc.pair[doc.winnerIdx] + " " + winPair[i];
				}

				globals.Votes.update(doc._id, {$set: {lock: true}}); //lock the other vote

				return globals.Votes.update(vote._id, {$set: {concatText: doc.pair[doc.winnerIdx], lock: true}});
			}
			else
			{
				return Promise.reject("Vote " + doc.pos + " is not concluded");
			}
		});
	}

	if(globals.NO_SC)
	{
		p = p.then(_=>
		{
			vote.available = [[ 0, 1, 2, 3, 4, 5, 6, 7 ], [ 0, 1, 2, 3, 4, 5, 6, 7 ]];
			vote.winAvailable = [true, true];
			return globals.Votes.update(
				{_id : vote._id},
				{$set: {available: vote.available, winAvailable: vote.winAvailable}}
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


	if(data.append || data.prepend)
	{
		//2. update other record if append or prepend
		p = p.then(_=>
		{
			//NB. we don't unlock the current vote as it's about to be destroyed

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

			data.pair = [s,s];
			return globals.Votes.update(id,{$set: {pair: [s,s], lock: false}});
		})
	}
	else if(data.joinpre || data.joinsuff)
	{
		p = p.then(_=>
		{
			if(data.joinpre)
			{
				return exports.getVoteFromSlot(data.joinpre);
			}
			else
			{
				return exports.getVoteFromSlot(data.joinsuff);
			}
		})

		p = p.then((doc)=>
		{
			if(doc.open)
			{
				//run the normal routine
				return Promise.resolve();
			}
			else
			{
				//set the concatText
				if(data.joinpre)
				{
					var s = doc.pair[doc.winnerIdx] + " " + data.pair[data.winnerIdx]; //the final string
				}
				else
				{
					var s = data.pair[data.winnerIdx] + " " + doc.pair[doc.winnerIdx]; //the final string
				}

				//NB. winnerIdx might be adapted at this point to pick the correct sample from SC
				doc.pair = [s,s];
				data.pair = [s,s];
				doc.lock = false;
				data.lock = false;

				return globals.Votes.update(doc._id, doc);

			}
		})

	}

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

}

exports.concludeDisplayAndPlayers = function()
{

	var displayTxt = globals.currentConcludedVote.pair[globals.currentConcludedVote.winnerIdx];
	var pos = globals.currentConcludedVote.pos;

	if(globals.currentConcludedVote.append || globals.currentConcludedVote.prepend)
	{
		//the newer vote is destroyed
		pos = (globals.currentConcludedVote.append) ? globals.currentConcludedVote.append : globals.currentConcludedVote.prepend;
		var dpos = globals.currentConcludedVote.pos;
		globals.voteDisplaySlots[dpos[0]][Number(dpos[1])] = 0;

	}
	else if (
		(globals.currentConcludedVote.joinpre || globals.currentConcludedVote.joinsuff)
		&& !globals.currentConcludedVote.lock
	)
	{
		if(globals.currentConcludedVote.selfdestruct)
		{
			var dpos = globals.currentConcludedVote.pos;
			pos = (globals.currentConcludedVote.joinpre) ? globals.currentConcludedVote.joinpre : globals.currentConcludedVote.joinsuff;
		}
		else if(globals.currentConcludedVote.joinpre)
		{
			var dpos = globals.currentConcludedVote.joinpre;
		}
		else if(globals.currentConcludedVote.joinsuff)
		{
			var dpos = globals.currentConcludedVote.joinsuff;
		}

		globals.voteDisplaySlots[dpos[0]][Number(dpos[1])] = 0;

	}

	globals.display.emit('cmd',
	{
		type: "vote", cmd: "concludeVote" ,
		val:{
			pos: pos,
			text: displayTxt,
			slots: globals.voteDisplaySlots
		}
	});

	globals.players.emit('cmd',
	{
		cmd: "display_winner",
		value: displayTxt
	});

}


exports.joinVotes = function(msg)
{
	var options = helpers.parseOptions(msg.args);

	if(options.pre == undefined)return Promise.reject("pre is not defined");
	if(options.suff == undefined)return Promise.reject("suff is not defined");
	if(options.keep == undefined)options.keep = "pre";

	var votes =[];

	var p = exports.getVoteFromSlot(options.pre);

	p = p.then((doc)=>{
		votes.push(doc);
		return exports.getVoteFromSlot(options.suff);
	})

	p = p.then((doc)=>{
		votes.push(doc);
		return Promise.resolve();
	})

	p = p.then(_=>
	{
		//check that neither are locked
		for(var i = 0; i < 2; i ++)
		{
			if(votes[i].lock)
			{
				return Promise.reject("vote " + votes[i].pos + " is currently in use.");
			}
		}

		votes[0].joinsuff = options.suff;
		votes[1].joinpre = options.pre;

		if(options.keep == "pre")
		{
			votes[1].selfdestruct = true;
		}
		else
		{
			votes[0].selfdestruct = true;
		}

		//set the lock flag for both
		var proms = [];
		for(var i = 0; i < 2; i++)
		{
			votes[0].lock = true;
			votes[1].lock = true;
			proms.push(globals.Votes.update(votes[i]._id, votes[i]));
		}

		return Promise.all(proms);

	});

	if(globals.NO_SC)
	{
		//don't need to do anything
	}
	else
	{
		p = p.then(_=>
		{
			//Tell SC to record the phrases
			var joinPhrases = [];

			for(var i = 0; i < 2; i++)
			{
				for(var j = 0; j < 2; j++)
				{
						joinPhrases.push(votes[0].pair[i] + " " + votes[1].pair[j]);
				}
			}

			for(var i = 0; i < votes.length; i++)
			{
				globals.udpPort.send({
						address: "/recordJoinPhrases",
						args: [String(votes[i]._id) + "_join",
						joinPhrases[0],
						joinPhrases[1],
						joinPhrases[2],
						joinPhrases[3]],
				}, "127.0.0.1", 57120);
			}

			return Promise.resolve();

		});
	}

	p = p.then(_=>
	{
		//check if both are already closed
		if(!votes[0].open && !votes[1].open)
		{
			//set the concatText
			if(votes[0].joinpre)
			{
				var s = votes[1].pair[doc.winnerIdx] + " " + votes[0].pair[votes[0].winnerIdx]; //the final string
			}
			else
			{
				var s = votes[0].pair[votes[0].winnerIdx] + " " + votes[1].pair[votes[1].winnerIdx]; //the final string
			}

			//NB. winnerIdx might be adapted at this point to pick the correct sample from SC
			votes[0].pair = [s,s];
			votes[1].pair = [s,s];
			votes[0].lock = false;
			votes[1].lock = false;

			globals.procs[votes[0]._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete.bind(this,votes[0]),1500);

			return Promise.all([
				globals.Votes.update(votes[0]._id, votes[0]),
				globals.Votes.update(votes[1]._id, votes[1])
			]);
		}
		else
		{
			return Promise.resolve();
		}
	})

	p = p.then(_=>
	{
		return Promise.resolve(options.pre + " will be joined to " + options.suff);
	});

	p.catch((err)=>{
		console.log(err);
	})

	return p;
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



	if(globals.NO_SC)
	{
		//otherwise this happens when

		exports.concludeDisplayAndPlayers();

		globals.procs[generateTempId(10)] = setTimeout(function()
		{
			globals.players.emit('cmd',{cmd: 'resume_vote'});
			//allows other votes to happen
			globals.currentConcludedVote = null;
		},1000);
	}
	else
	{
		//NB. this needs to be different for join
		if((data.joinpre || data.joinsuff) && !data.lock)
		{

			var p;
			var idxs = [];
			var samplesReady = true;

			for(var i = 0; i < 4; i++)
			{
				if(!data.joinAvailable[0])
				{
					samplesReady = false;
					break;
				}
			}

			if(!samplesReady)
			{
				p = globals.Votes.findOne(data._id);

				p = p.then((doc)=>
				{
					//samples aren't ready try again in half a second
					globals.procs[doc._id + "_" + generateTempId(5)] = setTimeout(triggerVoteComplete.bind(null, doc),500);
				})

				return;

			}
			else if(data.joinpre)
			{
				p = exports.getVoteFromSlot(data.joinpre);
				p = p.then((doc)=>{
					idxs.push(doc.winnerIdx);
					idxs.push(data.winnerIdx);
					return Promise.resolve();
				})
			}
			else
			{
				p = exports.getVoteFromSlot(data.joinsuff);

				p = p.then((doc)=>{
					idxs.push(data.winnerIdx);
					idxs.push(doc.winnerIdx);
					return Promise.resolve();
				})
			}

			p.then(_=>{

				var winIdx = (idxs[0] * 2) + idxs[1];
				globals.udpPort.send({
						address: "/voteComplete", //pause audio in SC
						args: [String(data._id) + "_join_" + winIdx + "_7"]
				}, "127.0.0.1", 57120);
			})

		}
		else
		{
			globals.udpPort.send({
					address: "/voteComplete", //pause audio in SC
					args: [String(data._id) + "_win_" + data.winnerIdx + "_7"]
			}, "127.0.0.1", 57120);
		}

	}

	globals.players.emit('cmd',{cmd: 'pause_vote'});
	globals.currentConcludedVote = data;

}
