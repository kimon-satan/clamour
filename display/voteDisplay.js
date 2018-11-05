function FadeObj()
{
	this.text = "";
	this.alpha = 0;
	this.highlight = 0;
	this.fadeout = 0;
	this.col = undefined;
	this.font = "Arial";
	this.isBlack = false;



	this.getFillStyle = function()
	{
		var r = 255;
		var g = 255 * (1 - this.highlight);
		var b = 255 * (1 - this.highlight);
		var a = this.alpha * (1 - this.fadeout);

		if(this.col != undefined)
		{
			return "rgba(" + this.col +  "," + a + ")";
		}
		else
		{
			return "rgba(" + r + "," + g +"," + b + "," + a + ")";
		}




	}

	this.increment = function(amt)
	{
		if(this.fadeout > 0)
		{
			this.fadeout = Math.min(1, this.fadeout + amt);
		}

		if(this.highlight > 0)
		{
			this.highlight = Math.min(1, this.highlight + amt);
		}

	}
}

function VoteDisplay(canvas)
{

	this.slotHeight = innerHeight * 0.75/4;
	this.slotWidth = innerWidth * 0.4;
	this.colsAlign = ["center", "center"];
	this.isActive = false;



	var reset = function()
	{

		this.positions = {ax: 0, bx: 0, y: [0,0,0,0]};
		this.staticFades = {a: [], b: []};
		this.activeFades = {a: [], b: []};

		this.slots = {a: [0,0,0,0], b: [0,0,0,0]};

		for(var i = 0; i < 4; i++)
		{
			this.staticFades.a.push([new FadeObj(),new FadeObj()]);
			this.staticFades.b.push([new FadeObj(),new FadeObj()]);
			this.activeFades.a.push([]);
			this.activeFades.b.push([]);
		}


	}.bind(this);



	reset();



	var ctx = canvas.getContext("2d");
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	this.fontSize = getMaxFontSize("Be subject to others",{w: this.slotWidth, h: this.slotHeight},"Arial",150,ctx);

	this.cmd = function(msg)
	{

		if(msg.cmd == "displayVote")
		{
			this.displayVote(msg.val);
		}
		else if (msg.cmd == "makeCall")
		{
			this.makeCall(msg.val);
		}
		else if (msg.cmd == "updateSlots")
		{
			this.updateSlots(msg.val);
		}
		else if(msg.cmd == "reset" || msg.cmd == "clear")
		{
			reset();
			this.updatePositions();
			this.isBlack = false;
		}
		else if(msg.cmd == "black")
		{
			this.isBlack = true;
		}

	}


	this.updatePositions = function()
	{
		//update the positions


		this.positions = {ax: 0, bx: 0, y: [0,0,0,0]};

		this.positions.ax = innerWidth * 0.28; //NB these are centers
		this.positions.bx = innerWidth * 0.72;
		this.colsAlign = ["right", "left"];
		this.slotWidth = innerWidth * 0.4;

		var incr = (innerHeight * 0.75)/5
		for(var i = 0; i < 4; i++)
		{
			this.positions.y[i] = innerHeight * 0.125 + incr * (i + 1)
		}

		this.slotHeight = incr;


	}.bind(this);


	this.displayVote = function(vote)
	{
		//console.log(vote);
		var col = vote.pos[0];
		var row = Number(vote.pos[1]);

		var f = this.activeFades[col][row];
		//12 colours and 12 fonts styles

		var fo = new FadeObj();

		fo.text = vote.text[vote.choice];
		fo.col = vote.col;
		fo.alpha = 1.0;
		fo.font = vote.font;
		fo.fadeout = 0.01;

		f.push(fo);


		//bias fade towards the winner

		for(var i = 0; i < 2; i++)
		{
			this.staticFades[col][row][i].alpha = Math.pow(vote.score[i],2);
			this.staticFades[col][row][i].fadeout = 0;
			this.staticFades[col][row][i].highlight = 0;
		}

		this.staticFades[col][row][vote.choice].text = vote.text[vote.choice];
		this.staticFades[col][row][(vote.choice+1)%2].text = vote.text[(vote.choice+1)%2];

		if(this.slots[col][row] != "_active_")
		{
			this.updateSlots(vote.slots);
			this.fontSize = this.getFontSize();
		}

	}.bind(this);


	this.updateSlots = function(slots)
	{
		this.slots = slots;
		var k = ["a","b"];

		for(var col = 0; col < 2; col++)
		{
			for(var row = 0; row < 4; row++)
			{
				let slot = this.slots[k[col]][row];

				for(var i = 0; i < 2; i++)
				{
					if(this.staticFades[k[col]][row][i].fadeout == 1)
					{
						this.staticFades[k[col]][row][i] = new FadeObj();
					}
				}

				if(slot == 0)
				{
					for(var i = 0; i < 2; i++)
					{
						if(this.staticFades[k[col]][row][i].text.length > 0)
						{
							this.staticFades[k[col]][row][i] = new FadeObj();
						}
					}
				}
				else if(slot != "_active_")
				{
					this.staticFades[k[col]][row][0].alpha = 1.0;
					this.staticFades[k[col]][row][1].alpha = 0.0;

					if(this.staticFades[k[col]][row][0].text != slot)
					{
						for(var i = 0; i < 2; i++)
						{
							this.staticFades[k[col]][row][i].text = slot;
							this.staticFades[k[col]][row][i].fadeout = 0;
							this.staticFades[k[col]][row][i].highlight = 0;
						}
					}

				}
				else if(slot == "_active_")
				{
					this.staticFades[k[col]][row][0].fadeout = 0;
					this.staticFades[k[col]][row][1].highlight = 0;
					this.staticFades[k[col]][row][0].fadeout = 0;
					this.staticFades[k[col]][row][1].highlight = 0;
				}

			}
		}

		this.fontSize = this.getFontSize();

	}

	this.makeCall = function(val)
	{
		this.updateSlots(val.slots);
		var cols = ["a","b"];

		for(var i = 0; i < cols.length; i ++)
		{
			var col = cols[i];
			for(var j = 0; j < 4; j++)
			{
				var row = j;
				var id = col+row;

				if(val.seq.indexOf(id) > -1)
				{
					this.staticFades[col][row][0].highlight = 0.01;
				}
				else
				{
					this.staticFades[col][row][0].fadeout = 0.01;
				}
			}
		}


	}

	this.getFontSize = function()
	{
		ctx.font = "100px Arial";

		var cols = ["a", "b"];

		//find the current longest string

		var widest = 0;
		var text = "";

		for(var i = 0; i < cols.length; i++)
		{
			for(var j = 0; j < this.slots[cols[i]].length; j++)
			{
				for(var k = 0; k < 2; k ++)
				{
					var metrics = ctx.measureText(this.staticFades[cols[i]][j][k].text);

					if(widest < metrics.width)
					{
						text = this.staticFades[cols[i]][j][k].text;
						widest = metrics.width;
					}
				}
			}
		}

		return getMaxFontSize(text,{w: this.slotWidth, h: this.slotHeight},"Arial",150,ctx);
	}

	this.draw = function()
	{

		//clear the background
		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);

		if(this.isBlack)return;

		//draw the static state of each vote
		var cols = ["a", "b"];

		for(var i = 0; i < cols.length; i++)
		{

			//ctx.textAlign = this.colsAlign[i];

			for(var j = 0; j < this.slots[cols[i]].length; j++)
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

				if(this.slots[cols[i]][j] != 0)
				{

					//do the drawing
					for(var k = 0; k < 2; k ++)
					{
						if(this.staticFades[cols[i]][j][k].alpha > 0)
						{
							ctx.fillStyle = this.staticFades[cols[i]][j][k].getFillStyle();

							drawText(
								this.staticFades[cols[i]][j][k].text, //text to fit
								{x: this.positions[cols[i] + "x"] - this.slotWidth/2, y: this.positions.y[j] - this.slotHeight/2, w: this.slotWidth, h: this.slotHeight}, //rect
								"Arial",
								this.fontSize,//starting font size
								ctx, //the canvas context
								this.colsAlign[i]
							);

							this.staticFades[cols[i]][j][k].increment(0.03);


						}
					}




				}

				for(var k = 0; k < this.activeFades[cols[i]][j].length; k++)
				{
					//draw the text
					ctx.fillStyle = this.activeFades[cols[i]][j][k].getFillStyle();

					drawText(
						this.activeFades[cols[i]][j][k].text, //text to fit
						{x: this.positions[cols[i] + "x"] - this.slotWidth/2, y: this.positions.y[j] - this.slotHeight/2, w: this.slotWidth, h: this.slotHeight}, //rect
						this.activeFades[cols[i]][j][k].font,
						this.fontSize,//starting font size
						ctx, //the canvas context
						this.colsAlign[i]
					);
				}

				//remove any fadeout activeFades
				for(var k = this.activeFades[cols[i]][j].length -1; k >= 0; k--)
				{
					//decrement the fades
					this.activeFades[cols[i]][j][k].increment(0.01);
					if(this.activeFades[cols[i]][j][k].fadeout == 1)
					{
						this.activeFades[cols[i]][j].splice(k,1);
					}
				}

			}

		}


		if(this.isActive)requestAnimationFrame(this.draw);

	}.bind(this)


	this.setActive = function(isActive)
	{
		if(!this.isActive && isActive)
		{
			this.isActive = isActive;
			this.draw();
			this.isBlack = false;
		}
		else
		{
			this.isActive = isActive;
		}

	}.bind(this);

	this.updatePositions();

}
