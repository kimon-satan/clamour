VoteManager = function(parent)
{

	//maybe reduce size to improve performance
	this.parent = parent;
	this.previousVotes = {};
	this.isWaiting = true;
	this.buttons = null;


	this.draw = function()
	{
		this.context.fillStyle = "rgba(0,0,0,1.0)";
		this.context.fillRect(0,0,innerWidth, innerHeight);
		this.context.textAlign = 'center';
		this.context.textBaseline = 'middle'

		if(this.isWaiting)
		{

			this.context.fillStyle = '#FFFFFF';
			this.context.font = "75pt Arial";
			this.context.fillText('Waiting', this.canvas.width/2, this.canvas.height/2);
		}
		else
		{
			//draw the votes here
			for(var i = 0; i < this.buttons.length; i++)
			{
				this.buttons[i].draw(this.context);
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
					this.buttons[i].trigger(true);
					this.buttons[(i+1)%2].trigger(false);
					this.voted(i);
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

VoteManager.prototype.wait = function(){
	this.isWaiting = true;
}

VoteManager.prototype.createVote = function(vote)
{
	if(typeof(vote) != "undefined")
	{
		this.parent.data.currentVoteId = vote.id;
		this.parent.data.currentVotePair = vote.pair;
	}

	this.isWaiting = false;

	var buttonDims = [
		{x: innerWidth * 0.05, y: innerHeight * 0.05, w: innerWidth * 0.9, h: innerHeight * 0.85/2},
		{x: innerWidth * 0.05, y: innerHeight * 0.55, w: innerWidth * 0.9, h: innerHeight * 0.85/2},
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


VoteManager.createTestVote = function(vote)
{

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

			if(this.fade == 0)this.isFading = false;
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
