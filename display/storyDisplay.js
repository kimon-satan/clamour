var StoryDisplay = function(imagepath, story, canvas)
{

	this.isActive = false;
	this.currentImage;
	this.oldImage;
	this.currentImageAlpha = 0.0;
	this.oldImageFadeAlpha = 0.0;

	var ctx = canvas.getContext("2d");
	var images = {};

	var preloadimages = function(_imagepath, _story)
	{
		var loadedImages = 0;
		var numImages = 0;

		//count the images
		for(var i = 0; i < _story.length; i++)
		{
			if(_story[i].clips != undefined)
			{
				for(var j = 0; j < _story[i].clips.length; j++)
				{
					if(_story[i].clips[j].img != undefined)
					{
						numImages++;
					}
				}
			}
		}

		var p = new Promise(function(resolve, reject)
		{
			for(var i = 0; i < _story.length; i++)
			{
				if(_story[i].clips != undefined)
				{
					for(var j = 0; j < _story[i].clips.length; j++)
					{
						if(_story[i].clips[j].img != undefined)
						{
							let src = _story[i].clips[j].img;
							images[src] = new Image();
							images[src].onload = function()
							{
								if(++loadedImages >= numImages)
								{
									resolve("loaded " + loadedImages + " images");
								}
							}

							images[src].src = _imagepath + src;

						}

					}
				}
			}
		})

		return p;

	}

	preloadimages(imagepath, story)

	.then((doc)=>
	{
		console.log(doc);
	})

	this.cmd = function(msg)
	{
		if(msg.cmd == 'blank')
		{
			//console.log(blank)
			this.oldImage = this.currentImage;
			this.currentImage = undefined;
			if(msg.val.isFade)
			{
				this.oldImageAlpha = 1.0;
			}
			else
			{
				this.oldImageAlpha = 0.0;
			}

		}
		else if(msg.cmd == 'image')
		{
			this.oldImage = this.currentImage;
			this.currentImage = msg.val.src;
			if(msg.val.isFade)
			{
				this.currentImageAlpha = 0;
				this.oldImageAlpha = 1.0;
			}
			else
			{
				this.currentImageAlpha = 1.0;
				this.oldImageAlpha = 0;
			}

		}
	}

	this.draw = function()
	{

		ctx.fillStyle = "rgba(0,0,0,1.0)";
		ctx.fillRect(0,0,innerWidth,innerHeight);

		if(this.oldImage)
		{
			ctx.save();
			ctx.globalAlpha = this.oldImageAlpha;
			ctx.drawImage(images[this.oldImage], 0,0,innerWidth,innerHeight);
			ctx.restore();

			if(this.oldImageAlpha > 0)
			{
				this.oldImageAlpha -= 0.01;
				this.oldImageAlpha = Math.max(0,this.oldImageAlpha);
			}
		}

		if(this.currentImage)
		{
			ctx.save();
			ctx.globalAlpha = this.currentImageAlpha;
			ctx.drawImage(images[this.currentImage], 0,0,innerWidth,innerHeight);
			ctx.restore();

			if(this.currentImageAlpha < 1.0)
			{
				this.currentImageAlpha += 0.01;
				this.currentImageAlpha = Math.min(1,this.currentImageAlpha);
			}
		}


		if(this.isActive)requestAnimationFrame(this.draw);

	}.bind(this);

	this.setActive = function(isActive)
	{
		if(!this.isActive && isActive)
		{
			this.isActive = isActive;
			this.draw();
		}
		else
		{
			this.isActive = isActive;
		}

	}.bind(this);

}
