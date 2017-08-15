

Player = function(isDummy)
{

	this.lastCheckin = Date.now();

	this.isDummy = (isDummy == undefined) ? false: true;
	this.socket = io('/player');
	this.data = {};
	this.mode = "";
	this.iface = undefined;
	this.previousVotes = {};

	this.checkAlive = setInterval(function(){
		if(Date.now() - this.lastCheckin > 8000)
		{
			clearInterval(this.checkAlive);
			changeMode("refresh");
		}
	}.bind(this), 1000);

	this.whoami = function()
	{
		if(!this.isDummy)console.log("whoami");
		if(!this.isDummy)
		{
			var cookies = document.cookies;
			if(document.cookie != undefined)
			{
				var id = getCook('userid');
			}
		}

		this.data = {};

		if(id != undefined)
		{
			if(id.length > 0)
			{
				if(!this.isDummy)console.log("uid: " + id)
				this.socket.emit('hello', id); //request a database update
				this.data._id = id;
			}
			else
			{
				this.socket.emit('hello', 'new'); //create a new record
			}
		}
		else
		{
			this.socket.emit('hello', 'new'); //create a new record
		}
	}

	//socket responses

	this.socket.on("whoareyou", function(msg)
	{
		this.whoami();
	}.bind(this));

	this.socket.on('welcome', function (msg)
	{
		if(!this.isDummy)console.log("welcome: " + msg.currentVotePair);
		if(!this.isDummy)
		{
			document.cookie = "userid=" + msg._id;
		}

		this.data = {_id: msg._id}; //new data
		parseMsgParams(msg);

		if(!this.isDummy)
		{
			setupIface(informServer); //canvas and sound
		}

		changeMode(msg.mode);

	}.bind(this));

	this.socket.on('checkAlive', function (fn)
	{
		this.lastCheckin = Date.now();
		fn(this.data._id); //return yes I'm alive
	}.bind(this));

	this.socket.on('cmd', function(msg)
	{
		if(msg.cmd == "change_mode")
		{
			parseMsgParams(msg.value);
			changeMode(msg.value.mode);
		}
		else if (this.isDummy)
		{
			if (msg.cmd == "chat_update")
			{
				this.data.chatText = msg.value;
				this.updateTable(this.tableid, this.data);
			}
			else if(msg.cmd == 'chat_newline')
			{
				this.data.chatText = "NL";
				this.updateTable(this.tableid, this.data);
			}
			else if(msg.cmd == 'chat_clear')
			{
				this.data.chatText = "";
				this.updateTable(this.tableid, this.data);
			}
			else if(msg.cmd == 'new_vote' && this.mode == "vote")
			{
				createTestVote(msg); //TODO implement the same for real vote
			}
		}
		else
		{
			if (msg.cmd == "chat_update")
			{
				$('#chatContainer>div.largeText:last-child').remove();
				$('#chatContainer').append( '<div class="largeText">' + msg.value +'</div>' );
			}
			else if(msg.cmd == 'chat_newline')
			{
				$('#chatContainer').append( '<div class="largeText"></div>' );
			}
			else if(msg.cmd == 'chat_clear')
			{
				$('#chatContainer').empty();
			}
			else if(msg.cmd == 'set_params')
			{
				parseMsgParams(msg.value);
			}
			else if(msg.cmd == 'new_vote' && this.mode == "vote")
			{
				this.data.currentVoteId = msg.value.id;
				this.data.currentVotePair = msg.value.pair;
				createVote();
			}
		}

	}.bind(this));

	//private functions

	var createTestVote = function(msg)
	{

		if(this.previousVotes[msg.value.id] != undefined)
		{
			console.log("duplicate vote");
			return;
		}

		if(this.data.currentVoteId != -1)
		{
			window.setTimeout(function()
			{
				console.log("waiting, " +  msg.value.id);
				createTestVote(msg);
			},1000); //try again in 1 sec
			return;
		}

		this.previousVotes[msg.value.id] = true;
		this.data.currentVoteId = msg.value.id;
		this.data.currentVotePair = msg.value.pair;

		window.setTimeout(function()
		{
			var o = Math.round(Math.random());
			this.socket.emit('voted', {choice: o, id: this.data.currentVoteId });
			this.data.currentVoteId = -1;
			this.data.currentVotePair = ["",""];
			this.updateTable(this.tableid, this.data);

		}.bind(this), 1500 + Math.random() * 5000);

		this.updateTable(this.tableid, this.data);

	}.bind(this);

	var createVote = function()
	{

		$('#voteContainer').empty();


		for(var i = 0; i < 2; i++)
		{
			var d = $("<div class='mbut noselect'/>");
			var tc = $("<div class='textContainer'></div>");

			d.attr("id", "option" + i);
			d.attr("name", this.data.currentVotePair[i]);

			//text resizing according to content ...
			var w = this.data.currentVotePair[i].split(" ");
			var fs = Math.min(Math.max(0.5, this.data.currentVotePair[i].length/60), 1.0);
			for(var j = 0; j < w.length; j++)
			{
				if(w[j].length > 0)
				{
					fs = Math.max(w[j].length/15, fs);
				}
			}
			fs = Math.min(Math.max(0.5, fs), 1.0);

			tc.html(this.data.currentVotePair[i]);
			d.append(tc);
			$('#voteContainer').append(d);
			$('#option' + i).fitText(fs);

		}

		//looks like we don't need touchstart
		//$(".mbut").on("touchstart", voted);

		$(".mbut").on("click", voted);

	}.bind(this);

	var voted = function(e)
	{
		if(this.data.currentVoteId == -1) return; //you already voted !

		//************ something happened here ************
		var r = /option(\d)/;
		var o = parseInt(r.exec(e.target.id)[1]);
		$('#option' + o).addClass("vote");
		$('#option' + (o+1)%2).addClass("reject");
		this.socket.emit('voted', {choice: o, id: this.data.currentVoteId });
		this.data.currentVoteId = -1;
		e.preventDefault();
		e.stopPropagation();

	}.bind(this);

	var setupIface = function (callback)
	{
		var d = $('#container');
		if(window.Graphics != undefined && window.Sound != undefined && d.length > 0)
		{
			if(this.iface == undefined)
			{
				this.iface = new Interface(this, callback);
				this.iface.init();
			}

		}
		else
		{
			window.setTimeout(setupIface, 10);
		}

	}.bind(this);

	var informServer = function(msg)
	{
		console.log("inform:" , msg);
		msg._id = this.data._id;
		this.socket.emit('update_user', msg); //tell the server that we have changed mode
	}

	var parseMsgParams = function(msg)
	{
		var resp = {_id: this.data._id};

		Object.keys(msg).forEach(function(k)
		{

			if(k == "currentVotePair")
			{
				this.data[k] = msg[k];
				resp[k] = this.data[k];
			}
			else if(msg[k] != undefined && k != "_id" && k != "mode" && k != "rooms")
			{
				if(Object.prototype.toString.call( msg[k] ) === '[object Array]')
				{
					var idx = Math.floor(Math.random() * msg[k].length);
					this.data[k] = msg[k][idx];
					resp[k] = this.data[k];
				}
				else if(typeof(msg[k]) == "object")
				{
					this.data[k] = msg[k].min + Math.random() * (msg[k].max - msg[k].min);
					resp[k] = this.data[k];
				}
				else
				{
					this.data[k] = msg[k];
					resp[k] = this.data[k];
				}
			}

		}.bind(this));

		if(this.iface)
		{
			if(resp.state != undefined)
			{
				this.iface.changeState(resp.state); //changes state_z
			}

			if (resp.isSplat != undefined)
			{
				this.iface.setIsSplat(resp.isSplat);
			}

			if(resp.maxState != undefined)
			{
				this.iface.setMaxState(resp.maxState);
			}

			if(resp.envTime != undefined)
			{
				this.iface.setEnvTime(resp.envTime);
			}

			if(resp.isMobile != undefined)
			{
				this.iface.setIsMobile(resp.isMobile);
			}

			if(resp.isDying != undefined)
			{
				this.iface.setIsDying(resp.isDying); //changes state_z
			}

			if(resp.state_z != undefined)
			{
				this.iface.stateEnvelope.z = resp.state_z;
				this.data.state_z = resp.state_z;
			}

		}

		this.socket.emit('update_user', this.data); //tell the server that we have changed

		if(this.updateTable != undefined)
		{
			this.updateTable(this.tableid, this.data);
		}

	}.bind(this);

	var changeMode = function(mode)
	{

		if(this.mode == mode)return;

		if(!this.isDummy)
		{
			if(this.mode == "love")
			{
				this.iface.stopRendering();
			}

			if(mode == "love")
			{
				$('#container').empty();
				$('#container').append( '<div id="loveContainer"></div>' );

				//resume graphics
				this.iface.graphics.resume();
				this.iface.render();
			}

			if(mode == "broken")
			{
				$('#container').empty();
				$('#container').append( "<div id='chatContainer'> \
				<h1>Sorry, I don't think I can do this on your device. </h1> \
				<h2>Just enjoy the sounds for the moment. </h2> \
				<h2>I'll be back soon. </h2> \
				</div>" );
			}

			if(mode == "refresh")
			{
				$('#container').empty();
				$('#container').append( "<div id='chatContainer'> \
				<h1>Sorry your device has become disconnected</h1> \
				<h2>Please refresh the page</h2> \
				</div>" );
			}


			if(mode == "chat" || mode == "story")
			{
				$('#container').empty();
				$('#container').append( '<div id="chatContainer"></div>' );
			}

			if(mode == "vote")
			{
				$('#container').empty();
				$('#container').append( '<div id="voteContainer"></div>' );

				if(this.data.currentVoteId == -1) //TODO
				{
					$('#voteContainer').html( '<h1>Waiting ...</h1>' );
				}
				else
				{
					createVote();
				}
			}

			if(mode == "wait")
			{
				$('#container').empty();
				$('#container').append( "<div id='chatContainer'> \
				<h1>Conditional Love</h1> \
				<h2>Whilst you're waiting ...</h2>\
					<h3>Put your volume on full</h3> \
					<h3>Turn silent OFF!</h3> \
					<h3>Turn autolock OFF!</h3> \
					<h3>Keep your phone in portrait position</h3> \
				</div>" );
			}

			if(mode == "blank")
			{
				$('#container').empty();
			}

		}

		this.mode = mode;
		this.data.mode = mode;
		if(this.mode != "refresh")
		{
			this.socket.emit('update_user', {_id: this.data._id, mode: this.mode}); //tell the server that we have changed mode
		}

		//for load testing only
		if(this.updateTable != undefined)
		{
			this.updateTable(this.tableid, this.data);
		}

	}.bind(this);

}


/////////////////////////////////HELPERS///////////////////////////



function getCook(cookiename)
{
	// Get name followed by anything except a semicolon
	var cookiestring=RegExp(""+cookiename+"[^;]+").exec(document.cookie);
	// Return everything after the equal sign, or an empty string if the cookie name not found
	return unescape(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./,"") : "");
}
