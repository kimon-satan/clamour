
display = undefined;

var lastFrameTime, framePeriod, fps;

lastFrameTime = 0;

var socket = io('/display');

socket.on('cmd', function(msg){

  //console.log(msg);

  if(msg.type == "splat")
  {
    display.splatManager.addSplat(msg.val);
    if(display.splatManager.getEnergy(msg.val._id) > 0.3)
    {
      //TODO check if canTransform is turned on for this player
      //do the transform;

      var pos = new THREE.Vector2().copy(display.splatManager.playerInfo[msg.val._id].center);
      var blob = display.blobManager.addBlob(pos, msg.val);

      display.splatManager.transform(msg.val._id, function(){
            newBranch(blob);
            display.scene.add(blob.mesh);
      });

    }
  }
  else if(msg.type == "blob")
  {
    var blob = display.blobManager.addBlob(new THREE.Vector2(Math.random() * 2.0 - 1.0,Math.random() * 2.0 -1), msg.val);
    var branch = display.branchManager.addBranch(blob);
    blob.branch = branch;

    display.scene.add(blob.mesh);
    display.scene.add(branch.mesh);
  }
  else if(msg.type == "moveBlob")
  {
    display.blobManager.moveBlob(msg.val._id,  -msg.val.rot, msg.val.trans, msg.val.death);
  }
  else if(msg.type == "update")
  {
    display.splatManager.updateGlow(msg.id, msg.val);
  }
  else if (msg.type == "end" || msg.type == "clear_display")
  {
    display.splatManager.clearAll();
    display.blobManager.clearAll(display.scene);
  }
  else if (msg.type == "instruct")
  {
    setupInstructions();
  }
  else if (msg.type == "display" )
  {
    setupDisplay();
  }

});

newBranch = function(parent)
{
  var branch = display.branchManager.addBranch(parent);
  parent.branch = branch;
  display.scene.add(branch.mesh);
}

$('document').ready(function(){

  setupInstructions();
})

function setupInstructions()
{

  $('#displayscreen').empty();
  $('#displayscreen').append( " \
    <div id='displayInstructions'> \
    <h1>Conditional Love - Instructions</h1> \
    <h3>1. Take out your phone or laptop</h3> \
    <h3>2. Join the wifi network ConditionalLove</h3> \
    <h3>3. Open a browser</h3> \
    <h3>4. Type the address love.local (no www.)</h3> \
    <h3><i>Ask for help if it doesn't work</i></h3></div>"
  );

}

function setupDisplay ()
{
  $('#displayscreen').empty();
  var d = $('#displayscreen');
  if(d.length > 0)
  {
    if(display == undefined)
    {
      display = new Display(socket);
    }
    else{
      $('#displayscreen').append( display.renderer.domElement );
      display.canvas = display.renderer.domElement;
    }
  }
  else
  {
    window.setTimeout(setupDisplay, 10);
  }
}

Display = function(socket)
{
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize( window.innerWidth, window.innerHeight );

  $('#displayscreen').append( this.renderer.domElement );
  this.canvas = this.renderer.domElement;

  var p = this.renderer.domElement.width/this.renderer.domElement.height;
  this.camera = new THREE.OrthographicCamera(-p, p, -1, 1, -100, 100);
  this.camera.position.z = 1;
  this.startTime = new Date().getTime();
  this.accumulator = 0;
  this.ellapsedTime = 0;
  this.resolution = new THREE.Vector2(this.renderer.domElement.width,this.renderer.domElement.height);
  this.fps = 0;

  this.scene = new THREE.Scene();
  this.splatManager = new SplatManager(p, socket);
  this.blobManager = new BlobManager(p, socket);
  this.branchManager = new BranchManager(newBranch);
  this.scene.add(this.splatManager.mesh);

  this.mousePos = new THREE.Vector2();

/////////////////////////////////////

//  this.mousePos = new THREE.Vector2(0,0);

  this.canvas.addEventListener('mousedown', function(e)
  {
    // this.mousePos.set(
    //   -1 + e.clientX * 2/this.canvas.width,
    //   1 + e.clientY* -2/this.canvas.height
    // );
    //
    // var m = this.blobManager.addBlob(this.mousePos, generateTempId(5));
    // this.scene.add(m);
    // console.log("md");

    this.isMouseDown = true;
  }.bind(this)
  , false);

  this.canvas.addEventListener("mousemove", function (e)
  {
    // this.mousePos.set(
    //   -1 + e.clientX * 2/this.canvas.width,
    //   1 + e.clientY* -2/this.canvas.height
    // );



  }.bind(this)
  , false);

  this.canvas.addEventListener('mouseup', function()
  {
    this.isMouseDown = false;

    Object.keys(this.blobManager.blobs).forEach(function(b){
      this.blobManager.blobs[b].move(Math.PI/2.0 - Math.random() * Math.PI, 0.25 + Math.random() * 0.25);
    }.bind(this))

  }.bind(this)
  , false);



  this.draw = function()
  {
    var n_et = (new Date().getTime() - this.startTime) * 0.001;
    this.accumulator += (n_et - this.ellapsedTime);
    this.ellapsedTime = n_et;

    if(this.accumulator > 1.0/60)
    {
      framePeriod = this.ellapsedTime - lastFrameTime;
      this.fps = (this.fps + 1.0/framePeriod)/2.0;
      this.accumulator = 0;
      this.splatManager.updateSpots(this.ellapsedTime);
      //debug code
      this.blobManager.update(this.ellapsedTime);
      this.branchManager.update(this.ellapsedTime);
      this.renderer.render( this.scene, this.camera );
      lastFrameTime = this.ellapsedTime;
    }


    requestAnimationFrame(this.draw);
  }.bind(this);

  this.draw();

}
