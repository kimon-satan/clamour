
var globals = require('./globals.js');
var helpers = require('./helpers.js');
var votehelpers = require('./votehelpers.js');
var admincmds = require('./admincmds.js');
var displaycmds = require('./displaycmds.js');
var playercmds = require('./playercmds.js');

//check the various collections exist if not create them

globals.Presets.findOne({type: "love", name: "default"}).then((doc)=> {

	if(doc == null)
	{
		console.log("creating default parameters");
		globals.Presets.insert({name: "default", options: globals.LoveParameters});
	}

});

helpers.loadSettings(); //make native

//check whether any existing users rejoin

setTimeout(function()
{
	globals.UserData.find({connected: true}, '_id').then((docs)=>
	{
		if(docs != null)
		{

			for(var i = 0; i < docs.length; i++)
			{
				if(globals.sockets[docs[i]._id] == undefined) //no socket has been created
				{
					globals.UserData.update({_id: docs[i]._id}, {$set: {connected: false}});
				}
			}
		}
	});

},3000);

setInterval(function()
{

	time = Date.now();
	var k = Object.keys(globals.checkins);
	for(var i = 0; i < k.length; i++)
	{
			var delta = time - globals.checkins[k[i]];
			if(globals.DEBUG)console.log(k[i], delta);
			if(delta > 20000) //20 secs = dormant
			{
				if(globals.DEBUG)console.log(k[i] + " is dormant");
				try
				{
					if(helpers.validateId(k[i]))
					{
						globals.UserData.update({_id: k[i]},{$set: {connected: false}})
						.catch((err)=>{
							console.log("Error - checkins : " + err);
							globals.checkins[k[i]];
						});
						delete globals.checkins[k[i]];
					}
					else
					{
						// delete globals.checkins[k[i]];
						console.log(globals.checkins[k[i]]);
						throw k[i] + " is not a valid id";
					}
				}
				catch (e)
				{
					console.log("Error - checkins: " + e);
				}

			}
	}


}, 5000);

//We define a route handler / that gets called when we hit our website home.

globals.app.use("/admin",express.static(__dirname + "/admin"));
globals.app.use("/style",express.static(__dirname + "/style"));
globals.app.use("/libs",express.static(__dirname + "/libs"));
globals.app.use("/player",express.static(__dirname + "/player"));
globals.app.use("/tests",express.static(__dirname + "/tests"));
globals.app.use("/display",express.static(__dirname + "/display"));
globals.app.use("/samples",express.static(__dirname + "/samples"));
globals.app.use("/images",express.static(__dirname + "/images"));
globals.app.use("/fonts",express.static(__dirname + "/fonts"));

//three types of user
 globals.app.get('/admin', function(req, res){
	 res.sendFile(__dirname + '/admin/admin.html');
 });
 //
 globals.app.get('/display', function(req, res){
	 res.sendFile(__dirname + '/display/display.html');
 });
//
globals.app.get('/tests', function(req, res){
	res.sendFile(__dirname + '/tests/tests.html');
});

//
 globals.app.get('/', function(req, res){
	 res.sendFile(__dirname + '/player/player.html');
 });

globals.admin.on('connection', admincmds.response);
globals.display.on('connection', displaycmds.response);
globals.players.on('connection', playercmds.response);

//We make the http server listen on port 3000.
http.listen(3000, function(){
	console.log('listening on *:3000');
});


//////////////OSC LISTENER////////////////////////////////

globals.udpPort.on('message', (msg, rinfo) => {

		if(msg.address == "/poll")
		{
			 globals.display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
		}

		if(msg.address == "/phraseComplete")
		{

			try
			{

				var isWin = false;
				if(msg.args[0].match("_win"))
				{
					var id = helpers.validateId(msg.args[0].replace("_win", ""));
					isWin = true;
				}
				else
				{
					id = helpers.validateId(msg.args[0]);
				}

				if(!id)
				{
					console.log("Error /phraseComplete: Invalid argument msg.args[0] " + msg.args[0]);
					return;
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
				})

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
						votehelpers.sendVote(vote, vote.num);
						return Promise.resolve();
					}

				})

				p.catch((reason)=>{
					console.log("Error - phraseComplete: " + reason);
				});

			}
			catch(e)
			{
				console.log("Error caught /phraseComplete: " + e);
			}


		}

		if(msg.address == "/resumeVote") //TODO change name
		{
			globals.players.emit('cmd',{cmd: 'resume_vote'});
			//allows other votes to happen
			globals.currentConcludedVote = null;
		}

		if(msg.address == "/winSampleDone")
		{


			if(globals.currentConcludedVote.append || globals.currentConcludedVote.prepend)
			{
				var pos = globals.currentConcludedVote.pos;
				globals.voteDisplaySlots[pos[0]][Number(pos[1])] = 0;

			}

			globals.display.emit('cmd', {
				type: "vote", cmd: "concludeVote" ,
				val:{
					winner: globals.currentConcludedVote.winnerIdx,
					pos: globals.currentConcludedVote.pos,
					append: globals.currentConcludedVote.append,
					prepend: globals.currentConcludedVote.prepend,
					concatText: globals.currentConcludedVote.concatText,
					slots: globals.voteDisplaySlots
				}
			});

			var displayTxt = globals.currentConcludedVote.pair[globals.currentConcludedVote.winnerIdx];
			if(globals.currentConcludedVote.append)
			{
				displayTxt =  globals.currentConcludedVote.concatText + " " + displayTxt;
			}
			else if (globals.currentConcludedVote.prepend)
			{
				displayTxt = displayTxt + " " + globals.currentConcludedVote.concatText;
			}

			globals.players.emit('cmd',
			{
				cmd: "display_winner",
				value: displayTxt
			});

		}

});
