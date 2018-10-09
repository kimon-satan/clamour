var Story = function(canvas)
{

	this.isActive = false;
	var ctx = canvas.getContext("2d");

	this.draw = function()
	{

		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);
		ctx.fillStyle = "white";
		ctx.fillRect(0,0,innerWidth/2,innerHeight/2);

		if(this.isActive)requestAnimationFrame(this.draw);
	}.bind(this);

	this.setActive = function(isActive)
	{
		if(!this.isActive && isActive)
		{
			this.isActive = isActive;
			this.draw();
			console.log("draw");
		}
		else
		{
			this.isActive = isActive;
		}

	}.bind(this);
}
