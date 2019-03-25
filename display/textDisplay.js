var TextDisplay = function(canvas,xoff,yoff,scale)
{
	this.isActive = false;
	this.isBlack = false;
	var ctx = canvas.getContext("2d");
	this.alpha = 0;
	this.xoff = xoff * innerWidth;
	this.yoff = yoff * innerHeight;
	this.scale = scale;

	this.cmd = function(msg)
	{
		if(msg.cmd == 'black')
		{
			this.isBlack = true;
		}
		else if(msg.cmd == 'clear')
		{
			this.isBlack = false;
		}
	}

	this.draw = function()
	{
		ctx.setTransform();
		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);

		ctx.translate(this.xoff, this.yoff);
		ctx.scale(this.scale, this.scale);

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
		fitText("2. Join Bguest Wifi - username: guest, password: bristol", {x: innerWidth/8, y: innerHeight * 5/16, w: innerWidth * 3/4, h: innerHeight/8}, "Arial", 30, ctx, "center");
		fitText("3. Open a browser (chrome, safari)", {x: innerWidth/4, y: innerHeight * 3/8, w: innerWidth/2, h: innerHeight/8}, "Arial", 30, ctx, "center");
		fitText("4. Go to http://clamour.info", {x: innerWidth/4, y: innerHeight * 7/16, w: innerWidth/2, h: innerHeight/8}, "Arial", 30, ctx, "center");

		fitText("Ask for me help if you need it", {x: innerWidth/4, y: innerHeight * 6/8, w: innerWidth/2, h: innerHeight/8}, "Arial", 25, ctx, "center");



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
