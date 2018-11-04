var globals = require('./globals.js');
var helpers = require('./helpers.js');
var fs = require('fs');

exports.handleSubrooms = function(room, options, cli_id)
{
	if(options.sub != undefined)
	{
		helpers.subRoom(room, options.sub, function(r)
		{
			globals.storyRooms = [];

			globals.admin.emit('server_report', {id: cli_id, msg: r});

			for(var i = 0; i < options.sub; i++)
			{
				globals.storyRooms.push(room + "_" + i);
			}

		})
	}
	else
	{
		//NB. this doesn't guarantee that the right players are memebers
		globals.storyRooms = [];
		var re = new RegExp(room + ".+", "g");
		globals.Rooms.find({room: { $regex: re }}, 'room').then((docs)=>
		{
			for(var i = 0; i < docs.length; i++)
			{
				globals.storyRooms.push(docs[i].room);
			}
			globals.admin.emit('server_report', {id: cli_id, msg: docs.length + " subrooms found"});
		});

	}
}

exports.load = function(cb)
{
	//load the audio samples
	helpers.sendSCMessage(
	{
		address: "/loadSamples",
		args: [globals.settings.samplePath]
	});

	//load the story object

	fs.readFile(globals.settings.storyPath, 'utf8', function (err, data)
	{
		globals.story = JSON.parse(data);
		globals.storyChapter = 0;
		globals.storyClip = 0;
		globals.storyCurrText = [""];
		globals.storyNumChars = 0;

		if(cb != undefined)
		{
			cb(err);
		}
	});
}

var incrementClip = function()
{
	globals.storyClip += 1;

	if(globals.storyClip > globals.story[globals.storyChapter].clips.length - 1)
	{
		if(globals.storyChapter < globals.story.length -1)
		{
			globals.storyChapter += 1;  //increment the stage
			globals.storyClip = 0;
		}
		else
		{
			globals.storyClip = globals.story[globals.storyChapter].clips.length - 1; //stay where we are
		}
	}

}

exports.startClip = function(room)
{

	var img = globals.story[globals.storyChapter].clips[globals.storyClip].img;
	var blank = globals.story[globals.storyChapter].clips[globals.storyClip].blank;
	var isFade = globals.story[globals.storyChapter].clips[globals.storyClip].isFade ? true : false;

	if(img)
	{
		var img_path = img;
		globals.display.emit('cmd', {type: 'story', cmd: "image", val: {src: img_path, isFade: isFade}});
		globals.DisplayState.storyMedia = "img";
	}
	else
	{
		globals.display.emit('cmd', {type: 'story', cmd: "blank", val: {isFade: isFade}});
		globals.DisplayState.storyMedia = "blank";
	}

	var audio_options = [];
	audio_options.push(globals.story[globals.storyChapter].clips[globals.storyClip].audio);
	audio_options.push(globals.story[globals.storyChapter].clips[globals.storyClip].audio1);
	audio_options.push(globals.story[globals.storyChapter].clips[globals.storyClip].audio2);

	for(var i = 0; i < 3; i++)
	{
		if(audio_options[i])
		{
			var cloned = Object.assign({}, audio_options[i]);
			cloned.channel = i;
			helpers.playSound(cloned);
		}
		else
		{
			//we need to trigger the end of the old sound
			helpers.sendSCMessage(
			{
				address: "/polyOff",
				args: ["channel", i]
			});
		}
	}

	//NB. at some point we might need the option not to clear the screen
	if(room != undefined)globals.players.to(room).emit('cmd', {cmd: 'chat_clear'});

	globals.storyCurrText = [""];
	globals.storyNumChars = 0;

}

exports.clear = function(msg)
{
	var txts = globals.story[globals.storyChapter].clips[globals.storyClip].texts;
	if(txts.length > 1 && globals.storyRooms.length > 1)
	{
		//send the clear to room 0
		globals.storyCurrText.push("");
		globals.players.to(globals.storyRooms[0]).emit('cmd', {cmd: 'chat_clear'});

		for(var i = 1; i < globals.storyRooms.length; i++)
		{
			var tidx = i%txts.length;
			if(tidx == 0)
			{
				//send the clear
				globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_clear'});
			}
		}
	}
	else
	{
		globals.storyCurrText.push("");
		globals.players.to(msg.room).emit('cmd', {cmd: 'chat_clear'});
	}
}

exports.update = function(msg)
{
	if(globals.story[globals.storyChapter].clips[globals.storyClip].texts != undefined) //check this clip has text
	{
		var txts = globals.story[globals.storyChapter].clips[globals.storyClip].texts;

		if(txts.length > 1 && globals.storyRooms.length > 1) //we only need to bother if there are alternative texts
		{

			//the first room gets the original text
			globals.players.to(globals.storyRooms[0]).emit('cmd', {cmd: 'chat_update', value: msg.value});

			globals.storyCurrText[globals.storyCurrText.length - 1] = msg.value;

			//count the characters
			var num_chars = 0;
			for(var i = 0; i < globals.storyCurrText.length; i++)
			{
				num_chars += globals.storyCurrText[i].length;
			}

			//TODO implement new lines for dummy text
			var prog = Math.min(1.0,num_chars/(txts[0].length * 0.9)); // slightly optimisitic to account for typos etc

			for(var i = 1; i < globals.storyRooms.length; i++)
			{

				//new line and clear will also need to work this out
				var tidx = i%txts.length;
				if(tidx == 0)
				{
					//send the original text
					globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_update', value: msg.value});
				}
				else if(num_chars > globals.storyNumChars)//alternative texts only go forwards ... delete is ignored
				{

					var l = prog * txts[tidx].length;
					var n = txts[tidx].substring(0,l);
					r = /[%$]{1}([^%^$]*?)$/;
					res = r.exec(n);

					//determine room to send

					if(res == null)
					{
						//before any special char
						globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_update', value: n});
					}
					else if(res[0] == "%")
					{
						globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_newline'});
					}
					else if(res[0] == "$")
					{
						globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_clear'});
					}
					else
					{
						globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_update', value: res[1]});
					}
				}


			}

			if(num_chars > globals.storyNumChars)globals.storyNumChars = num_chars;
		}
		else
		{
			//otherwise just send to all
			globals.players.to(msg.room).emit('cmd', {cmd: 'chat_update', value: msg.value});
		}

	}
}

exports.newline = function(msg)
{
	var txts = globals.story[globals.storyChapter].clips[globals.storyClip].texts;
	//catch error here
	if(txts.length > 1 && globals.storyRooms.length > 1)
	{
		if(txts.length > 1 && globals.storyRooms.length > 1)
		{
			//send the new line to room 0
			globals.storyCurrText.push("");
			globals.players.to(globals.storyRooms[0]).emit('cmd', {cmd: 'chat_newline'});

			for(var i = 1; i < globals.storyRooms.length; i++)
			{
				var tidx = i%txts.length;
				if(tidx == 0)
				{
					//send the return
					globals.players.to(globals.storyRooms[i]).emit('cmd', {cmd: 'chat_newline'});
				}
			}
		}
		else
		{
			globals.storyCurrText.push("");
			globals.players.to(msg.room).emit('cmd', {cmd: 'chat_newline'});
		}
	}
}

exports.next = function(msg)
{
	incrementClip();
	exports.startClip(msg.room);
	globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter: " + globals.storyChapter + ", clip: " + globals.storyClip });
}

exports.reset = function(msg)
{
	globals.storyChapter = 0;
	globals.storyClip = 0;
	exports.startClip(msg.room);
	globals.admin.emit('server_report', {id: msg.cli_id});
}

exports.goto = function(msg)
{
	helpers.parseOptions(msg.args, function(options){
		if(options.chapter != undefined)
		{

			if(!isNaN(options.chapter) && options.chapter != '')
			{
				globals.storyChapter = Math.max(0,options.chapter);
				globals.storyClip = 0;
				exports.startClip(msg.room);
				globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter " + options.chapter + " : " + globals.story[options.chapter].name});
				return;
			}
			else {

				for(var i = 0; i < globals.story.length; i++)
				{
						if(globals.story[i].name == options.chapter)
						{
							globals.storyChapter = i;
							globals.storyClip = 0;
							exports.startClip(msg.room);
							globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter " + i + " : " + globals.story[i].name});
							return;
						}
				}

			}

		}

		globals.admin.emit('server_report', {id: msg.cli_id, msg: "chapter not found"});
	});
}
