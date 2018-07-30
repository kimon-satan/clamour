/////////////////////////////// COMMANDS ////////////////////////////////

/* basic commands */

function basicCmd(cmd, args, cli)
{
	var msgobj = {cmd: cmd, args: args, cli_id: cli.idx, mode: cli.cli_mode, room: cli.room}
  socket.emit('cmd', msgobj);
}

var cmdList = [

	"lplayers", //player management
	"stats",
	"close",
	"lrooms",
	"cleanup",
	"resetall",
	"set",
	"sub",
	"end",

	"sreload", //story stuff
	"sreset",
	"sgoto",

	"vnew",
	"vjoin",
	"lvotes"
];

for(var i = 0; i < cmdList.length; i++)
{
	var funstr = 'basicCmd("' + cmdList[i] + '", arguments[0], arguments[1])';
	CLMR_CMDS["_" + cmdList[i]] = new Function(funstr);
}

/* changing modes */

function changeMode(mode, args, cli)
{
	cli.cli_mode = mode;
	var msgobj = {cmd: "change_mode", args: args, cli_id: cli.idx, mode: cli.cli_mode, room: cli.room}
	socket.emit('cmd', msgobj);
}

var cmdList = ["wait", "blank", "chat", "story", "vote", "love"];

for(var i = 0; i < cmdList.length; i++)
{
	var funstr = 'changeMode("' + cmdList[i] + '", arguments[0], arguments[1])';
	CLMR_CMDS["_" + cmdList[i]] = new Function(funstr);
}


/* display commands */

function displayCmd(cmd, args, cli)
{
	var msgobj = {cmd: cmd, args: args, cli_id: cli.idx, room: cli.room}
  socket.emit('disp_cmd', msgobj);
}

var cmdList = [
	"dinstruct",
	"dlove",
	"dstory",
	"dvote",
	"dclear",
	"dtransform",
	"dsplat"
];

for(var i = 0; i < cmdList.length; i++)
{
	var funstr = 'displayCmd("' + cmdList[i] + '", arguments[0], arguments[1])';
	CLMR_CMDS["_" + cmdList[i]] = new Function(funstr);
}

/* sound commands */

function soundCmd(cmd, args, cli)
{
	var msgobj = {cmd: cmd, args: args, cli_id: cli.idx, mode: cli.cli_mode, room: cli.room}
  socket.emit('sound_cmd', msgobj);
}

var cmdList = [
	"killsound",
	"play",
	"reloadsamples"
];

for(var i = 0; i < cmdList.length; i++)
{
	var funstr = 'soundCmd("' + cmdList[i] + '", arguments[0], arguments[1])';
	CLMR_CMDS["_" + cmdList[i]] = new Function(funstr);
}

/* cli stuff */

CLMR_CMDS["_killProcs"] = function(args, cli)
{
  Object.keys(gProcs).forEach(function(e){
    clearInterval(gProcs[e].loop);
  })

   gProcs = {};

  Object.keys(gClis).forEach(function(e){
    if(typeof(gClis[e].proc) != "undefined"){
      gClis[e].proc = undefined;
      gClis[e].newCursor();
    }
  });

  cli.newCursor();
}

CLMR_CMDS["_new"] = function(args, cli)
{
  newCli();
  cli.newCursor(true);
}

CLMR_CMDS["_exit"] = function(args, cli)
{
  if(gClis.length < 2)return;

  gClis[cli.idx].destroy();
  delete gClis[cli.idx];
  idxs = [];

  for(var i in gClis)
	{
    idxs.push(gClis[i].idx);
  }
}

CLMR_CMDS["_lcmds"] = function(args,  cli){

	var cmds = Object.keys(CLMR_CMDS)
  for(var i = 0; i < cmds.length; i++)
	{
    cli.println(cmds[i]);
  }
  cli.newCursor();
}

CLMR_CMDS["_q"] = function(args,  cli)
{
    cli.cli_mode = "clmr";
    cli.newCursor();
}


/* More specific stuff */

CLMR_CMDS["_iplayers"] =  function(args, cli){

  if(cli.proc != undefined){
    cli.println("busy");
    return;
  }

  var proc = {};
  proc.id = generateTempId(8);
  proc.loop = setInterval(function(){

    var msgobj = {cmd: "lplayers", args: args, cli_id: cli.idx, mode: cli.cli_mode, isproc: true, room: cli.room}
    socket.emit('cmd', msgobj);

  }, 2000);

  gProcs[proc.id] = proc;
  cli.proc = proc;

}

CLMR_CMDS["_irooms"] = function(args, cli){

  if(cli.proc != undefined){
    cli.println("busy");
    return;
  }

  var proc = {};
  proc.id = generateTempId(8);
  proc.loop = setInterval(function(){

    var msgobj = {cmd: "lrooms", args: args, cli_id: cli.idx, mode: cli.cli_mode, isproc: true, room: cli.room}
    socket.emit('cmd', msgobj);

  }, 2000);

  gProcs[proc.id] = proc;
  cli.proc = proc;

}

CLMR_CMDS["_ivotes"] = function(args, cli){

  if(cli.proc != undefined){
    cli.println("busy");
    return;
  }

  var proc = {};
  proc.id = generateTempId(8);
  proc.loop = setInterval(function(){

    var msgobj = {cmd: "lvotes", args: args, cli_id: cli.idx, mode: cli.cli_mode, isproc: true}
    socket.emit('cmd', msgobj);

  }, 2000);

  gProcs[proc.id] = proc;
  cli.proc = proc;

}


CLMR_CMDS["_closeall"] = function(args,  cli)
{
  cli.room = "";
  var msgobj = {cmd: "closeall", cli_id: cli.idx}
  socket.emit('cmd', msgobj);

	//clear the clis of references
  Object.keys(gClis).forEach(function(e){
    if(gClis[e].room != "")
    {
      gClis[e].room = "";
      if(gClis[e].proc == undefined)gClis[e].newCursor(true);
    }
  })
}

CLMR_CMDS["_room"] = function(args,  cli){

  if(args.length == 0)
	{
    var msgobj = {cmd: "get_rooms", cli_id: cli.idx, room: cli.room}
    socket.emit('cmd', msgobj);
  }
	else
	{
    var msgobj = {cmd: "create_room", args: args, cli_id: cli.idx, room: cli.room}
    socket.emit('cmd', msgobj);
  }

}

CLMR_CMDS["_c"] = function(args,  cli)
{
    if(cli.cli_mode == "chat" )
		{
      socket.emit('cmd', { cmd: 'chat_clear', value: "" , room: cli.room});
    }
		else if(cli.cli_mode == "story")
		{
			socket.emit('cmd', { cmd: 'story_clear', value: "" , room: cli.room});
		}
    cli.newCursor();
}

CLMR_CMDS["_n"] = function(args,  cli)
{
    if(cli.cli_mode == "story")
		{
      socket.emit('cmd', { cmd: 'story_next', value: "" , room: cli.room});
    }
    cli.newCursor();
}

//TODO there will need to be more story commands here.
