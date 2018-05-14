VoteManager = function(parent)
{

	//maybe reduce size to improve performance
	this.parent = parent;
	this.previousVotes = {};
	this.currentVotePair = null;
	this.isWaiting = true;

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


			this.context.font = "60pt " + this.parent.data.font;

			this.context.fillStyle = "rgba(" + this.parent.data.fontCol + ",1.0)";
			this.context.fillText(
				this.parent.data.currentVotePair[0],
				innerWidth * 0.5,
				innerHeight * 0.25
			);

			this.context.fillStyle = "rgba(" + this.parent.data.fontCol + ",1.0)";

			var txt = this.fitText(
				this.parent.data.currentVotePair[1],
				innerWidth * 0.85,
				70);

			// this.context.fillText(
			// 	this.parent.data.currentVotePair[1],
			// 	innerWidth * 0.5,
			// 	innerHeight * 0.75
			// );

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

VoteManager.prototype.createVote = function(vote)
{
	//TODO persistence on refresh
	this.parent.data.currentVoteId = vote.id;
	this.parent.data.currentVotePair = vote.pair;
	this.isWaiting = false;

}

VoteManager.prototype.fitText = function(text, maxWidth, fontSize)
{
	this.context.font = fontSize + "pt " + this.parent.data.font;
	var words = text.split(' ');

	//reduce fontSize to fit longest word
	for(var i = 0; i < words.length; i++)
	{
		var metrics = this.context.measureText(words[i]);
		while(metrics.width > maxWidth)
		{
			fontSize -= 1; //reduce the fontSize a bit
			this.context.font = fontSize + "pt " + this.parent.data.font;
			metrics = this.context.measureText(words[i]);
		}
	}

	var line = words[0];
	var lines = [];
	var numWords = 1;

	while(words.length > 1)
	{
		var testLine = line + ' ' + words[1];
		var metrics = this.context.measureText(testLine);
		if (metrics.width > maxWidth)
		{
			lines.push(line); //add whatever we had before
			line = words[1];
			numWords = 1;
		}
		else
		{
			line = testLine;
			numWords++;
		}
		words.splice(0,1);
		if(words.length <= 1)
		{
			lines.push(line);
		}
	}

	//TODO fit the text into the box

	return lines;


}

VoteManager.createTestVote = function(vote)
{

}
