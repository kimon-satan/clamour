

colorPalette1 = function(seed, hueMode)
{


  var h = calcHue(seed, hueMode);

  if(seed < 0.5)
  {
    var s = 0.65 - seed * 0.5;
    var l = 0.3 * (1.0 - seed);
  }else{
    var s = 0.5 + Math.pow(seed,2.0) * 0.5;
    var l = 0.25 + 0.45 * (1.0 - Math.pow(seed,0.5));
  }


  var c = new THREE.Vector3(h,s,l);

  return c;
}

colorPalette2 = function(seed, hueMode)
{
  var h = calcHue(seed, hueMode);

  if(seed < 0.5)
  {
    var s = 0.5 + Math.pow(seed,2.0) * 0.5;
    var l = 0.25 + 0.45 * (1.0 - Math.pow(seed,0.5));
  }
  else
  {
    var s = 0.65 - (1.0 - seed) * 0.5;
    var l = 0.7 - (seed - .5) * 0.4;
  }


  var c = new THREE.Vector3(h,s,l);

  return c;

}

colorPalette3 = function(seed, hueMode)
{
  var h = calcHue(seed, hueMode);

  if(seed < 0.5)
  {
    var s = 0.5 - (0.5 - seed) * 0.5;
    var l = 0.3 + seed;
  }
  else
  {
    var s = 0.65 - seed * 0.5;
    var l = 0.3 - seed * 0.1;
  }

  var c = new THREE.Vector3(h,s,l);

  return c;

}

calcHue = function(seed, mode)
{
  var r = 0.08
  switch (mode) {
    case 0: return -r/2 + seed * r;
    case 1: return  r/2 - seed * r;
    case 2: return -r/2 + Math.sin(seed * Math.PI) * r;
    case 3: return -r/2 + Math.random() * r;
  }
}

getColors = function(seed, mode){

  //order = darkest to brightest / most to least saturated

  var colArray = new Array();

  for(var i = 0; i < 3; i++)
  {

    m = (mode + i)%3;

    switch (i) {
      case 0:
      var col = colorPalette1(seed, m);
      break;
      case 1:
      var col = colorPalette2(seed, m);
      break;
      case 2:
      var col = colorPalette3(seed, m);
      break;
    }

    var idx = colArray.length;

      for(var j = 0; j < colArray.length; j++){
        if(col.z >= colArray[j].z){
          idx = j;
          break;
        }
      }

    colArray.splice(idx,0,col);

  }

  //when the brightnesses are similar sort last two elements by saturation
  if(colArray[1].y < colArray[2].y && colArray[1].z - colArray[2].z < 0.1){
    var t = colArray[1];
    colArray[1] = colArray[2];
    colArray[2] = t;
  }

  return colArray;

}

convertRGB = function(hsl){
  var rgb = hslToRgb(hsl.x ,hsl.y, hsl.z);
  return new THREE.Vector3(rgb[0], rgb[1], rgb[2]);
}
