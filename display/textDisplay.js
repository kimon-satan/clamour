var TextDisplay = function(canvas)
{
	this.isActive = false;
	this.isBlack = false;
	var ctx = canvas.getContext("2d");
	this.alpha = 0;

	this.cmd = function(msg)
	{
		if(msg.cmd == 'black')
		{
			this.isBlack = true;
		}
	}

	this.draw = function()
	{
		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);

		if(this.isBlack)
		{
			if(this.alpha > 0)this.alpha -= 0.01;
		}
		else
		{
			if(this.alpha < 1)this.alpha += 0.01;
		}

		ctx.fillStyle = "rgba(255,255,255," + this.alpha + ")";

		//ctx.fillRect(0,0,innerWidth,innerHeight);
		fitText("Clamour - Instructions", {x: innerWidth/4, y: 0, w: innerWidth/2, h: innerHeight/4}, "Arial", 50, ctx, "center");
		fitText("1. Take out your phone", {x: innerWidth/4, y: innerHeight/4, w: innerWidth/2, h: innerHeight/8}, "Arial", 30, ctx, "center");
		fitText("2. Open a browser", {x: innerWidth/4, y: innerHeight * 3/8, w: innerWidth/2, h: innerHeight/8}, "Arial", 30, ctx, "center");
		fitText("3. Go to http://clamour.info", {x: innerWidth/4, y: innerHeight/2, w: innerWidth/2, h: innerHeight/8}, "Arial", 30, ctx, "center");

		fitText("Ask the assistants for help", {x: innerWidth/4, y: innerHeight * 6/8, w: innerWidth/2, h: innerHeight/8}, "Arial", 25, ctx, "center");



		if(this.isActive)requestAnimationFrame(this.draw);
	}.bind(this);

	this.setActive = function(isActive)
	{
		if(!this.isActive && isActive)
		{
			this.isBlack = false;
			this.isActive = isActive;
			this.draw();
		}
		else
		{
			this.isActive = isActive;
		}

	}.bind(this);
}
