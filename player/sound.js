

//NB this will need to be split in AC and synth classes if there are multiple sound streams


Sound.prototype.init = function(){

  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  this.audioContext = new AudioContext();

  this.realTime = Math.max(0, this.audioContext.currentTime);

  this.seed = Math.random();

  if (this.audioContext.decodeAudioData)
  {
    this.applyGrainWindow = true;

    var grainWindowLength = 16384;
    grainWindow = new Float32Array(grainWindowLength);
    for (var i = 0; i < grainWindowLength; ++i)
    {
      grainWindow[i] = Math.sin(Math.PI * i / grainWindowLength);
    }
  }
  else
  {
    //grain window not supported
    this.applyGrainWindow = false;
  }

  if (this.audioContext.createDynamicsCompressor)
  {
    console.log("compressor created");
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.connect(this.audioContext.destination);
  }
  else
  {
    //Compressor not available
    this.compressor = this.audioContext.destination;
  }

  //for each reaction load the sound file
  for(var s in this.reactions)
  {
    this.loadSample("samples/" + this.reactions[s].file.value);
  }

  this.loadSample("samples/" + "232211_spit.wav");


}

Sound.prototype.update = function(ellapsedTime, mousePos, envsActive, env)
{
  if(!this.audioContext)return; //not initialised yet
  if(this.reaction == undefined)return; //no sound reaction

  var currentTime = this.audioContext.currentTime;

  //mapping to envelopes this will need sorting

  if(envsActive)
  {

    for (var property in this.parameters)
    {

      if(typeof(this.parameters[property].map) == "number")
      {
        this.parameters[property].value = linlin
        (
          env[this.parameters[property].map].z,
          0.0, 1.0,
          this.parameters[property].min, this.parameters[property].max
        );
      }
    }

    while (this.realTime < currentTime + 0.100 )
    {

      if(!this.nextGrain()){
        break;
      };

    }



  }
}

Sound.prototype.loadSample = function(url) {

  //TODO fix audio loading bug

  var fileId = this.getFileId(url);

  if(this.buffers[fileId] != undefined)
  {
    return;
  }

  this.buffers[fileId] = {duration: 0, isSourceLoaded: false, buffer: 0 };

  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var ptr = this;

  request.onload = function() {
    ptr.audioContext.decodeAudioData(
      request.response,
      function(b) {

        ptr.buffers[fileId].buffer = b;
        ptr.buffers[fileId].duration = b.duration - 0.050;
        ptr.buffers[fileId].isSourceLoaded = true;

      },

      function(b) {
        console.log("Error loading " + url);
      }
    );
  };

  request.onerror = function() {
    alert("error loading");
  };

  request.send();
}

Sound.prototype.simplePlay = function(file){

  var bobj = this.buffers[this.getFileId(file)];

  var source = this.audioContext.createBufferSource();
  source.buffer = bobj.buffer;

  var gainNode = this.audioContext.createGain();
  gainNode.gain.value =  1.0;

  source.connect(gainNode);
  gainNode.connect(this.compressor);

  source.start();


}


Sound.prototype.nextGrain = function()
{
  //plays an individual grain


  if (!this.buffer)
  {
    console.log("no buffer");
    return false;
  }


  var source = this.audioContext.createBufferSource();
  source.buffer = this.buffer;


  var r1 = Math.random();
  var r2 = Math.random();

  r1 = (r1 - 0.5) * 2.0;
  r2 = (r2 - 0.5) * 2.0;

  var gainNode = this.audioContext.createGain();
  gainNode.gain.value =  this.parameters.amp.value;

  var grainWindowNode;

  if (this.applyGrainWindow)
  {

    //console.log("applying grain window");
    //shape the grain window
    grainWindowNode = this.audioContext.createGain();
    source.connect(grainWindowNode);
    grainWindowNode.connect(gainNode);
  }
  else
  {
    console.log("no grain window")
    source.connect(gainNode);
  }

  // Pitch
  var totalPitch = this.parameters.pitch.value + r1 * this.parameters.pitchRandomization.value;
  var pitchRate = Math.pow(2.0, totalPitch / 1200.0);
  source.playbackRate.value = pitchRate;

  gainNode.connect(this.compressor);

  // Time randomization
  var randomGrainOffset = r2 * this.parameters.timeRandomization.value;

  // Schedule sound grain
  var offset = Math.max(0,this.grainTime + randomGrainOffset);
  source.start(this.realTime,offset , this.parameters.grainDuration.value);

  // Schedule the grain window.

  if (this.applyGrainWindow)
  {
    var windowDuration = this.parameters.grainDuration.value / pitchRate;
    grainWindowNode.gain.value = 0.0; // make default value 0
    grainWindowNode.gain.setValueCurveAtTime(grainWindow, this.realTime, windowDuration);
  }


  // Update time params
  this.realTime += this.parameters.grainSpacing.value;

  if(Math.abs(this.parameters.speed) > 0)
  {

    this.grainTime += this.parameters.speed.value * this.parameters.grainDuration.value;



    //grain time wrapping
    var regionStart = this.parameters.regionStart.value * this.bufferDuration;
    var regionEnd = Math.min(this.bufferDuration, regionStart  + this.parameters.regionLength.value);

    if (this.grainTime > regionEnd)
    {
      this.grainTime = regionStart;
    }
    else if (this.grainTime < regionStart)
    {
      this.grainTime += Math.min( this.bufferDuration - regionStart, this.parameters.regionLength.value);
    }

  }else{
    this.grainTime = this.parameters.regionStart.value * this.bufferDuration;
  }



  return true;

}



Sound.prototype.setReaction  = function(idx)
{

  if(idx == undefined)
  {
    this.reaction = undefined;
    return;
  }



  if(this.reactions[idx] == undefined)
  {
    console.log("reaction: " + idx + " not found");
    this.reaction = undefined;
    return;
  }

  this.reaction = idx;

  for(property in this.reactions[idx])
  {

    for(p in this.parameters[property])
    {

      if(this.reactions[idx][property][p] != undefined){
        this.parameters[property][p] = this.reactions[idx][property][p];
      }else{
        if(property == "map"){
          this.parameters[property][p] = "none";
        }
      }
    }

    if(this.parameters[property].map == "rand")
    {
      this.parameters[property].value = linlin(
        this.seed, 0, 1,
        this.parameters[property].min,
        this.parameters[property].max
      );
    }
  }

  var bobj = this.buffers[this.getFileId(this.parameters.file.value)];
  this.buffer =  bobj.buffer;
  this.bufferDuration = bobj.duration;
  this.isSourceLoaded = bobj.isSourceLoaded;

}

//IOS workaround

Sound.prototype.unlock = function()
{

  console.log("unlocking")

  // create empty buffer and play it
  var buffer = this.audioContext.createBuffer(1, 1, 22050);
  var source = this.audioContext.createBufferSource();

  source.buffer = buffer;
  source.connect(this.audioContext.destination);
  source.noteOn(0);


  var host = this;
  // by checking the play reaction after some time, we know if we're really unlocked


  var f = window.setInterval(function() {

    if(source.playbackState > 0)
    {
      host.isUnlocked = true;
      console.log("unlocked");
      window.clearInterval(f);
    }
  }, 10);

}

Sound.prototype.getFileId = function(url)
{
  var fileId = url.substring(url.lastIndexOf('/') + 1);
  fileId = fileId.substring(0, fileId.lastIndexOf('.'));

  return fileId
}
