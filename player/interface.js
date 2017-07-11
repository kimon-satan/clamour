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

  this.isMobile = ud.isMobile; //ugh horrible
  this.isDying = ud.isDying;

  this.splatPan = (-1.0 + Math.random() * 2.0) * 0.85;
  this.splatRate = Math.random();
  this.splatPos = Math.random();


  this.transEnv = new Envelope2(0.1,2.0,60);
  this.rotEnv = new Envelope(1.0, 60);



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
          ],

    "mobile": [
              { z: 0.0,
                    map: [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined
                    ],
                    instruction: "swipe",
                    inst_trig: 2

                  }
    ],

    "isDying": [
              { z: 0.0,
                    map: [
                    undefined,
                    {graphics: "shudderThetaDown", sound: "misty" },
                    undefined,
                    {graphics: "shudderThetaDown", sound: "misty" },
                    {graphics: "shudderThetaDown", sound: "misty" },
                    undefined
                    ],

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
    this.showGrid = false;


    this.reactEnvelopes = [
      new Envelope2(0.1,0.01,60),
      new Envelope2(1.0,0.2,60),
      new Envelope2(2.0,0.2,60),
      new Envelope(2.0, 60), //latched by default
      new Envelope2(0.1, 0.3, 60),
      new Envelope2(0.1,0.5,60)
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

      if(this.isMobile)
      {
        this.buildMove(p);
      }
      else
      {
        this.gestureMove(p);
      }

    }.bind(this)
    , false);

    this.canvas.addEventListener('touchend', function(e)
    {
      this.isMouseDown = false;
      this.gestureEnd();

      if(this.isMobile)
      {
        this.triggerMove();
      }

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
        if(this.isMobile)
        {
          this.buildMove(pos);
        }
        else
        {
          this.gestureMove(pos);
        }
      }



    }.bind(this)
    , false);

    this.canvas.addEventListener('mouseup', function(e)
    {
      this.isMouseDown = false;
      this.gestureEnd();


      if(this.isMobile)
      {
        this.triggerMove();
      }


    }.bind(this)
    , false);

    //start rendering
    //this.render(); // no longer using this as we do loading at the start to spread server load
    var state_z = ud.state_z;
    this.changeState(ud.state); //changes state z
    this.setEnvTime(ud.envTime);
    this.setIsSplat(ud.isSplat); //might cause a loop !?
    this.setMaxState(ud.maxState);
    this.setIsMobile(ud.isMobile);
    this.setIsDying(ud.isDying); //changes state z
    this.stateEnvelope.z = state_z;
    this.ud.state_z = state_z;
    this.updateState(this.stateEnvelope.z);

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
    this.setEnvTargets(0.);
    //check for latest reactionMap
    this.updateReactionMap();
    this.isGesture = false;
    this.ud.state_z = this.stateEnvelope.z;
    socket.emit('update_user', {_id: this.ud._id, state_z: this.ud.state_z}); //tell the server that we have changed mode
  }

  this.updateGesture = function(ng)
  {

    this.isGesture = false;

    if(this.currentGesture == 0 )
    {

      if(ng == this.currentReactionMap.inst_trig)
      {
        this.graphics.hideInstruction();
      }
      //console.log(this.currentGesture, this.currentReactionMap.map[this.currentGesture]);

      if(this.currentReactionMap.map[ng] != undefined)
      {
        this.currentGesture = ng;
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

  this.buildMove = function(pos)
  {

    this.numTouches++;
    this.isNewTouch = true;

    if(this.numTouches > 5){

      var v = new THREE.Vector2().subVectors(pos, this.touchStartPos);
      var vl = v.length();
      this.mousePos.copy(pos);

      this.isNewTouch = true;

      //TODO add energy based on direction

      if(this.currentGesture == 0)
      {
        this.currentGesture = 1;
        if(this.currentReactionMap.map[this.currentGesture] != undefined)
        {
          this.sound.setReaction(this.currentReactionMap.map[this.currentGesture].sound);
          this.graphics.setReaction(this.currentReactionMap.map[this.currentGesture].graphics);
        }
        else {
          this.sound.setReaction();
          this.graphics.setReaction();
        }
      }

      this.isGesture = true;
      this.setEnvTargets(1.);
      if(this.ud.isDying)
      {
        this.sound.parameters.amp.max = Math.pow(this.ud.death, 2); //will need tweaking
        this.sound.parameters.grainSpacing.min = 0.04 + Math.pow(this.ud.death, 3) * 0.2; //will need tweaking
      }



    }
  }

  this.triggerMove = function()
  {

    var v = new THREE.Vector2().subVectors(this.mousePos, this.touchStartPos);
    var vl = v.length() * (1.0 - Math.abs(v.dot(new THREE.Vector3(1,0,0))));
    v.normalize();

    var rot = v.angle() - Math.PI * 1.5;

    console.log(rot)
    if(rot < Math.PI/2 && rot > -Math.PI/2)
    {
      this.transEnv.targetVal = vl;
      this.rotEnv.targetVal += rot;
      this.graphics.hideInstruction();

      if(this.isDying)
      {
        this.ud.death = Math.min(1.0, this.ud.death + 0.02);
        this.stateEnvelope.targetVal = this.ud.death;
        this.ud.state_z = this.stateEnvelope.z;
        this.transEnv.targetVal *= 1.0 - this.ud.death;
        socket.emit('update_user', {_id: this.ud._id, state_z: this.ud.state_z, death: this.ud.death});
      }

      socket.emit('moveBlob', {
        _id: userid,
        rot: this.rotEnv.targetVal,
        trans: this.transEnv.targetVal,
        death: this.ud.death,
        state: this.stateIndex,
        state_z: this.stateEnvelope.z
      });


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
      if(this.panicCount > 8)
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

      if(this.isMobile)
      {
        this.transEnv.step();
        this.rotEnv.step();

        if(this.transEnv.z > this.transEnv.targetVal * 0.95)
        {
          this.transEnv.targetVal = 0;
        }

        this.graphics.updateGrid(this.transEnv.z, this.rotEnv.z);

      }


      if(this.isNewTouch)
      {
        this.isNewTouch = false;
      }
      else
      {

        if(this.isMouseDown){


          if(!this.isMobile)
          {
            this.numHolds ++;

            //if it's a hold gesture
            if(this.numHolds > 20 && (this.currentGesture == 0 || this.currentGesture == 5))
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

          }


        }else{

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



      if(!this.envsActive && this.isGesture)
      {
        console.log("fall back")
        this.gestureEnd();
      }

      if(this.isGesture && this.envsActive)
      {
        if(this.isExcitable)
        {
          this.excitementEnv.targetVal = 1.0;
          this.excitementEnv.step();
        }

        this.updateState(this.stateEnvelope.z); //only updateState if a gesture is happening

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
            var msgObj = {
              _id: userid,
              splatPos: this.splatPos,
              splatPan: this.splatPan ,
              splatRate: this.splatRate,
              state_z: this.stateEnvelope.z
            };

            Object.keys(this.ud).forEach(function(k, idx, array){
              msgObj[k] = this.ud[k];

              if(idx == array.length-1)
              {
                socket.emit('splat', msgObj);
              }
            }, this);

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
        this.graphics.updateState(this.stateEnvelope.z);
      }
      else
      {

        this.changingState = this.stateIndex <= this.maxState;
        if(this.stateIndex < this.maxState)
        {
          this.incrementState(); // keep moving through states
        }
      }

    }

  }

  this.incrementState = function()
  {
    this.stateIndex += 1;
    this.ud.state = this.stateIndex;

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
    this.ud.state_z = 0.0;
    this.ud.state = idx;
    this.currentReactionMap = this.reactionMaps[0][0];
    this.graphics.instruct_material.visible = false;
    //stop all other envelopes

    if(idx <= 0)
    {
      this.graphics.changeState(0);
      this.updateReactionMap();
    }
    else
    {


      this.graphics.changeState(idx -1);
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

    console.log("update reaction map")

    if(this.isDying)
    {
      this.currentReactionMap = this.reactionMaps["isDying"][0];
    }
    else if(this.isMobile)
    {
      this.currentReactionMap = this.reactionMaps["mobile"][0];
      this.graphics.displayInstruction(this.currentReactionMap.instruction);
    }
    else
    {
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
  }

  this.setIsSplat = function(b)
  {
    this.isExcitable = b;
  }

  this.setIsMobile = function(b)
  {

    this.rotEnv.z = 0;
    this.rotEnv.targetVal = 0;
    this.transEnv.z = 0;
    this.transEnv.targetVal = 0;

    this.isMobile = b;
    this.graphics.setIsMobile(b);
    this.gestureEnd();

    for(var i =0 ; i < this.reactEnvelopes.length; i++)
    {
      this.reactEnvelopes[i].z = 0;
    }

    this.updateReactionMap();
  }

  this.setIsDying = function(b)
  {
    this.isDying = b;
    this.ud.isDying = b;

    if(b)
    {
      //this.ud.death = 0; //we don't wanrt this incase it's just a reset
      this.stateEnvelope.z = 0;
      this.stateEnvelope.targetVal = 0;
      this.updateReactionMap();
      this.changeState(5);
      this.setMaxState(5); //FIXME a hack would be better to make something which works from any state
    }
    else
    {
      this.ud.death = 0;
      this.changeState(Math.min(this.ud.state, 4));
      this.setMaxState(Math.min(this.ud.maxState, 4)); //FIXME a hack would be better to make something which works from any state
    }
  }

  this.setMaxState = function(n)
  {
    this.maxState = n;
    this.ud.maxState = n;

    if(this.stateIndex <= this.maxState)
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
