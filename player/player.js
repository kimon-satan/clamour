
var socket = io('/player');
var currMode = "";
var userid = getCook('userid');

var scene = new THREE.Scene();
var camera = new THREE.OrthographicCamera(
  window.innerWidth /-2,
  window.innerWidth / 2,
  window.innerHeight/ 2,
  window.innerHeight/ -2,
  1, 1000 );

var renderer = new THREE.WebGLRenderer();

renderer.setSize( window.innerWidth, window.innerHeight );

var canvas = renderer.domElement;
var geometry = new THREE.PlaneGeometry( window.innerWidth, window.innerHeight, 1 );
var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
var plane = new THREE.Mesh( geometry, material );
scene.add( plane );

var isTouch = false;

canvas.addEventListener('touchend', tapon );
canvas.addEventListener('touchstart', function(){
  isTouch = true;
});

canvas.addEventListener('mousedown',function(e){
  if(!isTouch)tapon(e);
});

camera.position.z = 5;

var sound;

function tapon(e){

  clicks++;

  if(isTouch)
  {
    socket.emit('click', {_id: userid, x: e.layerX, y: e.layerY, clicks: clicks });
  }
  else
  {
    socket.emit('click', {_id: userid, x: e.clientX, y: e.clientY, clicks: clicks });
  }

  //a random color
  plane.material.color.r = Math.random();
  plane.material.color.g = Math.random();
  plane.material.color.b = Math.random();

  sound.simplePlay("samples/cat.wav");

}

function tapoff(e){

  if(!isTouchDown)return;
  isTouchDown = false;

}

$(document).ready(function(){

  //load the sound
  sound = new Sound();
  sound.init();
  sound.loadSample("/samples/cat.wav");

  var cookies = document.cookies;

  if(document.cookie != undefined)
  {
    userid = getCook('userid');
  }

  if(userid.length > 0)
  {
    socket.emit('hello', userid); //request a database update
  }
  else
  {
    socket.emit('hello', 'new'); //create a new record
  }

});


function render()
{
  requestAnimationFrame( render );
  renderer.render( scene, camera );
}

render();


////////////////////////////SOCKET STUFF//////////////////////////


socket.on('welcome', function (msg) {

  console.log(msg);
  document.cookie = "userid=" + msg._id;
  changeMode(msg.currMode);
  clicks = msg.clicks;

});

socket.on('cmd', function(msg)
{
        console.log(msg);
  if(msg.cmd == "change_mode")
  {
      changeMode(msg.value);
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

});



/////////////////////////////////HELPERS///////////////////////////

function changeMode(mode)
{

  if(currMode == mode)return;

  if(currMode == "play")
  {
    $(canvas).remove();
  }

  if(mode == "play")
  {
    $('#container').empty();
    $('#container').append( canvas );
  }

  if(mode == "chat")
  {
    $('#container').empty();
    $('#container').append( '<div id="chatContainer"></div>' );
  }

  if(mode == "wait")
  {
    $('#container').empty();
    $('#container').append( '<div id="chatContainer"><h1>Conditional Love</h1><h2>Please wait for the performance to begin ...</h2></div>' );
  }

  if(mode == "blank")
  {
    $('#container').empty();
  }

  currMode = mode;

  socket.emit('update_user', {_id: userid, currMode: currMode}); //tell the server that we have changed mode
}

function getCook(cookiename)
{
  // Get name followed by anything except a semicolon
  var cookiestring=RegExp(""+cookiename+"[^;]+").exec(document.cookie);
  // Return everything after the equal sign, or an empty string if the cookie name not found
  return unescape(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./,"") : "");
}
