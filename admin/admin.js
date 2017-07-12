
var CLMR_CMDS = {}

var gPrevComms = [];
var gClis = {};
var gCli_idx = 0;

var gCurrentOptions = {};
var gProcs = {};
var idxs = [];
var socket = io('/admin');

socket.on('server_report', function(msg)
{

  if(msg.room != undefined)
  {
    gClis[msg.id].room = msg.room;
  }

  if(msg.suslist)
  {
    gClis[msg.id].sus_list = msg.suslist
    gClis[msg.id].sus_mode = msg.susmode;
    gClis[msg.id].sus_idx = gClis[msg.id].sus_list.indexOf(msg.selected);
    gClis[msg.id].println(gClis[msg.id].sus_list[gClis[msg.id].sus_idx]);
  }
  else if(msg.msg != undefined && msg.isproc == undefined)
  {
    gClis[msg.id].println(msg.msg);
    gClis[msg.id].newCursor(true);
  }
  else if (msg.msg != undefined && msg.isproc != undefined)
  {
    gClis[msg.id].clear();
    gClis[msg.id].replaceln(msg.msg);
  }
  else
  {
    gClis[msg.id].newCursor(true);
  }

});

$(document).ready(function(){

  var tcli = new CLI(gCli_idx, "clmr");

  gClis[gCli_idx] = tcli;

  for(var  i in gClis){
    idxs.push(gClis[i].idx);
  }

})

function CLI(idx, mode, room)
{

  this.idx = idx;
  this.cli_mode = mode;
  this.sus_mode;
  this.sus_list;
  this.sus_idx;
  this.com_idx;
  this.room = room;
  this.temp_room;
  this.cursor_prefix;
  this.proc = undefined;
  this.domElement;
  this.id_str = "#cmdText_" + this.idx;

  //////////////////////////////////HELPERS//////////////////////////////////////

  this.newCursor = function(isNewLine){


    this.cursor_prefix = this.cli_mode;
    if(typeof(this.room )!= "undefined" && this.room.length > 0)this.cursor_prefix += "_" + this.room;
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
      this.room = this.sus_list[this.sus_idx];
      this.newCursor();
      this.sus_mode = undefined;
    }
    return false;

  }

  this.handleChatKeys = function(e, cmd)
	{

    if(e.keyCode == 13){
      this.newCursor();
      socket.emit('cmd', { cmd: 'chat_newline', value:  "", room: this.room});
    }else{
      socket.emit('cmd', { cmd: 'chat_update', value:  cmd, room: this.room});
    }

  }


  //////////////////////////////SETUP THE domElement /////////////////////

  var id = 'cmdText_' + this.idx;
  var elem = '<span style="display: inline"><textarea class="cmdText" id=' + id + ' rows="100" cols="56"></textarea></span>'
  $('#container').append(elem);
  this.domElement = $(this.id_str);
  this.newCursor(false);


  /////////////////////////////////KEY HANDLERS//////////////////////////

  this.domElement.keydown(function(e)
	{
		//cmd + k  = clear
    if(typeof(this.proc) != "undefined" && e.keyCode == 75 && e.metaKey){
      clearInterval(this.proc.loop);
      this.newCursor();
      this.proc = undefined;
      return false;
    }

    if(this.sus_mode == "room" || e.keyCode == 38 || e.keyCode == 40){
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

  this.domElement.keyup(function(e)
	{


    if(this.sus_mode == "room"){

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

function evaluateCommand(cmd,  cli){

  var result_str;
  var args = [];

  //get rid of any unnecessary spaces
  cmd = cmd.replace(/,\s|\s,/g, ",");

  cmd = cmd.replace(/\[\s/g, "[");
  cmd = cmd.replace(/\s\]/g, "]");
  cmd = cmd.replace(/\(\s/g, "(");
  cmd = cmd.replace(/\s\)/g, ")");

	r = /-(\w*)\s?([^-^\s]*)\s?([^-^\s]*)/g; //0-2 sub-parameters
	match = " ";

	while (match != null)
	{
	  match = r.exec(cmd);
		if(match != null)args.push([match[1], match[2], match[3]]);
	}

  r = cmd.match(/_\w*/);
	if(r != null)
	{
		cmd = r[0];
	}
	else
	{
		cmd = undefined;
	}

	if(typeof(CLMR_CMDS[cmd]) != 'undefined')
	{
    CLMR_CMDS[cmd](args,  cli);
  }else{
    cli.println("command not found");
    cli.newCursor();
  }

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
