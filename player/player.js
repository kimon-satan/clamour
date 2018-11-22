
var globals;

$.getJSON("/config/settings.json", function(json) {
		globals = json;
});


Player = function(isDummy)
{
	this.lastCheckin = Date.now();

	this.isDummy = (isDummy == undefined) ? false: true;
	this.socket = io('/player');
	this.data = {};
	this.mode = "";
	this.iface = undefined;
	this.voteManager = new VoteManager(this);

	this.killMe = function()
	{
		this.socket.disconnect();
	}

	this.checkAlive = setInterval(function()
	{
		if(Date.now() - this.lastCheckin > 8000)
		{
			changeMode("refresh");
			this.lastCheckin = Date.now();
		}
	}.bind(this), 1000);

	this.whoami = function()
	{
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
		this.lastCheckin = Date.now();
	}.bind(this));

	this.socket.on('welcome', function (msg)
	{
		this.lastCheckin = Date.now();

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
		else
		{
			this.iface = new Interface(this, informServer, true);
			this.iface.init();
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
			}
			else if(msg.cmd == 'chat_newline')
			{
				this.data.chatText = "NL";
			}
			else if(msg.cmd == 'chat_clear')
			{
				this.data.chatText = "";
			}
			else if(msg.cmd == 'new_vote' && this.mode == "vote")
			{
				this.voteManager.createTestVote(msg.value);
			}
			else if(msg.cmd == 'pause_vote' && this.mode == "vote")
			{
				this.voteManager.pauseVote(msg.value);
			}
			else if(msg.cmd == 'resume_vote' && this.mode == "vote")
			{
				this.voteManager.resumeVote();
			}
			else if(msg.cmd == 'cancel_vote' && this.mode == "vote")
			{
				this.voteManager.cancelVote(msg.value);
			}
			else if(msg.cmd == 'set_params')
			{
				parseMsgParams(msg.value);
			}
		}
		else
		{
			//real version

			if (msg.cmd == "chat_update")
			{
				$('#chatContainer>div.largeText:last-child').remove();
				$('#chatContainer').append( '<div class="largeText">' + msg.value +'</div>' );
			}
			else if(msg.cmd == 'chat_newline')
			{
				$('#chatContainer').append( '<div class="largeText"> </div>' );
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
				this.voteManager.createVote(msg.value);
			}
			else if(msg.cmd == 'pause_vote' && this.mode == "vote")
			{
				this.voteManager.pauseVote(msg.value);
			}
			else if(msg.cmd == 'display_winner' && this.mode == "vote")
			{
				this.voteManager.displayWinner(msg.value);
			}
			else if(msg.cmd == 'resume_vote' && this.mode == "vote")
			{
				this.voteManager.resumeVote();
			}
			else if(msg.cmd == 'cancel_vote' && this.mode == "vote")
			{
				this.voteManager.cancelVote(msg.value);
			}
		}

	}.bind(this));

	//private functions


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
		msg._id = this.data._id;
		this.socket.emit('update_user', msg); //tell the server that we have changed mode

	}.bind(this);

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

		if(this.iface && this.mode == "love")
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
				if(this.data.state == 0)
				{
					this.iface.volumeReminder();
				}
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
				$('#container').append( '<canvas id="voteCanvas"></canvas>' );
				$('#voteCanvas').attr('width', window.innerWidth);
				$('#voteCanvas').attr('height', window.innerHeight);
				this.voteManager.startDrawing();

				if(this.data.currentVoteId == -1)
				{
					this.voteManager.wait();
				}
				else
				{
					this.voteManager.createVote();
				}
			}

			if(mode == "wait")
			{
				$('#container').empty();
				$('#container').append( "<div id='chatContainer'> \
				<h1>Clamour</h1> \
				<h2>The performance will begin shortly\
				but whilst you're waiting ...</h2>\
					<h3>Turn OFF silent mode</h3> \
					<h3>Put your volume up</h3> \
					<h3>Disable notifications</h3> \
					<h3>Disable automatic screen locking</h3> \
					<h3>Keep your phone in portrait position</h3> \
				</div>" );
			}

			if(mode == "blank")
			{
				$('#container').empty();
			}

		}
		else
		{
			if(this.loveLoop)
			{
				window.clearInterval(this.loveLoop);
			}

			if(mode == "vote")
			{
				if(this.data.currentVoteId == -1)
				{
					this.voteManager.wait();
				}
				else
				{
					this.voteManager.createVote();
				}
			}

			if(mode == "love")
			{
				this.loveLoop = window.setInterval(function()
				{
					this.iface.dummyLove();
				}.bind(this),17);
			}
		}

		this.mode = mode;
		this.data.mode = mode;
		if(this.mode != "refresh")
		{
			this.socket.emit('update_user', {_id: this.data._id, mode: this.mode}); //tell the server that we have changed mode
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

function webglAvailable()
{
	try {
		var canvas = document.createElement( 'canvas' );
		return !!( window.WebGLRenderingContext && (
			canvas.getContext( 'webgl' ) ||
			canvas.getContext( 'experimental-webgl' ) )
		);
	} catch ( e ) {
		return false;
	}
}
