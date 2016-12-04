window.Sound = function(){

//GLOBALS

  this.audioContext;
  this.compressor;
  this.buffer = 0;
  this.bufferDuration = 0.0;

  this.buffers = {};

  this.realTime = 0.0;
  this.grainTime = 0.0;

  this.isSourceLoaded = false;
  this.applyGrainWindow = false;
  this.grainWindow;

  this.splatPan;
  this.splatPos;
  this.splatRate;

  //IOS hack
  this.isUnlocked = false;

  this.reaction;
  this.seed;

  this.files = [
  '138344_reverse_crow.wav',
  '169830_dino009.wav',
  '19997_blackbird.wav',
  '19997_blackbird_flap.wav',
  '20472_woodpigeonnr_01.wav', //4
  '20472_woodpigeonnr_02.wav',
  '20472_woodpigeonnr_03.wav',
  '235443_sandhill-crane.wav',
  '240476_wings_.wav',
  '262307__steffcaffrey__cat-happy-purr-twitter2.wav',
  '262308__steffcaffrey__cat-happy-purr-twit3.wav',
  '262310__steffcaffrey__cat-purr-twit5.wav',
  '262311__steffcaffrey__cat-purr-twit6.wav',
  '278903__syntheway__guardians-of-limbo-syntheway-magnus-choir-vsti.wav',
  '319512_pigeon_low.wav',
  '319512_pigeon_select.wav',
  '57271_cat-bird.wav',
  '66637_crying-baby-2.wav',
  '66637_crying-baby-2b.wav',
  '66637_crying-baby-3.wav',
  '66637_crying-baby-4.wav',
  '66637_crying-baby-select.wav',
  ];


  this.parameters =
  {
    file: {value: this.files[0]},
    amp: {value: 0.0, min: 0.0, max: 1.0, map: "none"},
    speed: {value: 0.0, min: -4.0, max: 4.0, map: "none"  },
    pitch: {value: 1.0, min: 1.0, max: 3600, map: "none"  },
    pitchRandomization: {value: 0.0, min: 0.0, max: 1200.0, map: "none"  },
    timeRandomization:{value: 0.01 , min:0.0, max:1.0, map: "none" },
    grainSize:{value: 0.09 , min:0.010, max:0.5, map: "none" },
    grainDuration:{value: 0.09 , min:0.010, max:0.5, map: "none" },
    grainSpacing:{value: 0.045 , min:0.010, max:0.5, map: "none" },
    regionStart: {value: 0.01 , min:0.0, max:1.0, map: "none" },
    regionLength: {value: 0.01 , min:0.0, max:10.0, map: "none"  }
  }

  this.reactions =
  {
    pigeonUp: {
      file: {value: "20472_woodpigeonnr_02.wav"},
      amp: {value: 0.0, min: 0.0, max: 1.0, map: 1},
      speed: {value: 0.0 },
      pitch: {value: 1.0, min: 300.0, max: 800, map: "rand" },
      pitchRandomization: {value: 0.0 },
      timeRandomization:{value: 0.0 },
      grainDuration:{value: 0.05 , min:0.05, max:0.2, map: 1 },
      grainSpacing:{value: 0.05 , min:0.25, max:0.01, map: 1  },
      regionStart: {value: 0.0 , min:1.0, max: 0.0 , map: 3 },
      regionLength: {value: 0.0 }
    },
    pigeonDown: {
      file: {value: "20472_woodpigeonnr_01b.wav"},
      amp: {value: 0.0, min: 0.0, max: 1.0, map: 1},
      speed: {value: 0.0 },
      pitch: {value: 1.0, min: 300.0, max: 800, map: "rand" },
      pitchRandomization: {value: 0.0 },
      timeRandomization:{value: 0.0 },
      grainDuration:{value: 0.04 },
      grainSpacing:{value: 0.05 , min:0.04, max:0.16, map:3  },
      regionStart: {value: 0.0 , min:0.9, max: 0.0 , map: 3 },
      regionLength: {value: 0.0 }
    },

    pigeonWah: {
      file: {value: "20472_wpg_wah.wav"},
      amp: {value: 0.0, min: 0.0, max: 1.0, map: 1},
      speed: {value: 0.0 },
      pitch: {value: 1.0, min: 0.0, max: 1500, map: 2 },
      pitchRandomization: {value: 100.0 },
      timeRandomization:{value: 0.0, min: 0.0, max: 0.2, map: 2 },
      grainDuration:{value: 0.03, min: 0.1, max: 0.02, map: "none" },
      grainSpacing:{value: 0.05 , min:0.08, max:0.01, map: "none"  },
      regionStart: {value: 1.0 , min:0.4, max: 0.9 , map: 2 },
      regionLength: {value: 0.0 }
    },

    babyDown: {
      file: {value: "66637_crying-baby-2b.wav"},
      amp: {value: 0.0, min: 0.0, max: 1.0, map: 1},
      speed: {value: 0.0 },
      pitch: {value: 1.0, min: 300.0, max: 800, map: "rand" },
      pitchRandomization: {value: 0.0 },
      timeRandomization:{value: 0.0 },
      grainDuration:{value: 0.1 },
      grainSpacing:{value: 0.05 , min:0.04, max:0.15, map:3  },
      regionStart: {value: 0.0 , min:0.0, max: 1.0 , map: 3 },
      regionLength: {value: 0.0 }
    },
    babyUp: {
      file: {value: "66637_crying-baby-2b.wav"},
      amp: {value: 0.0, min: 0.0, max: 1.0, map: 1},
      speed: {value: 0.0 },
      pitch: {value: 1.0, min: 300.0, max: 800, map: "rand" },
      pitchRandomization: {value: 0.0 },
      timeRandomization:{value: 0.0 },
      grainDuration:{value: 0.1, min: 0.01, max: 0.1, map: "none" },
      grainSpacing:{value: 0.05 , min:0.08, max:0.01, map:3  },
      regionStart: {value: 0.0 , min:1.0, max: 0.0 , map: 3 },
      regionLength: {value: 0.0 }
    },

    babyPigeonMix: {
      file: {value: "20472_babypig_mixdown.wav"},
      amp: {value: 0.0, min: 0.0, max: 1.0, map: 1},
      speed: {value: 0.0 },
      pitch: {value: 1.0, min: 300.0, max: 800, map: "rand" },
      pitchRandomization: {value: 0.0 },
      timeRandomization:{value: 0.0 },
      grainDuration:{value: 0.05, min: 0.01, max: 0.1, map: "none" },
      grainSpacing:{value: 0.05 , min:0.08, max:0.01, map: "none"  },
      regionStart: {value: 0.0 , min:0.0, max: 1.0 , map: 2 },
      regionLength: {value: 0.0 }
    },



  }

  this.spit = function()
  {

    this.simplePlay("232211_spit.wav"); //FIXME !!!!

    window.setTimeout(
      function(){
        msgStream.emit('displayMessage', { type: 'splat', id: Meteor.user()._id});
        Meteor.call("splatSound", Meteor.user()._id);
      }.bind(this), 300);
  }.bind(this);

}
