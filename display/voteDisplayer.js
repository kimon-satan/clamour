function VoteDisplayer()
{
	this.positions = {ax: 0, bx: 0, y: [0,0,0,0]};
	this.staticFades = {a: [], b: []};
	this.activeFades = {a: [], b: []};
	this.slots = {a: [0,0,0,0], b: [0,0,0,0]};
	this.slotHeight = innerHeight * 0.75/4;
	this.slotWidth = innerWidth * 0.4;
	this.colsAlign = ["center", "center"];


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
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle'

	this.cmd = function(msg)
	{
		if(msg.cmd == "displayVote")
		{
			this.displayVote(msg.val);
		}
		else if (msg.cmd == "concludeVote")
		{
			this.concludeVote(msg.val);
		}
		else if (msg.cmd == "updateSlots")
		{
			this.updatePositions(msg.val);
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

		this.positions = {ax: 0, bx: 0, y: [0,0,0,0]};

		var maxRow = 0;
		var minRow = 4;
		var colsUsed = {a: false, b: false};

		//check what is being used
		for(var j = 0; j < k.length; j++)
		{
			for(var i = 0; i < this.slots[k[j]].length; i++)
			{
				if(this.slots[k[j]][i] != 0)
				{
					minRow = Math.min(minRow, i);
					maxRow = Math.max(maxRow, i);
					colsUsed[k[j]] = true;
				}
			}
		}

		if(!colsUsed.b && colsUsed.a)
		{
			this.positions.ax = innerWidth/2;
			this.positions.bx = 0;
			this.colsAlign = ["center", "center"];
		}
		else if(!colsUsed.a && colsUsed.b)
		{
			this.positions.bx = innerWidth/2;
			this.positions.ax = 0;
			this.colsAlign = ["center", "center"];
		}
		else
		{
			this.positions.ax = innerWidth * 0.28; //NB these are centers
			this.positions.bx = innerWidth * 0.72;
			this.colsAlign = ["right", "left"];
		}

		var incr = (innerHeight * 0.75)/(maxRow-minRow+2)
		for(var i = minRow; i < (maxRow + 1); i++)
		{
			this.positions.y[i] = innerHeight * 0.125 + incr * (i-minRow+1)
		}

		this.slotHeight = incr;
		this.slotWidth = innerWidth * 0.4;


	}.bind(this);

	this.displayVote = function(vote)
	{
		var col = vote.pos[0];
		var row = Number(vote.pos[1]);

		var f = this.activeFades[col][row];
		//12 colours and 12 fonts styles

		f.push({text: vote.text, alpha: 1.0, font: vote.font, col: vote.col});

		//bias fade towards the winner
		this.staticFades[col][row][0].alpha = Math.pow(vote.score[0],2);
		this.staticFades[col][row][1].alpha = Math.pow(vote.score[1],2);

		//TODO FIXME this is all a bit messy
		this.staticFades[col][row][vote.choice].text = vote.text;

		this.updatePositions(vote.slots);


	}.bind(this);

	this.concludeVote = function(vote)
	{

		var col = vote.pos[0];
		var row = Number(vote.pos[1]);

		this.staticFades[col][row][0].alpha = 1.0;
		this.staticFades[col][row][1].alpha = 0.0;
		this.staticFades[col][row][0].text = String(vote.text);

		this.updatePositions(vote.slots);

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

			//ctx.textAlign = this.colsAlign[i];

			for(var j = 0; j < this.slots[cols[i]].length; j++)
			{
				if(this.slots[cols[i]][j] != 0)
				{

					//DEBUG DRAWING

					// ctx.strokeStyle="red";
					// ctx.lineWidth="1";
					// ctx.strokeRect(
					// 	this.positions[cols[i]+"x"] - this.slotWidth/2,
					// 	this.positions.y[j] - this.slotHeight/2,
					// 	this.slotWidth,
					// 	this.slotHeight
					// );

					//do the drawing
					for(var k = 0; k < 2; k ++)
					{
						if(this.staticFades[cols[i]][j][k].alpha > 0)
						{
							ctx.fillStyle = "rgba(255,255,255," + String(this.staticFades[cols[i]][j][k].alpha) + ")";
							// ctx.fillText(this.staticFades[cols[i]][j][k].text,
							// 	this.positions[cols[i]+"x"], this.positions.y[j]);
							fitText(
								this.staticFades[cols[i]][j][k].text, //text to fit
								{x: this.positions[cols[i] + "x"] - this.slotWidth/2, y: this.positions.y[j] - this.slotHeight/2, w: this.slotWidth, h: this.slotHeight}, //rect
								"Arial",
								150,//starting font size
								ctx, //the canvas context
								this.colsAlign[i]
							);
						}
					}

					for(var k = 0; k < this.activeFades[cols[i]][j].length; k++)
					{
						//draw the text
						//console.log(this.activeFades[i][j]);
						ctx.fillStyle = "rgba(" + this.activeFades[cols[i]][j][k].col + "," + String(this.activeFades[cols[i]][j][k].alpha) + ")";

						fitText(
							this.activeFades[cols[i]][j][k].text, //text to fit
							{x: this.positions[cols[i] + "x"] - this.slotWidth/2, y: this.positions.y[j] - this.slotHeight/2, w: this.slotWidth, h: this.slotHeight}, //rect
							this.activeFades[cols[i]][j][k].font,
							150,//starting font size
							ctx, //the canvas context
							this.colsAlign[i]
						);
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
