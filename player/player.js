

var socket = io('/player');
var currMode = "";
var userid = getCook('userid');
UserData = {};


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

  if(userid.length > 0 && userid != "undefined")
  {
    console.log("uid: " + userid)
    socket.emit('hello', userid); //request a database update
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

  console.log("welcome: " , msg);
  document.cookie = "userid=" + msg._id;
  userid = msg._id;

  parseMsgParams(msg);
  setup(UserData, informServer); //sets up canvas
  changeMode(msg.mode);



});

socket.on('cmd', function(msg)
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
  else if(msg.cmd == 'chat_newh3ne')
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

});



/////////////////////////////////HELPERS///////////////////////////

function informServer(msg)
{
  msg._id = userid;
  socket.emit('update_user', msg); //tell the server that we have changed mode

}

function parseMsgParams(msg)
{
  var resp = {_id: userid};

  Object.keys(msg).forEach(function(k){

    if(msg[k] != undefined && k != "_id" && k != "mode" && k != "groups" && k != "threads")
    {
      UserData[k] = msg[k];
      resp[k] = msg[k];
    }

  });

  if(iface)
  {
    if(resp.state != undefined)
    {

      iface.changeState(resp.state);
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
  }


      console.log(resp)
  socket.emit('update_user', resp); //tell the server that we have changed
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
