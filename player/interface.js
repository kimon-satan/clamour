iface = undefined;

setup = function (ud, callback)
{
  var d = $('#container');
  if(window.Graphics != undefined && window.Sound != undefined && d.length > 0)
  {
    if(iface == undefined)
    {
      iface = new Interface(ud, callback);
      iface.init();

    }
  }
  else
  {
    window.setTimeout(setup, 10);
  }
}


Interface = function(ud, callback){

  this.graphics
  this.sound
  this.startTime
  this.ellapsedTime
  this.accumulator
  this.canvas
  this.ud = ud;
  this.callback = callback;
  this.panicCount = 0;

  this.mousePos
  this.touchStartPos
  this.numTouches
  this.numHolds

  this.isNewTouch
  this.isGesture
  this.currentGesture
  this.isMouseDown


  this.envsActive
  this.reactEnvelopes
  this.currentReactionMap


  this.stateEnvelope
  this.stateIndex
  this.renderLoop

  this.maxState;

  this.splatPan = -1.0 + Math.random() * 2.0;
  this.splatRate = Math.random();
  this.splatPos = Math.random();



  this.reactionMaps =
  {
    0:[  { z: 0.,
        map: [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined]
      }
    ],
    1:[
        { z: 1.,
          map: [
          undefined,
          {graphics: "shudderThetaDown", sound: "pigeonDown"},
          undefined,
          undefined,
          undefined,
          undefined
          ],
          instruction: "stroke_down",
          inst_trig: 1
        },
        { z: 1.5,
          map: [
          undefined,
          {graphics: "shudderThetaDown", sound: "pigeonDown" },
          {graphics: "shudderThetaUp", sound: "pigeonUp" },
          undefined,
          undefined,
          undefined
          ],
          instruction: "stroke_up",
          inst_trig: 2
        }

      ],
    2: [     { z: 2.0,
              map: [
              undefined,
              {graphics: "shudderThetaDown", sound: "pigeonDown" },
              {graphics: "shudderThetaUp", sound: "pigeonUp" },
              {graphics: "shudderOut", sound: "pigeonWah" },
              undefined,
              undefined
              ],
              instruction: "stroke_left",
              inst_trig: 3
            }
        ],
    3: [
            { z: 3.0,
                map: [
                undefined,
                {graphics: "shudderThetaDown", sound: "pigeonDown" },
                {graphics: "shudderThetaUp", sound: "pigeonUp" },
                {graphics: "shudderOut", sound: "pigeonWah" },
                {graphics: "shudderIn", sound: "babyPigeonMix" },
                undefined
                ],
                instruction: "stroke_right",
                inst_trig: 4
              }
      ],
    4: [            { z: 4.0,
                    map: [
                    undefined,
                    {graphics: "shudderThetaDown", sound: "pigeonDown" },
                    {graphics: "shudderThetaUp", sound: "pigeonUp" },
                    {graphics: "shudderOut", sound: "pigeonWah" },
                    {graphics: "shudderIn", sound: "babyPigeonMix" },
                    {graphics: "shudderIn", sound: "babyUp" },
                    ],
                    instruction: "hold",
                    inst_trig: 5
                  }
              ]
  }

  this.init = function()
  {

    this.graphics = new Graphics(this.ud);
    this.graphics.init();
    this.sound = new Sound();
    this.sound.init();

    this.mousePos = new THREE.Vector2();
    this.touchStartPos = new THREE.Vector2();

    this.startTime = new Date().getTime();
    this.ellapsedTime = 0;
    this.accumulator = 0;

    this.isGesture = false;
    this.isNewTouch = false;
    this.isMouseDown = false;
    this.currentGesture = 0;
    this.numHolds = 0;
    this.envTime = 8;


    this.stateEnvelope = new Envelope(this.envTime, 60);
    this.stateEnvelope.targetVal = 1.0;
    this.stateIndex = ud.stateIndex;
    this.maxState = ud.maxState;
    this.changingState = true;

    this.excitementEnv = new Envelope2(1.75, 25, 60);
    this.excitementEnv.targetVal = 1.0;
    this.isExcitable = false;


    this.reactEnvelopes = [
      new Envelope2(0.1,0.01,60),
      new Envelope2(1.0,0.2,60),
      new Envelope2(2.0,0.2,60),
      new Envelope(2.0, 60), //latched by default
      new Envelope2(0.1, 0.3, 60)
    ];


    this.currentReactionMap = this.reactionMaps[0][0];



    ///////////////////////SETUP EVENTS////////////////////////////////////////

    this.canvas = this.graphics.canvas; //we need the canvas for the eventListeners

    this.canvas.addEventListener('touchstart', function(e)
    {

      this.mousePos.set(
        e.touches[0].clientX /this.canvas.width,
        e.touches[0].clientY / this.canvas.height
      );

      if(!this.sound.isUnlocked)
      {
        this.sound.unlock();
      }

      if(!this.isMouseDown){
        this.gestureStart();
      }
      this.isMouseDown = true;


    }.bind(this)
    , false);

    this.canvas.addEventListener('touchmove', function(e)
    {
      var p = new THREE.Vector2(
        e.touches[0].clientX /this.canvas.width,
        e.touches[0].clientY / this.canvas.height
      );
      this.gestureMove(p);
    }.bind(this)
    , false);

    this.canvas.addEventListener('touchend', function(e)
    {
      this.isMouseDown = false;
      this.gestureEnd();
    }.bind(this)
    , false);


    this.canvas.addEventListener('mousedown', function(e)
    {
      this.mousePos.set(
        e.clientX/this.canvas.width,
        e.clientY/this.canvas.height
      );

      if(!this.sound.isUnlocked)
      {
        this.sound.isUnlocked = true;
      }

      //also firing on touch up on ios
      //dont know what to do about this problem !!!!!!!!
      //
      if(!this.isMouseDown )
      {
        this.gestureStart();
        this.isMouseDown = true;
      }
    }.bind(this)
    , false);

    this.canvas.addEventListener("mousemove", function (e)
    {
      var pos = new THREE.Vector2(
        e.clientX/this.canvas.width,
        e.clientY/this.canvas.height
      );

      if(this.isMouseDown)
      {
        this.gestureMove(pos);
      }
    }.bind(this)
    , false);

    this.canvas.addEventListener('mouseup', function()
    {
      this.isMouseDown = false;
      this.gestureEnd();
    }.bind(this)
    , false);

    //start rendering
    //this.render(); // no longer using this as we do loading at the start to spread server load

    this.changeState(ud.state);
    this.setEnvTime(ud.envTime);
    this.setIsSplat(ud.isSplat); //might cause a loop !?
    this.setMaxState(ud.maxState);
  }

  this.gestureStart = function ()
  {

    this.isGesture = false;
    this.currentGesture = 0;

    this.touchStartPos.copy(this.mousePos);

    //hard restart
    //... might be good to have only some envelopes working this way
    for(var i = 0; i < this.reactEnvelopes.length; i++)
    {
      this.reactEnvelopes[i].targetVal = 0.0;
      this.reactEnvelopes[i].z = 0.0;
    }

    this.numTouches = 0;
    this.numHolds = 0;
  }

  this.gestureMove = function (pos)
  {
    this.numTouches++;
    this.isNewTouch = true;

    if(this.numTouches > 5){

      var v1 = new THREE.Vector2().subVectors(pos ,this.mousePos);
      this.mousePos.copy(pos);

      var v2 = new THREE.Vector2().subVectors(this.mousePos, this.touchStartPos);
      var a = v2.angle();

      if(v1.length() < 0.002)
      {
        this.numHolds++;
        if(this.currentGesture == 5)this.updateGesture(5); //continue with hold if it is one
      }
      else if(Math.abs(a - Math.PI/2) < 0.2 && v1.y > 0)
      {
        this.updateGesture(1);
      }
      else if (Math.abs(a - Math.PI * 1.5) < 0.2 && v1.y < 0)
      {
        this.updateGesture(2);
      }
      else if(Math.abs(a - Math.PI) < 0.2 && v1.x < 0)
      {
        this.updateGesture(3);
      }
      else if(Math.min(a, Math.abs(a - Math.PI * 2.)) < 0.2 && v1.x > 0)
      {
        this.updateGesture(4);
      }
      else
      {
        this.gestureEnd();
      }

    }

  }

  this.gestureEnd = function()
  {
    this.setEnvTargets(0.)
    this.isGesture = false;
  }

  this.updateGesture = function(ng)
  {


    this.isGesture = false;

    if(this.currentGesture == 0 )
    {
      this.isGesture = true;
      this.currentGesture = ng;
      if(this.currentGesture == this.currentReactionMap.inst_trig)
      {
        this.graphics.hideInstruction();
      }
      //console.log(this.currentGesture, this.currentReactionMap.map[this.currentGesture]);

      if(this.currentReactionMap.map[this.currentGesture] != undefined)
      {

        this.sound.setReaction(this.currentReactionMap.map[this.currentGesture].sound);
        this.graphics.setReaction(this.currentReactionMap.map[this.currentGesture].graphics);
      }
      else
      {
        this.sound.setReaction();
        this.graphics.setReaction();
      }
    }

    if(this.currentGesture == ng)
    {
      this.isGesture = true;
      this.setEnvTargets(1.);
    }
    else
    {
      this.isGesture = false;
    }
  }

  this.setEnvTargets = function(target)
  {
    for(var i = 0; i < this.reactEnvelopes.length; i++)
    {
      this.reactEnvelopes[i].targetVal = target;
    }
  }

  this.stopRendering = function()
  {
    if(this.renderLoop != undefined)
    {
      cancelAnimationFrame(this.renderLoop);
      this.renderLoop = undefined;
    }
  }


  this.render = function() {

    if(this.graphics.isNoWebGL){
      changeMode("broken")
      return;
    }

    var old_acc = this.accumulator;

    var n_et = (new Date().getTime() - this.startTime) * 0.001;
    this.accumulator += (n_et - this.ellapsedTime);
    this.ellapsedTime = n_et;


    if(this.accumulator > 0.04)
    {

      this.panicCount += 1;
      if(this.panicCount > 4)
      {


        //tell the server that we can't render graphics
        this.stopRendering();
        changeMode("broken"); //FIXME should be a callback
        this.panicCount = 0;
        return;
      }

    }else {
      //console.log(this.accumulator);
      this.panicCount = 0;

    }

    if(this.accumulator > 1.0/60)
    {
      this.accumulator = 0;
      if(this.isNewTouch)
      {
        this.isNewTouch = false;
      }
      else
      {

        if(this.isMouseDown){

          this.numHolds ++;

          //if it's a hold gesture
          if(this.numHolds > 20 && this.currentGesture == 0 || this.currentGesture == 5)
          {
            this.updateGesture(5);
            if(this.numHolds > 175)
            {
              this.gestureEnd();
            }
          }
          else
          {
            this.setEnvTargets(0);
          }


        }else{
          //console.log("reset gesture");
          this.numHolds = 0;
          this.numTouches = 0;
          this.setEnvTargets(0);
        }


      }

      for(var i = 0; i < this.reactEnvelopes.length; i++)
      {
        this.reactEnvelopes[i].step();
      }

      //check if any of the envelopes are active
      this.envsActive = false;

      for(var i = 0; i < this.reactEnvelopes.length; i++)
      {
        if(this.reactEnvelopes[i].z > 0.005)
        {
          this.envsActive = true;
          break;
        }
      }

      if(!this.envsActive)
      {
        this.gestureEnd(); // just incase it was missed
        //check for latest reactionMap
        this.updateReactionMap();
      }

      if(this.isGesture && this.envsActive)
      {
        if(this.isExcitable)
        {
          this.excitementEnv.targetVal = 1.0;
          this.excitementEnv.step();
        }

        this.updateState(); //only updateState if a gesture is happening

      }else{

        if(this.excitementEnv.z > 0.93)
        {
          this.graphics.explode();
          this.excitementEnv.z = 0.0;
        }

        this.excitementEnv.targetVal = 0.0;
        this.excitementEnv.step();
      }


      this.graphics.updateReactions(this.envsActive, this.reactEnvelopes);
      if(this.isExcitable)
      {
        this.graphics.updateExplosion(this.excitementEnv);
      }


      this.graphics.draw(this.ellapsedTime, this.mousePos, function(){

        this.sound.spit();
        window.setTimeout(
          function()
          {
            socket.emit('splat', {_id: userid,
              splatPos: this.splatPos,
              splatPan: this.splatPan ,
              splatRate: this.splatRate,
              colMode: this.ud.colMode, //passing these to display means no need for DB lookup
              colSeed: this.ud.colSeed
            });

          }.bind(this),
        300);

      }.bind(this));
      this.sound.update(this.ellapsedTime, this.mousePos, this.envsActive, this.reactEnvelopes);
    }

    this.renderLoop = requestAnimationFrame( this.render );

  }.bind(this);


  this.updateState = function()
  {




    if(this.changingState){

      this.stateEnvelope.step();

      if(this.stateEnvelope.z < 0.99)
      {
        this.graphics.updateState(this.stateEnvelope);
      }
      else
      {

        if(this.stateIndex < this.maxState)
        {
          this.changingState = true;
          this.incrementState(); // keep moving through states
        }
        else
        {
          console.log("maxState reached")
          this.changingState = false;
        }
      }

    }

  }

  this.incrementState = function()
  {
    this.stateIndex += 1;

    //modify the reactionMap here ?

    this.stateEnvelope.z = 0.0;
    this.stateEnvelope.targetVal = 1.0;

    //call the graphics update
    this.graphics.incrementState(this.stateIndex);

    //tell the server because the change came from here
    this.callback({state: this.stateIndex});

  }

  this.changeState = function(idx)
  {
    //if(this.stateIndex == idx)return;

    this.stateIndex = idx;
    this.stateEnvelope.z = 0.0;
    //stop all other envelopes

    if(idx == 0)
    {
      this.graphics.changeState(0);
      this.updateReactionMap();
    }
    else
    {
      this.graphics.changeState(idx - 1); //will have to deal with 0
      this.graphics.incrementState(this.stateIndex);
      this.updateReactionMap();
    }

    if(this.stateIndex <= this.maxState)
    {
      this.changingState = true;
    }
    else
    {
      this.changingState = false;
    }

  }

  this.updateReactionMap = function(){


    var cz = 0;

    if(this.reactionMaps[this.stateIndex] != undefined)
    {

      for(i in this.reactionMaps[this.stateIndex])
      {
        var rm = this.reactionMaps[this.stateIndex][i];


        var z = rm.z%1;
        if(z >= cz &&
           rm.z > this.currentReactionMap.z
           && this.stateEnvelope.z >= z)
        {
          cz = z;
          if(rm.instruction != undefined)this.graphics.displayInstruction(rm.instruction);
          this.currentReactionMap = rm;
            //console.log("udate rm");
        }
      }
    }
  }

  this.setIsSplat = function(b)
  {
    this.isExcitable = b;
  }

  this.setMaxState = function(n)
  {


    this.maxState = n;

    if(this.stateIndex < this.maxState)
    {
      this.changingState = true;
    }
    else
    {
      console.log("maxState reached or exceeded")
      this.changingState = false;
    }

  }


  this.setEnvTime = function(et)
  {
    this.envTime = et;
    this.stateEnvelope.setTime(et);

  }



}
