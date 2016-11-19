
var socket = io('/admin');
var numMessages = 0;

$('form').submit(
  function()
  {
    var msg = $('#m').val();
    socket.emit('command', msg);
    $('#m').val('');
    return false;
  }
);

socket.on('click', function(msg){
  numMessages += 1;
  if(numMessages > 10){
    $('#messages').empty();
    numMessages = 0;
  }
  $('#messages').append('<li>'  + msg._id + ": " + msg.clicks +  " (" + msg.x + "," + msg.y + ' )</li>')
});

var CLMR_CMDS = {}

var gPrevComms = [];
var gClis = {};
var gCli_idx = 0;

var gCurrentOptions = {};
var gProcs = {};

var idxs = [];

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
  this.proc;
  this.domElement;

  this.newCursor = function(isNewLine){

    this.cursor_prefix = this.cli_mode;
    var id_str = "#cmdText_" + this.idx;
    if(typeof(this.thread )!= "undefined" && this.thread.length > 0)this.cursor_prefix += "_" + this.thread;
    this.cursor_prefix += ">"
    if(typeof(isNewLine) == "undefined" || isNewLine){
      this.println(this.cursor_prefix);

    }else{

      $(id_str).val(this.cursor_prefix);
    }

    this.com_idx = gPrevComms.length;

    var psconsole = $(id_str);
    psconsole.scrollTop(psconsole.prop('scrollHeight'));


  }

  this.cmdReturn = function(error, result){

    if(error){
      this.println(error.reason);
    }else if(result){
      this.println(result);
    }

    this.newCursor();
  }

  this.println = function(str){
    var id_str ='#cmdText_' + this.idx;
    $(id_str).val($(id_str).val() + "\n"+ str);
  }

  this.replaceln = function(str){
    var id_str ='#cmdText' + "_" + this.idx;
    var t = $(id_str).val();
    t = t.substring(0,t.lastIndexOf("\n"));
    t = t + "\n" + str;
    $(id_str).val(t);
  }

  this.keydown = function(e){

    if(typeof(this.proc) != "undefined" && e.keyCode == 75 && e.metaKey){
      clearInterval(this.proc.loop);
      this.newCursor();
      this.proc = undefined;
      return false;
    }

    var id_str ='#cmdText' + "_" + this.idx;

    if(this.sus_mode == "thread" || e.keyCode == 38 || e.keyCode == 40){
      return false;
    }

    var str = $(id_str).val();
    var cmds = str.split(this.cursor_prefix);
    var cmd = cmds[cmds.length - 1];

    if(e.keyCode == 8)
    {
      return (cmd.length > 0);
    }else if(e.keyCode == 13){
      return false;
    }else if(e.keyCode == 75 && e.metaKey){
      $(id_str).val("");
      this.newCursor(false);
    }else if(e.keyCode == 65 && e.metaKey){
      newCli();
      return false;
    }


  }

  this.keyup  = function(e){

    var id_str ='#cmdText' + "_" + this.idx;

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

    var str = $(id_str).val();
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
      msgStream.emit('message', { type: 'chatNewLine', value:  "", thread: this.thread});
    }else{
      msgStream.emit('message', { type: 'chatUpdate', value:  cmd, thread: this.thread});
    }

  }

  var idstr = 'cmdText_' + this.idx;
  var elem = '<span style="display: inline"><textarea class="cmdText" id=' + idstr + ' rows="100" cols="56"></textarea></span>'
  $('#container').append(elem);
  this.newCursor(false);

}
