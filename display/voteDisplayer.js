function VoteDisplayer()
{
	this.positions = {ax: 0, bx: 0, y: [0,0,0,0]};
	this.staticFades = {a: [], b: []};
	this.activeFades = {a: [], b: []};
	this.slots = {a: [0,0,0,0], b: [0,0,0,0]};

	for(var i = 0; i < 4; i++)
	{
		this.staticFades.a.push([{text: "option 1", alpha: 0},{text: "option 2", alpha: 0}]);
		this.staticFades.b.push([{text: "option 1", alpha: 0},{text: "option 2", alpha: 0}]);
		this.activeFades.a.push([]);
		this.activeFades.b.push([]);
	}

	$('#displayscreen').append("<canvas id='voteContainer' width='" + innerWidth + "px' height='" + innerHeight + "px'></canvas>");

	var c = $("#voteContainer")[0];
	var ctx = c.getContext("2d");

	this.cmd = function(msg)
	{
		if(msg.cmd == "displayVote")
		{
			this.displayVote(msg.val);
		}
		else if(msg.cmd == "setNumSlots")
		{
			this.setNumSlots(msg.val.numSlots);
		}
		else if (msg.cmd == "concludeVote")
		{
			this.concludeVote(msg.val);
		}

	}.bind(this);

	this.updatePositions = function(slots)
	{
		//update the positions
		var k = ["a","b"];
		var isNeedsUpdate = false;

		for(var j = 0; j < k.length; j++)
		{
			for(var i = 0; i < slots[k[j]].length; i++)
			{
				if(
					(slots[k[j]][i] != 0 && this.slots[k[j]][i] == 0)
				|| (slots[k[j]][i] == 0 && this.slots[k[j]][i] != 0)
				)
				{
					isNeedsUpdate = true;
					this.slots = slots;
					break;
				}
			}
			if(isNeedsUpdate)break;
		}

		if(!isNeedsUpdate)
		{
			return;
		}

		console.log(this.slots);

		this.positions = {ax: 0, bx: 0, y: [0,0,0,0]};

		var maxRow = 0;
		var colsUsed = {a: false, b: false};

		//check what is being used
		for(var j = 0; j < k.length; j++)
		{
			for(var i = 0; i < this.slots[k[j]].length; i++)
			{
				if(this.slots[k[j]][i] != 0)
				{
					maxRow = Math.max(maxRow, i);
					colsUsed[k[j]] = true;
				}
			}
		}

		console.log(maxRow, colsUsed);

		if(!colsUsed.b && colsUsed.a)
		{
			this.positions.ax = innerWidth/2;
			this.positions.bx = 0;
		}
		else if(!colsUsed.a && colsUsed.b)
		{
			this.positions.bx = innerWidth/2;
			this.positions.ax = 0;
		}
		else
		{
			this.positions.ax = innerWidth * 3/8;
			this.positions.bx = innerWidth * 5/8;
		}

		var incr = (innerHeight * 0.875)/(maxRow+2)
		for(var i = 0; i < (maxRow + 1); i++)
		{
			this.positions.y[i] = innerHeight * 0.125 + incr * (i+1)
		}


	}.bind(this);

	this.displayVote = function(vote)
	{

		var col = vote.pos[0];
		var row = Number(vote.pos[1]);

		var f = this.activeFades[col][row];
		//TODO 12 colours and 12 fonts styles

		f.push({text: vote.text, alpha: 1.0, font: vote.font, col: vote.col});

		//bias fade towards the winner
		this.staticFades[col][row][0].alpha = Math.pow(vote.score[0],2);
		this.staticFades[col][row][1].alpha = Math.pow(vote.score[1],2);

		//FIXME this is all a bit messy
		this.staticFades[col][row][vote.choice].text = vote.text;

		this.updatePositions(vote.slots);


	}.bind(this);

	this.concludeVote = function(vote)
	{

		return;
		var i = Number(vote.dispIdx);
		var w = Number(vote.winner);
		this.staticFades[i][w].alpha = 1.0;
		this.staticFades[i][(w + 1)%2].alpha = 0.0;

	}.bind(this);



	this.draw = function()
	{

		//clear the background
		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);

		//draw the static state of each vote
		ctx.font = "100px Arial";

		var cols = ["a", "b"]

		for(var i = 0; i < cols.length; i++)
		{
			for(var j = 0; j < this.slots[cols[i]].length; j++)
			{
				if(this.slots[cols[i]][j] != 0)
				{
					//do the drawing
					for(var k = 0; k < 2; k ++)
					{
						if(this.staticFades[cols[i]][j][k].alpha > 0)
						{
							ctx.fillStyle = "rgba(255,255,255," + String(this.staticFades[cols[i]][j][k].alpha) + ")";
							ctx.fillText(this.staticFades[cols[i]][j][k].text,
								this.positions[cols[i]+"x"], this.positions.y[j]);
						}
					}

					for(var k = 0; k < this.activeFades[cols[i]][j].length; k++)
					{
						//draw the text
						//console.log(this.activeFades[i][j]);
						ctx.fillStyle = "rgba(" + this.activeFades[cols[i]][j][k].col + "," + String(this.activeFades[cols[i]][j][k].alpha) + ")";
						ctx.font = "100px " + this.activeFades[cols[i]][j][k].font;
						ctx.fillText(this.activeFades[cols[i]][j][k].text,
							this.positions[cols[i] + "x"], this.positions.y[j]);
					}


				}

				//remove any fadedout activeFades
				for(var k = this.activeFades[cols[i]][j].length -1; k >= 0; k--)
				{
					//decrement the fades
					this.activeFades[cols[i]][j][k].alpha -= 0.01; // decrement separately
					if(this.activeFades[cols[i]][j][k].alpha <= 0)
					{
						this.activeFades[cols[i]][j].splice(k,1);
					}
				}

			}

		}


		requestAnimationFrame(this.draw);

	}.bind(this)

	requestAnimationFrame(this.draw);

}
