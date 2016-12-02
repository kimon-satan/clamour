



var CLMR_CMDS = {}

var gPrevComms = [];
var gClis = {};
var gCli_idx = 0;

var gCurrentOptions = {};
var gProcs = {};

var idxs = [];

var socket = io('/admin');

socket.on('server_report', function(msg){


  if(msg.thread != undefined)
  {
    gClis[msg.id].thread = msg.thread;
  }

  console.log(msg);

  if(msg.msg != undefined && msg.isproc == undefined)
  {
    gClis[msg.id].println(msg.msg);
    gClis[msg.id].newCursor();
  }
  else if (msg.msg != undefined && msg.isproc != undefined)
  {
    gClis[msg.id].clear();
    gClis[msg.id].replaceln(msg.msg);
  }



});


$(document).ready(function(){

  var tcli = new CLI(gCli_idx, "clmr");

  gClis[gCli_idx] = tcli;

  for(var  i in gClis){
    idxs.push(gClis[i].idx);
  }

})



function CLI(idx, mode, thread){

  this.idx = idx;
  this.cli_mode = mode;
  this.sus_mode;
  this.sus_list;
  this.sus_idx;
  this.com_idx;
  this.thread = thread;
  this.temp_thread;
  this.cursor_prefix;
  this.proc = undefined;
  this.domElement;
  this.id_str = "#cmdText_" + this.idx;

  //////////////////////////////////HELPERS//////////////////////////////////////

  this.newCursor = function(isNewLine){


    this.cursor_prefix = this.cli_mode;
    if(typeof(this.thread )!= "undefined" && this.thread.length > 0)this.cursor_prefix += "_" + this.thread;
    this.cursor_prefix += ">"
    if(typeof(isNewLine) == "undefined" || isNewLine){
      this.println(this.cursor_prefix);

    }else{
      this.domElement.val(this.cursor_prefix);
    }

    this.com_idx = gPrevComms.length;
    this.domElement.scrollTop(this.domElement.prop('scrollHeight'));


  }

  this.cmdReturn = function(error, result){

    if(error){
      this.println(error.reason);
    }else if(result){
      this.println(result);
    }

    this.newCursor();
  }

  this.println = function(str)
  {
    this.domElement.val(this.domElement.val() + "\n"+ str);
  }

  this.replaceln = function(str)
  {
    var t = this.domElement.val();
    t = t.substring(0,t.lastIndexOf("\n"));
    t = t + "\n" + str;
    this.domElement.val(t);
  }

  this.clear = function()
  {
    this.domElement.val("");
    this.newCursor(false);
  }



  this.handleSus = function(e){

    if(e.keyCode == 38){
      this.sus_idx = Math.min(this.sus_idx + 1, this.sus_list.length -1);
      this.replaceln(this.sus_list[this.sus_idx]);

    }else if(e.keyCode == 40){

      this.sus_idx = Math.max(this.sus_idx - 1, 0);
      this.replaceln(this.sus_list[this.sus_idx]);

    }else if(e.keyCode == 13){
      this.thread = this.sus_list[this.sus_idx];
      this.newCursor();
      this.sus_mode = undefined;
    }
    return false;

  }

  this.handleChatKeys = function(e, cmd){

    if(e.keyCode == 13){
      this.newCursor();
      socket.emit('cmd', { cmd: 'chat_newline', value:  "", thread: this.thread});
    }else{
      socket.emit('cmd', { cmd: 'chat_update', value:  cmd, thread: this.thread});
    }

  }


  //////////////////////////////SETUP THE domElement /////////////////////

  var id = 'cmdText_' + this.idx;
  var elem = '<span style="display: inline"><textarea class="cmdText" id=' + id + ' rows="100" cols="56"></textarea></span>'
  $('#container').append(elem);
  this.domElement = $(this.id_str);
  this.newCursor(false);


  /////////////////////////////////KEY HANDLERS//////////////////////////

  this.domElement.keydown(function(e){

    if(typeof(this.proc) != "undefined" && e.keyCode == 75 && e.metaKey){
      clearInterval(this.proc.loop);
      this.newCursor();
      this.proc = undefined;
      return false;
    }

    if(this.sus_mode == "thread" || e.keyCode == 38 || e.keyCode == 40){
      return false;
    }


    var str = this.domElement.val();
    var cmds = str.split(this.cursor_prefix);
    var cmd = cmds[cmds.length - 1];

    if(e.keyCode == 8)
    {
      return (cmd.length > 0);
    }else if(e.keyCode == 13){
      return false;
    }else if(e.keyCode == 75 && e.metaKey){
      this.domElement.val("");
      this.newCursor(false);
    }else if(e.keyCode == 65 && e.metaKey){
      newCli();
      return false;
    }


  }.bind(this));

  this.domElement.keyup(function(e){


    if(this.sus_mode == "thread"){

      return this.handleSus(e);

    }else if(e.keyCode == 40){

      if(gPrevComms.length > 0){
        this.com_idx = Math.min(this.com_idx + 1, gPrevComms.length - 1);
        this.replaceln(this.cursor_prefix + gPrevComms[this.com_idx]);
      }
      return false;
    }
    else if(e.keyCode == 38){

      if(gPrevComms.length > 0){
        this.com_idx = Math.max(0, this.com_idx - 1);
        this.replaceln(this.cursor_prefix + gPrevComms[this.com_idx]);
      }
      return false;
    }

    var str = this.domElement.val();
    var cmds = str.split(this.cursor_prefix); //
    var cmd = cmds[cmds.length - 1];

    if(this.cli_mode == "chat" && cmd.substring(0,1) != "_"){
      this.handleChatKeys(e, cmd);
    }
    else if(e.keyCode == 13)
    {
      if(gPrevComms.indexOf(cmd) == -1)gPrevComms.push(cmd);
      cmd.replace(/\r?\n|\r/,"");
      evaluateCommand(cmd, this);
    }

  }.bind(this));


  this.destroy = function(){
    this.domElement.remove();
  }

}

evaluateCommand = function(cmd,  cli){

  var result_str;
  var args;

  //get rid of any unnecessary spaces
  cmd = cmd.replace(/,\s|\s,/g, ",");

  cmd = cmd.replace(/\[\s/g, "[");
  cmd = cmd.replace(/\s\]/g, "]");
  cmd = cmd.replace(/\(\s/g, "(");
  cmd = cmd.replace(/\s\)/g, ")");


  args = cmd.split(" ");
  cmd = args[0];
  args = args.slice(1);

  if(typeof(CLMR_CMDS[cmd]) != 'undefined'){
    CLMR_CMDS[cmd](args,  cli);
  }else{
    cli.println("command not found");
    cli.newCursor();
  }

}

CLMR_CMDS["_logoutPlayers"] = function(args, cli){

  //ideally should do a confirmation here
  // Meteor.call("resetPlayers", Meteor.user()._id);
  // cli.thread = "";
  // Meteor.call("killThreads", Meteor.user()._id);
  cli.newCursor();
}

CLMR_CMDS["_pedalStart"] = function(args, cli){
  //Meteor.call("startPedal", Meteor.user()._id);
  cli.newCursor();
}

CLMR_CMDS["_splat"] = function(args, cli){

  // if(args.length > 0)
  // {
  //     var id = args[0];
  // }
  // else
  // {
  //     var id = Meteor.user()._id.substring(0,5);
  // }
  // msgStream.emit('displayMessage', {type: 'splat', id: id});
  cli.newCursor();
}

CLMR_CMDS["_instructions"] = function(args, cli){

  // var b = (args[0] == "T");
  // msgStream.emit('displayMessage', {type: 'instruction', value: b});
  cli.newCursor();
}

CLMR_CMDS["_end"] = function(args, cli){
  // Meteor.call("killSynths", Meteor.user()._id);
  //
  // cli.cli_mode = "chat"
  //
  // permThread(cli.cli_mode,["-f"], //select everyone
  // function(options, th){
  //   msgStream.emit('message', {type: 'chatClear', 'value':  "", thread: cli.thread});
  //   msgStream.emit('message', {type: 'screenChange', 'value' : {mode: "chat"}, thread: th});
  // }, cli);
  //
  // //kill display
  //
  // msgStream.emit('displayMessage', {type: 'end'});

  cli.newCursor();
}

CLMR_CMDS["_killSound"]  = function(args, cli){
  // Meteor.call("killSynths", Meteor.user()._id);
  cli.newCursor();
},

CLMR_CMDS["_startMisty"]  = function(args, cli){
  // Meteor.call("startMisty", Meteor.user()._id);
  cli.newCursor();
},

CLMR_CMDS["_killProcs"] = function(args, cli){
  // for (var i in gProcs){
  //   clearInterval(gProcs[i].loop);
  // }
  //
  // gProcs = [];
  //
  // for(var i in gClis){
  //   if(typeof(gClis[i].proc) != "undefined"){
  //     gClis[i].proc = undefined;
  //     gClis[i].newCursor();
  //   }
  // }

  cli.newCursor();
}

CLMR_CMDS["_new"] = function(args, cli){

  newCli();

  cli.newCursor(true);

}

function newCli(){

  gCli_idx += 1;
  var tcli = new CLI(gCli_idx, "clmr");

  gClis[gCli_idx] = tcli;

  idxs = [];

  for(var  i in gClis){
    idxs.push(gClis[i].idx);
  }


}

CLMR_CMDS["_exit"] = function(args, cli){

  if(gClis.length < 2)return;

  gClis[cli.idx].destroy();
  delete gClis[cli.idx];
  idxs = [];

  for(var  i in gClis){
    idxs.push(gClis[i].idx);
  }

}

CLMR_CMDS["_wait"] = function(args,  cli){

  cli.cli_mode = "wait";

  var msgobj = {cmd: "change_mode", args: args, cli_id: cli.idx, mode: cli.cli_mode, thread: cli.thread}

  socket.emit('cmd', msgobj);

}



CLMR_CMDS["_chat"] = function(args,  cli){

  cli.cli_mode = "chat";

  var msgobj = {cmd: "change_mode", args: args, cli_id: cli.idx, mode: cli.cli_mode, thread: cli.thread}

  socket.emit('cmd', msgobj);

}



CLMR_CMDS["_blank"] = function(args, cli){

  cli.cli_mode = "blank";

  var msgobj = {cmd: "change_mode", args: args, cli_id: cli.idx, mode: cli.cli_mode, thread: cli.thread}

  socket.emit('cmd', msgobj);

  //work out how to do this later
  // if(!addStep(args, cb, cli)){
  //   permThread(cli.cli_mode, args, cb, cli);
  // }

}



CLMR_CMDS["_play"] = function(args,  cli){

  cli.cli_mode = "play";

  var msgobj = {cmd: "change_mode", args: args, cli_id: cli.idx, mode: cli.cli_mode, thread: cli.thread}

  socket.emit('cmd', msgobj);

}



CLMR_CMDS["_group"] = function(args,  cli){

    var name;
    if(args[0].substring(0,1) != "-"){
      name = args[0];
      args.splice(0,1);
    }

    if(args[0] == "-d"){

      var s_args = {};
      s_args.orig = args[1];
      s_args.numGps = parseInt(args[2]);
      Meteor.call("createSubGroups", Meteor.user()._id, s_args, function(e,r){cli.cmdReturn(e,r)});

    }else if(args[0] == "-r"){
      if(typeof(args[1]) == "undefined"){
        Meteor.call("removeGroups", Meteor.user()._id, function(e,r){cli.cmdReturn(e,r)});
      }else{
        Meteor.call("removeGroups", Meteor.user()._id, args[1], function(e,r){cli.cmdReturn(e,r)});
      }
    }else{

      var selector = parseFilters(args);
      if(typeof(name) != "undefined"){
        selector.group = name;
      }

      if(selector && selector.group){
        Meteor.call("createGroup", Meteor.user()._id, selector, function(e,r){cli.cmdReturn(e,r)});
      }else{
        cli.newCursor();
      }
    }


}

CLMR_CMDS["_remove"] = function(args,  cli){

  var i = args.indexOf("-p");
  var p;
  var t;

  if(i > -1){
    args.splice(i,1);
    p = args[i];
    args.splice(i,1);
  }

  i = args.indexOf("-t");
  if(i > -1){
     args.splice(i,1);
     t = args[i];
     args.splice(i,1);
  }

  if(typeof(p) != "undefined" && typeof(t) != "undefined"){
    Meteor.call("removePreset", Meteor.user()._id, {type: t, name: p}, function(e,r){cli.cmdReturn(e,r)});
  }else{
    cli.newCursor();
  }


}

CLMR_CMDS["_lplayers"] = function(args, cli)
{



  var msgobj = {cmd: "list_players", args: args, cli_id: cli.idx, mode: cli.cli_mode, thread: cli.thread}

  console.log(msgobj);
  socket.emit('cmd', msgobj);

}

CLMR_CMDS["_iplayers"] =  function(args, cli){

  var proc = {};
  proc.id = generateTempId(8);
  proc.loop = setInterval(function(){

    var msgobj = {cmd: "list_players", args: args, cli_id: cli.idx, mode: cli.cli_mode, isproc: true, thread: cli.thread}
    socket.emit('cmd', msgobj);

  }, 500);

  gProcs[proc.id] = proc;
  cli.proc = proc;


}



CLMR_CMDS["_lthreads"] = function(args, cli){

  Threads.find({}).forEach(function(e){

    var str = e.thread + " :: " + e.population;
    if(e.thread == cli.thread)str += " *";
    if(e.thread == cli.temp_thread)str += " -";
    cli.println(str);

  });

  cli.newCursor();

}


CLMR_CMDS["_ithreads"] = function(args, cli){

  var proc = {};

  proc.id = generateTempId(8);
  proc.loop = setInterval(function(){

    $('#cmdText_' + cli.idx).val("");

    Threads.find({}).forEach(function(e){

      var str = e.thread + " :: " + e.population;
      if(e.thread == cli.thread)str += " *";
      if(e.thread == cli.temp_thread)str += " -";
      cli.println(str);

    });

  }, 500);

  gProcs[proc.id] = proc;
  cli.proc = proc;

}

CLMR_CMDS["_lgroups"] = function(args, cli){

  UserGroups.find({}).forEach(function(e){

    var str = e.name + " :: " + e.members.length;
    cli.println(str);

  });

  cli.newCursor();


}



CLMR_CMDS["_lcmds"] = function(args,  cli){

  for(var i in CLMR_CMDS){
    cli.println(i);
  }

  cli.newCursor();
}

CLMR_CMDS["_lpresets"] = function(args,  cli){

  var i = args.indexOf("-t");
  var t;

  if(i > -1){
    args.splice(i,1);
    t = args[i];
    args.splice(i,1);
  }else{
    t = cli.cli_mode;
  }

  Presets.find({type: t}).forEach(function(r){

    cli.println(r.name);
  });

  cli.newCursor();

}

CLMR_CMDS["_loptions"] = function(args,  cli){

  var i = args.indexOf("-t");
  var t;

  if(i > -1){
    args.splice(i,1);
    t = args[i];
    args.splice(i,1);
  }else{
    t = cli.cli_mode;
  }

  i = args.indexOf("-p");
  var name;

  if(i > -1){
    args.splice(i,1);
    name = args[i]
    args.splice(i,1);
  }

 console.log(name, t);

  var preset = Presets.findOne({name: name, type: t});
  console.log(preset);


  if(preset){
    for(item in preset.options){
      var tp = typeof(preset.options[item]);
      if(tp == "number" || tp == "string" || tp == "boolean"){
        cli.println(item + ": " + preset.options[item]);
      }else{
        var str = item + ": ";
        for(var o in preset.options[item]){
          str += ", " + preset.options[item][o];
        }
        cli.println(str);
      }

    }
  }else{
    for(o in gCurrentOptions[t]){
      cli.println(o + ": " + gCurrentOptions[t][o]);
    }
  }

  cli.newCursor();

}

CLMR_CMDS["_q"] = function(args,  cli){ //need to think about what these commands can usefully do
    cli.cli_mode = "clmr";
    cli.newCursor();
}

CLMR_CMDS["_kill"] = function(args,  cli){

  Meteor.call("killThread", Meteor.user()._id, cli.thread);
  cli.thread = "";
  cli.newCursor();

}

CLMR_CMDS["_killall"] = function(args,  cli){

  cli.thread = "";
  Meteor.call("killThreads", Meteor.user()._id);
  cli.newCursor();

}

CLMR_CMDS["_thread"] = function(args,  cli){

  //maybe an option to add a player to this thread

  if(args.length == 0){

    var r = Threads.find({},{sort: {thread: 1}}).fetch();
    cli.sus_list = [];
    for(var i in r){
      cli.sus_list.push(r[i].thread);
    }

    if(cli.sus_list.length > 0){
      cli.sus_mode = "thread";
      cli.sus_idx = cli.sus_list.indexOf(cli.thread);
      cli.println(cli.sus_list[cli.sus_idx]);
    }else{
      cli.println("there are no threads ...");
      cli.newCursor();
    }

  }else{
    permThread("cmd", args, function(e,r){}, cli);
  }

}

/*-----------------------------------------------MORE SPECIFIC-------------------------------------------*/



CLMR_CMDS["_c"] = function(args,  cli){

    if(cli.cli_mode == "chat"){
      socket.emit('cmd', { cmd: 'chat_clear', value: "" , thread: cli.thread});
    }

    cli.newCursor();
}

//CHANGE OPTIONS WITHIN A MODE !!!!!!!!!!!!

CLMR_CMDS["_i"] = function(args,  cli){ //should be come update as it can deal with all types of changes

  var cb = function(options, th){msgStream.emit('message', {type: cli.cli_mode + 'Change', 'value': options, thread: th});}

  if(!addStep(args, cb, cli, true))tempThread("_i", args, cb, cli);

}




function addStep(args, callback, cli, istemp){

  //looks like this function is for executing a change in a stepped fashion

  var i = args.indexOf("-step");

  if(i < 0)return false;

  var proc = {};

  args.splice(i,1);
  var totalTime = args[i];
  args.splice(i, 1);

  proc.id = generateTempId(5);
  var selector = parseFilters(args);
  if(!selector){
    selector = {filters: [{thread: cli.thread}]};
  }else{
    if(!istemp){
      cli.thread = generateTempId(8);
      selector.thread = cli.thread;
      selector.mode = cli.cli_mode;
      Meteor.call("addThreadToPlayers", Meteor.user()._id, selector);
    }
  }



  proc.players = selectPlayers(selector);
  proc.options = parseSuOptions(args, cli.cli_mode, cli);
  var interval = (totalTime/proc.players.length) * 1000;
  proc.threads = [];

  proc.loop = setInterval(function(){

    if(proc.players.length == 0){
      clearInterval(proc.loop);
      //remove each of the threads
      for(i in proc.threads){
        Meteor.call("killThread", Meteor.user()._id, proc.threads[i]);
      }
      delete gProcs[proc.id];

      cli.proc = undefined;
      cli.newCursor();
      return;

    }

    cli.println(proc.players[0]);
    var t = generateTempId(8);
    proc.threads.push(t);
    var p_args = {uid: proc.players[0], thread: t};
    proc.players.splice(0,1);

    Meteor.call("addThreadToPlayer", Meteor.user()._id, p_args, function(e,r){
      callback(proc.options , r);
    });

    var id_str = "#cmdText_" + cli.idx;
    var psconsole = $(id_str);
    psconsole.scrollTop(psconsole.prop('scrollHeight'));




  }, interval);

  gProcs[proc.id] = proc;
  cli.proc = proc;

  return true;

}

//MOVE TO SERVER for easy DB access
//CLI will be tricky ...
//could make a series of CLI socket receivers




function tempThread(cmd, args, send,  cli){


  //need to remember why this is different from permThread and when it is called

  Meteor.call("killThread" ,Meteor.user()._id, cli.temp_thread, function(e,r){

      cli.temp_thread = "";

      var selector = parseFilters(args);
      cli.temp_thread = generateTempId(5); //create a new thread as it's a new selection
      var options = parseSuOptions(args, cli.cli_mode, cli);

      if(selector){
        selector.thread = cli.temp_thread;
        selector.mode = "cmd";

        Meteor.call("addThreadToPlayers", Meteor.user()._id, selector,
          function(e, r){
      //only make the call once the thread has been added
            if(!e){

              send(options, cli.temp_thread);
              cli.println(r);

            }else{
              cli.println(e.reason);
            }
            cli.newCursor();
          }
        );
      }else{
        send(options, cli.thread); //send on the regular thread
        cli.newCursor();
      }

  });



}






//TODO Move to server
