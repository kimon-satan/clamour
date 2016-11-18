
var socket = io('/player');
var currMode = 0;



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

  if(isTouch)
  {
    socket.emit('hello', {x: e.layerX, y: e.layerY });
  }
  else
  {
    socket.emit('hello', {x: e.clientX, y: e.clientY });
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
    //TODO interpret the cookie to set the mode in advance
    console.log(document.cookie );

  }


});


function render()
{
  requestAnimationFrame( render );
  renderer.render( scene, camera );
}

render();


////////////////////////////SOCKET STUFF//////////////////////////


socket.on('mode_change', function(msg)
{

    if(msg == 0 && currMode == 1)
    {
      $(canvas).remove()
      currMode = 0;

    }
    else if(msg == 1 && currMode == 0)
    {
      $('#container').empty();
      $('#container').append( canvas );

      currMode = 1;
    }

    document.cookie = "currMode=" + currMode;

});

socket.on('chat_update', function(msg)
{
  $('#container').empty();
  $('#container').append( '<h1>' + msg +'</h1>' );
});
