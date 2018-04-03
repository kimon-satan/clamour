function VoteDisplayer()
{
	this.positions = [];

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
			console.log("setNumSlots");
			this.setNumSlots(msg.val.numSlots);
		}

	}.bind(this);

	this.setNumSlots = function(numSlots)
	{
		this.positions = [];

		for(var i = 0; i < numSlots; i++)
		{
			this.positions.push({x: innerWidth/3, y: innerHeight * (i+1)/(numSlots+2)})
		}

		//TODO only works for upto 4 slots - create an eight slot version
		console.log(this.positions);
	}.bind(this);

	this.displayVote = function(vote)
	{
		//window.clearInterval(this.voteFades[vote.dispIdx]);
		ctx.fillStyle = "#FFFFFF";
		ctx.font = "100px Arial";
		var pos = this.positions[vote.dispIdx];
		ctx.fillText(vote.text, pos.x,pos.y);
	}.bind(this);


	this.draw = function()
	{
		ctx.fillStyle = "rgba(0,0,0,0.05)";
		ctx.fillRect(0,0,innerWidth,innerHeight);
		requestAnimationFrame(this.draw);
	}.bind(this)

	this.setNumSlots(1);
	requestAnimationFrame(this.draw);


}
