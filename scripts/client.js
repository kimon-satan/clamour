
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

canvas.addEventListener('touchend', tap );
canvas.addEventListener('mousedown', tap );

camera.position.z = 5;

function tap(e){

  //console.log(e);

  socket.emit('hello', {x: e.clientX, y: e.clientY });
  //a random color
  plane.material.color.r = Math.random();
  plane.material.color.g = Math.random();
  plane.material.color.b = Math.random();

}

function render()
{
  requestAnimationFrame( render );
  renderer.render( scene, camera );
}

render();




////////////////////////////SOCKET STUFF//////////////////////////


socket.on('mode_change', function(msg)
{
    console.log(msg);

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

});

socket.on('chat_update', function(msg)
{
  $('#container').empty();
  $('#container').append( '<h1>' + msg +'</h1>' );
  console.log(msg);
});
