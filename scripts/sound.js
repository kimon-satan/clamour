var Sound = function(){

//GLOBALS
  this.audioContext;
  this.compressor;
  this.buffer = 0;
  this.bufferDuration = 0.0;

  this.buffers = {};


  this.isSourceLoaded = false;

  //IOS hack
  this.isUnlocked = false;

}


Sound.prototype.init = function(){

  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  this.audioContext = new AudioContext();

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





//IOS workaround

Sound.prototype.unlock = function()
{

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
