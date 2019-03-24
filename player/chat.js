ChatManager = function(parent)
{
	this.parent = parent;
	this.currentChat = [""];
	this.maxFont = Math.min(window.innerHeight / 10, window.innerWidth / 15);
	this.counter = 0;

	this.clear = function()
	{
		this.currentChat = [""];
	}

	this.newLine = function()
	{
		this.currentChat.push("");

		if(this.currentChat.length > 6)
		{
			this.currentChat.shift();
		}
	}

	this.update = function(text)
	{
		this.currentChat.pop();
		this.currentChat.push(text);
	}

	this.draw = function()
	{
		this.context.fillStyle = "rgba(0,0,0,1.0)";
		this.context.fillRect(0,0,innerWidth, innerHeight);
		this.context.textAlign = 'left';
		this.context.textBaseline = 'bottom';
		this.context.fillStyle = '#CCCCCC';
		this.context.font = this.maxFont + "pt Arial";
		var lh = this.maxFont;
		var voff = this.maxFont * 2;
		var cursorx = window.innerWidth * 0.02;

		for(var i = 0; i < this.currentChat.length; i++)
		{
			var dims = {w: window.innerWidth * 0.96, h:0, x: window.innerWidth * 0.02, y: voff};
			dims = wrapText(this.currentChat[i], dims, 'Arial', this.maxFont, this.context, "left");
			voff = dims.y;
			cursorx = dims.x;
		}

		this.context.fillRect
		(
			cursorx,
			voff - this.maxFont * 1.5,
			this.maxFont * 0.75,
			this.maxFont * 1.5
		);

		this.counter++;

		requestAnimationFrame(this.draw);


	}.bind(this);

	this.initCanvas = function()
	{
		this.clear();
		this.canvas = $('#chatCanvas')[0];
		this.context = this.canvas.getContext("2d");

		this.draw();
	}
}
