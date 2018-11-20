VoteManager = function(parent)
{

	//maybe reduce size to improve performance
	this.parent = parent;
	this.previousVotes = {};
	this.isWaiting = true;
	this.buttons = null;
	this.isPaused = false;
	this.pauseMessage = "";
	this.parent.data.state = "waiting";
	this.progress = 0.0;
	this.counter = 0;
	this.isFirstVote = true;


	this.draw = function()
	{
		this.counter += 1;
		this.context.fillStyle = "rgba(0,0,0,1.0)";
		this.context.fillRect(0,0,innerWidth, innerHeight);
		this.context.textAlign = 'center';
		this.context.textBaseline = 'middle'

		var dims = {
			x: innerWidth * 0.05,
			y: innerHeight * 0.05,
			w: innerWidth * 0.9,
			h: innerHeight * 0.85
		};

		if(this.isPaused)
		{

			this.context.fillStyle = '#FFFFFF';
			this.context.font = "75pt Arial";
			fitText(
				this.pauseMessage, //text to fit
				dims, //rect
				"Arial",
				75,//starting font size
				this.context //the canvas context
			);
		}
		else if(this.isWaiting)
		{

			this.context.fillStyle = '#FFFFFF';
			this.context.font = "75pt Arial";

			fitText(
				'get ready to vote', //text to fit
				dims, //rect
				"Arial",
				75,//starting font size
				this.context //the canvas context
			);


			this.context.strokeStyle = '#AAAAAA';
			this.context.lineWidth=8;
			this.context.beginPath();

			var a = 2 * Math.PI * (this.counter%60)/60;
			this.context.arc(innerWidth/2,innerHeight * 0.8,innerWidth * 0.1,
				a , a + Math.PI);
			this.context.stroke();

			this.context.lineWidth=1;

		}
		else
		{
			var d = Date.now();
			if(!this.delta)
			{
				this.delta = d;
			}
			this.ellapsed = d - this.delta;
			this.delta = d;
			this.progress = Math.min(1.0, this.progress + this.ellapsed / 10000);
			//console.log(this.progress);

			if(this.progress >= 1.0)
			{
				this.voted(-1);
				this.buttons[0].trigger(false);
				this.buttons[1].trigger(false);
			}

			//draw the votes here
			var isDone = true;

			for(var i = 0; i < this.buttons.length; i++)
			{
				this.buttons[i].draw(this.context);
				if(this.buttons[i].fade > 0)isDone = false;
			}

			var dims = {
				x: innerWidth * 0.05,
				y: innerHeight * 0.925,
				w: innerWidth * 0.9,
				h: innerHeight * 0.04
			};


			this.context.fillStyle = "rgba(100,100,100,1.0)";

			this.context.fillRect(
				dims.x,
				dims.y,
				dims.w,
				dims.h
			);

			this.context.fillStyle = "rgba(255,0,0,1.0)";

			this.context.fillRect(
				dims.x,
				dims.y,
				dims.w * this.progress,
				dims.h
			);

			if(isDone)
			{
				this.wait();
			}

		}

		requestAnimationFrame(this.draw);
	}.bind(this);


}

VoteManager.prototype.startDrawing = function()
{
	this.canvas = $('#voteCanvas')[0];
	this.context = this.canvas.getContext("2d");
	this.draw();

	//event handling
	//mouse events should do for both

	// this.canvas.addEventListener("touchstart", function (e)
	// {
	// 	console.log("ts");
	// }, false);


	this.canvas.addEventListener("mousedown", function (e)
	{
		if(this.buttons != null)
		{
			var x = e.clientX;
			var y = e.clientY;
			for(var i = 0; i < this.buttons.length; i++)
			{
				if(this.buttons[i].isInside(x,y))
				{
					var idx = i;
					if(this.rig != undefined)
					{
						if(idx != this.rig && Math.random() < 0.75)idx = this.rig;
					}

					this.buttons[idx].trigger(true);
					this.buttons[(idx+1)%2].trigger(false);
					this.voted(idx);
					break;

				}
			}
		}
	}.bind(this), false);

}

VoteManager.prototype.voted = function(choice)
{
	if(this.parent.data.currentVoteId == -1) return; //you already voted !
	this.parent.socket.emit('voted', {choice: choice, id: this.parent.data.currentVoteId });
	this.parent.data.currentVoteId = -1;
}

VoteManager.prototype.wait = function()
{
	this.parent.data.state = "waiting";
	this.isWaiting = true;
	//if(this.parent.updateTable)this.parent.updateTable(this.parent.tableid, this.parent.data);
}

VoteManager.prototype.cancelVote = function(val)
{
	if(val != undefined && this.parent.data.currentVoteId != val) return; //wrong vote here
	this.parent.data.state = "waiting";
	this.isWaiting = true;

}

VoteManager.prototype.createVote = function(vote)
{
	//console.log(vote);
	if(typeof(vote) != "undefined")
	{
		this.parent.data.currentVoteId = vote.id;
		this.parent.data.currentVotePair = vote.pair;
		this.progress = 0;
		this.ellapsed = 0;
		this.delta = Date.now();


		if(vote.rig != undefined)
		{
			this.rig = vote.rig;
		}
		else
		{
			this.rig = undefined;
		}
	}

	this.isWaiting = false;

	var buttonDims = [
		{x: innerWidth * 0.05, y: innerHeight * 0.02, w: innerWidth * 0.9, h: innerHeight * 0.85/2},
		{x: innerWidth * 0.05, y: innerHeight * 0.48, w: innerWidth * 0.9, h: innerHeight * 0.85/2},
	]

	this.buttons = [];

	for(var i = 0; i < buttonDims.length; i++)
	{
		this.buttons.push(new Button(
						buttonDims[i],
						this.parent.data.currentVotePair[i],
						this.parent.data.font,
						this.parent.data.fontCol
					)
		)
	}



}

VoteManager.prototype.pauseVote = function(text)
{
	this.isPaused = true;
	if(text != undefined)
	{
		this.pauseMessage = text;
	}
	else
	{
		this.pauseMessage = "..."
	}
	this.parent.data.state = "paused";
}

VoteManager.prototype.displayWinner = function(msg)
{
	this.pauseMessage = msg;
}

VoteManager.prototype.resumeVote = function()
{
	this.parent.data.state = (this.isWaiting) ? "waiting" : "voting";
	this.isPaused = false;

}


VoteManager.prototype.createTestVote = function(vote)
{

	if(this.parent.data.currentVoteId != -1)
	{
		window.setTimeout(function()
		{
			this.createTestVote(vote);
		},1000); //try again in 1 sec
		return;
	}

	this.previousVotes[vote.id] = true;
	this.parent.data.currentVoteId = vote.id;
	this.parent.data.currentVotePair = vote.pair;
	this.parent.data.state = "voting";

	if(vote.rig != undefined)
	{
		this.rig = vote.rig;
	}
	else
	{
		this.rig = undefined;
	}

	var makeChoice = function()
	{
		if(this.parent.data.currentVoteId == -1)return;

		if(!this.isPaused)
		{
			var o = Math.round(Math.random());
			if(this.rig != undefined)
			{
				if(o != this.rig && Math.random() < 0.75)
				{
					o = this.rig;
				}
				//console.log("rig", o, this.rig);
			}

			this.parent.socket.emit('voted', {choice: o, id: this.parent.data.currentVoteId });
			this.parent.data.currentVoteId = -1;
			this.parent.data.currentVotePair = ["0","0"];
			this.wait();
		}
		else
		{
			window.setTimeout(makeChoice, 1000); //try again in a second
		}

	}.bind(this);

	window.setTimeout(makeChoice, 1500 + Math.random() * 5000);

}

///////////////HELPER CLASSES////////////////

Button = function(dims,text,font,fontCol)
{
	this.dims = dims;
	this.text = text;
	this.font = font;
	this.fontCol = fontCol;
	this.backShade = 80;
	this.isSelected = false;
	this.isFading = false;
	this.fade = 1.0;

	this.draw = function(context)
	{
		if(this.isFading)
		{
			if(this.isSelected)
			{
				this.fade -= 0.01;
			}
			else
			{
				this.fade -= 0.05;
			}

			if(this.fade <= 0)this.isFading = false;
		}

		//set the colour
		context.fillStyle = "rgba("
		+ this.backShade + ","
		+ this.backShade + ","
		+ this.backShade + ","
		+ this.fade + ")";

		//draw the background rect
		context.fillRect(
			this.dims.x,
			this.dims.y,
			this.dims.w,
			this.dims.h
		);

		context.fillStyle = "rgba("
		+ this.fontCol + ","
		+ this.fade + ")";

		//set alignment
		context.textAlign = 'center';
		context.textBaseline = 'middle';

		context.fillStyle = "rgba("
		+ this.fontCol + ","
		+ this.fade + ")";

		//fit the text - NB. could be a bit slow
		fitText(
			this.text, //text to fit
			this.dims, //rect
			this.font,
			70,//starting font size
			context //the canvas context
		);
	}

	this.isInside = function(x,y)
	{
		if(x > this.dims.x && x < this.dims.x + this.dims.w)
		{
			if(y > this.dims.y && y < this.dims.y + this.dims.h)
			{
				return true;
			}
		}

		return false;
	}

	this.trigger = function(isSelected)
	{
		this.isSelected = isSelected;
		this.isFading = true;
		if(isSelected)this.backShade = 255;
	}

}
