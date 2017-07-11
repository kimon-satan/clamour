

var socket = io('/player');
var currMode = "";
var userid = getCook('userid');
UserData = {};
var threads = {};


$(document).ready(function(){

  //load the sound


});



function whoami(){

  console.log("whoami");

  var cookies = document.cookies;


  if(document.cookie != undefined)
  {
    userid = getCook('userid');
  }

  UserData = {};

  if(userid.length > 0 && userid != "undefined")
  {
    console.log("uid: " + userid)
    socket.emit('hello', userid); //request a database update
    UserData._id = userid;
  }
  else
  {
    socket.emit('hello', 'new'); //create a new record
  }
}


////////////////////////////SOCKET STUFF//////////////////////////


socket.on("whoareyou", function(msg){
  //location.reload(true);
  whoami();
});

socket.on('welcome', function (msg) {

  //console.log("welcome: " , msg);
  document.cookie = "userid=" + msg._id;
  userid = msg._id;

  UserData = {_id: msg._id};

  if(iface)
  {
    iface.ud = UserData;
  }

  parseMsgParams(msg);
  setup(UserData, informServer); //sets up canvas
  changeMode(msg.mode);

});

socket.on('new_thread', function(msg)
{
	console.log("new_thread", msg);
	threads[msg.value] = io('/' + msg.value);
	threads[msg.value].on('cmd', interpret);
});

//socket.on('cmd', interpret);

function interpret(msg)
{
	if(msg.cmd == "change_mode")
  {
    parseMsgParams(msg.value);
    changeMode(msg.value.mode);
  }
  else if (msg.cmd == "chat_update")
  {
    $('#chatContainer>div.largeText:last-child').remove();
    $('#chatContainer').append( '<div class="largeText">' + msg.value +'</div>' );
  }
  else if(msg.cmd == 'chat_newline')
  {
    $('#chatContainer').append( '<div class="largeText"></div>' );
  }
  else if(msg.cmd == 'chat_clear')
  {
    $('#chatContainer').empty();
  }
  else if(msg.cmd == 'set_params')
  {
    parseMsgParams(msg.value);
  }
}

/////////////////////////////////HELPERS///////////////////////////

function informServer(msg)
{
  msg._id = userid;
  socket.emit('update_user', msg); //tell the server that we have changed mode
  console.log("informServer")

}

function parseMsgParams(msg)
{
  var resp = {_id: userid};


  Object.keys(msg).forEach(function(k){

    if(msg[k] != undefined && k != "_id" && k != "mode" && k != "groups" && k != "threads")
    {
      if(typeof(msg[k]) == "object")
      {
        UserData[k] = msg[k].min + Math.random() * (msg[k].max - msg[k].min);
        resp[k] = UserData[k];
      }
      else
      {
        UserData[k] = msg[k];
        resp[k] = UserData[k];
      }

    }

  });


  if(iface)
  {
    if(resp.state != undefined)
    {
      console.log("cs: " + resp.state)
      iface.changeState(resp.state); //changes state_z
    }

    if (resp.isSplat != undefined)
    {
      iface.setIsSplat(resp.isSplat);
    }

    if(resp.maxState != undefined)
    {
      iface.setMaxState(resp.maxState);
    }

    if(resp.envTime != undefined)
    {
      iface.setEnvTime(resp.envTime);
    }

    if(resp.isMobile != undefined)
    {
      iface.setIsMobile(resp.isMobile);
    }

    if(resp.isDying != undefined)
    {
      console.log("isDying: " + resp.isDying)
      iface.setIsDying(resp.isDying); //changes state_z
    }

    if(resp.state_z != undefined)
    {
      iface.stateEnvelope.z = resp.state_z;
      UserData.state_z = resp.state_z;

    }

  }


  socket.emit('update_user', UserData); //tell the server that we have changed
  console.log(UserData);

}

function changeMode(mode)
{

  if(currMode == mode)return;

  if(currMode == "play")
  {
    iface.stopRendering();
  }

  if(mode == "play")
  {
    $('#container').empty();
    $('#container').append( '<div id="playContainer"></div>' );

    //resume graphics
    iface.graphics.resume();
    iface.render();
  }

  if(mode == "broken")
  {
    $('#container').empty();
    $('#container').append( "<div id='chatContainer'> \
    <h1>Sorry, I don't think I can do this on your device. </h1> \
    <h2>Just enjoy the sounds for the moment. </h2> \
    <h2>I'll be back soon. </h2> \
    </div>" );
  }


  if(mode == "chat")
  {
    $('#container').empty();
    $('#container').append( '<div id="chatContainer"></div>' );
  }

  if(mode == "wait")
  {
    $('#container').empty();
    $('#container').append( "<div id='chatContainer'> \
    <h1>Conditional Love</h1> \
    <h2>Whilst you're waiting ...</h2>\
      <h3>Put your volume on full</h3> \
      <h3>Turn silent OFF!</h3> \
      <h3>Turn autolock OFF!</h3> \
      <h3>Keep your phone in portrait position</h3> \
    </div>" );

  }

  if(mode == "blank")
  {
    $('#container').empty();
  }

  currMode = mode;

  socket.emit('update_user', {_id: userid, mode: currMode}); //tell the server that we have changed mode
}

function getCook(cookiename)
{
  // Get name followed by anything except a semicolon
  var cookiestring=RegExp(""+cookiename+"[^;]+").exec(document.cookie);
  // Return everything after the equal sign, or an empty string if the cookie name not found
  return unescape(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./,"") : "");
}
