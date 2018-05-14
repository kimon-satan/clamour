VoteManager = function(parent)
{

	//maybe reduce size to improve performance
	this.parent = parent;
	this.previousVotes = {};
	this.isWaiting = true;

	this.draw = function()
	{
		this.context.fillStyle = "rgba(0,0,0,1.0)";
		this.context.fillRect(0,0,innerWidth, innerHeight);

		if(this.isWaiting)
		{
			this.context.textAlign = 'center';
			this.context.fillStyle = '#FFFFFF';
			this.context.font = "100px Arial";
			this.context.fillText('Waiting', this.canvas.width/2, this.canvas.height/2);
		}
		else
		{
			//draw the votes here
			this.context.fillStyle = "rgba(80,80,80,1.0)";
			this.context.fillRect(
				innerWidth * 0.05,
				innerHeight * 0.05,
				innerWidth * 0.9,
				innerHeight * 0.85/2);

			this.context.fillRect(
				innerWidth * 0.05,
				innerHeight * 0.55,
				innerWidth * 0.9,
				innerHeight * 0.85/2
			);
		}

		requestAnimationFrame(this.draw);
	}.bind(this);

	//TODO touchReleased event

}

VoteManager.prototype.startDrawing = function()
{
	this.canvas = $('#voteCanvas')[0];
	this.context = this.canvas.getContext("2d");
	this.draw();
}

VoteManager.prototype.wait = function(){
	this.isWaiting = true;
}

VoteManager.prototype.createVote = function(){
	this.isWaiting = false;
}
