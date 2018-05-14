function VoteDisplayer()
{
	this.positions = [];
	this.staticFades = [];
	this.activeFades = [];

	for(var i = 0; i < 8; i++)
	{
		this.staticFades.push([{text: "option 1", alpha: 0},{text: "option 2", alpha: 0}]);
		this.activeFades.push([]);
	}

	$('#displayscreen').append("<canvas id='voteContainer' width='" + innerWidth + "px' height='" + innerHeight + "px'></canvas>");

	var c = $("#voteContainer")[0];
	var ctx = c.getContext("2d");

	this.cmd = function(msg)
	{
		if(msg.cmd == "displayVote")
		{
			if(msg.val.dispIdx >= 0)
			{
				this.displayVote(msg.val);
			}
		}
		else if(msg.cmd == "setNumSlots")
		{
			this.setNumSlots(msg.val.numSlots);
		}

	}.bind(this);

	this.setNumSlots = function(numSlots)
	{
		//update the positions
		this.positions = [];
		for(var i = 0; i < numSlots; i++)
		{
			this.positions.push({x: innerWidth/3, y: innerHeight * (i+1)/(numSlots+2)});
		}

		//TODO only works for upto 4 slots - create an eight slot version

	}.bind(this);

	this.displayVote = function(vote)
	{

		var i = Number(vote.dispIdx);
		var f = this.activeFades[i];
		//TODO 12 colours and 12 fonts styles

		f.push({text: vote.text, alpha: 1.0, font: vote.font, col: vote.col});

		//bias fade towards the winner
		this.staticFades[i][0].alpha = Math.pow(vote.score[0],2);
		this.staticFades[i][1].alpha = Math.pow(vote.score[1],2);

		//FIXME this is all a bit messy
		this.staticFades[i][vote.choice].text = vote.text;

	}.bind(this);


	this.draw = function()
	{

		//clear the background
		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);


		//draw the static state of each vote
		ctx.font = "100px Arial";
		for(var i = 0; i < this.positions.length; i++)
		{
			for(var j = 0; j < 2; j ++)
			{
				ctx.fillStyle = "rgba(255,255,255," + String(this.staticFades[i][j].alpha) + ")";
				ctx.fillText(this.staticFades[i][j].text,
					this.positions[i].x, this.positions[i].y);
			}
		}

		//okay now we can draw the active state
		for(var i = 0; i < this.positions.length; i++)
		{
			for(var j = 0; j < this.activeFades[i].length; j++)
			{


				//draw the text
				//console.log(this.activeFades[i][j]);
				ctx.fillStyle = "rgba(" + this.activeFades[i][j].col + "," + String(this.activeFades[i][j].alpha) + ")";
				ctx.font = "100px " + this.activeFades[i][j].font;
				ctx.fillText(this.activeFades[i][j].text, this.positions[i].x, this.positions[i].y);

				//decrement the fades
				this.activeFades[i][j].alpha -= 0.01;
			}

			//remove any fadedout activeFades
			for(var j = this.activeFades[i].length -1; j >= 0; j--)
			{
				if(this.activeFades[i][j].alpha <= 0)
				{
					this.activeFades[i].splice(j,1);
				}
			}

		}


		requestAnimationFrame(this.draw);

	}.bind(this)

	this.setNumSlots(1);
	requestAnimationFrame(this.draw);

}
