/*---------------------------------------------------------GENERIC FUNCTIONS-----------------------------------*/

//hashable random function

rand = function(x){
	var f  = fract(Math.sin(x)*1308153369613);
	return f;
}

fract = function(f)
{
	return (f < 1.0) ? f : (f % Math.floor(f));
}

//seedable object

Rand = function(seed) {

	//ensures seed is a 6 digit number
	this.seed = Math.floor(rand(seed) * 100000);

	this.getRand = function(x){

		var f  = fract(Math.sin(x)*1308153369613 + seed);
		return f;
	}
}

randCol = function(){

	return '#'+Math.floor(Math.random()*16777215).toString(16);
}

/*-----------------------------------------------------------------------*/

generateTempId = function (n){

	var chars = "abcdefghijklmnnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ!@£$%^&*()-=_+";
	var count = 0;
	var str = "";
	var idx;

	while(count < n){

		idx = Math.random() * (chars.length - 1);
		str += chars[parseInt(idx)];
		count++;
	}

	return str;

}

shuffleArray = function(o){ //v1.0
		for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
		return o;
}



/* -------------------------------------MAPPING -----------------------------------------*/

linlin = function(input, i_min, i_max, o_min, o_max)
{
	var i_range = Math.abs(i_max - i_min);
	var norm = (input - i_min)/i_range;
	//reversing if min and max are otherway round
	if(i_min > i_max){
		norm = 1.0 - norm;
	}
	if(o_min > o_max)
	{
		norm = 1.0 - norm;
	}
	var o_range = Math.abs(o_max - o_min);
	var out = norm * o_range + Math.min(o_min, o_max);
	return out;
}

linexp = function(input, i_min, i_max, o_min, o_max, exp)
{
	var i_range = Math.abs(i_max - i_min);
	var norm = (input - i_min)/i_range;

	if(i_min > i_max){
		norm = 1.0 - norm;
	}
	if(o_min > o_max)
	{
		norm = 1.0 - norm;
	}

	var o_range = Math.abs(o_max - o_min);
	var out = Math.pow(norm,exp) * o_range + Math.min(o_min, o_max);
	return out;
}

/*--------------------------------------------------------------------------------------------*/

LineEnv = function(dur, min, max){

	//strictly timed linear envelope ... nothing more nothing less

	this.value = min;
	this.dur = dur;
	this.min = min;
	this.max = max;
	this.isTriggered = false;
	this.startTime = 0.0;

	this.trigger = function(){
		this.startTime = new Date().getTime()/1000;
		this.value = min;
		this.isTriggered = true;
	}

	this.update = function()
	{
		if(this.isTriggered)
		{
			var et = new Date().getTime()/1000;
			var p = Math.min(1.0, (et - this.startTime)/this.dur );
			this.value = linlin(p, 0.0, 1.0, this.min, this.max);
			return this.value;
		}
		else
		{
			return this.min;
		}
	}

	this.reset = function()
	{
			this.isTriggered = false;
	}

}

/*------------------------------------------------ONE POLE -----------------------------------*/

//for enveloping

Envelope = function(time, sampleRate)
{
	this.a  = 0;
	this.b = 0;
	this.z = 0.0;
	this.targetVal = 0.0;
	this.sampleRate = sampleRate;
	this.isLatched = false;


	this.step = function()
	{
		var v = this.targetVal * this.a + this.z * this.b;

		if(this.isLatched)
		{
			this.z = Math.max(v, this.z);
		}
		else
		{
			this.z = v;
		}

		return this.z;
	}

	this.setTime = function(t)
	{
		this.time = t;
		this.b = Math.exp(-1.0/(t * this.sampleRate));
		this.a = 1.0 - this.b;
	}

	this.setTime(time);

}

//////////////////////Different attacks and decays/////////////////////////

Envelope2 = function(attTime, decTime, sampleRate)
{
	this.a_att  = 0;
	this.b_att = 0;
	this.a_dec  = 0;
	this.b_dec = 0;

	this.z = 0.0;

	this.targetVal = 0.0;
	this.sampleRate = sampleRate;


	this.step = function()
	{
		if(this.targetVal == this.z)
		{
			return
		}
		else if(this.targetVal < this.z)
		{
			this.z = this.targetVal * this.a_dec + this.z * this.b_dec;
		}
		else
		{
			this.z = this.targetVal * this.a_att + this.z * this.b_att;
		}

	}

	this.setAttDel = function(attTime, decTime)
	{
		this.attTime = attTime;
		this.decTime = decTime;

		this.b_att = Math.exp(-1.0/(attTime * this.sampleRate));
		this.a_att = 1.0 - this.b_att;
		this.b_dec = Math.exp(-1.0/(decTime * this.sampleRate));
		this.a_dec = 1.0 - this.b_dec;
	}

	this.reset = function(){
		this.setAttDel(this.attTime, this.decTime);
		this.z = 0.0;
	}

	this.setAttDel(attTime, decTime);

}

//////////////////////////////////////////////////////////////////

isNumber = function(n)
{
	return !isNaN(parseFloat(n)) && isFinite(n);
}



hexToFloat = function(hex) {

		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ?
				[ parseInt(result[1], 16)/255.,
				 parseInt(result[2], 16)/255.,
				 parseInt(result[3], 16)/255.
				]
			: null;
}

hslToRgb = function(h, s, l){
		var r, g, b;

		if(s == 0){
				r = g = b = l; // achromatic
		}else{
				var hue2rgb = function hue2rgb(p, q, t){
						if(t < 0) t += 1;
						if(t > 1) t -= 1;
						if(t < 1/6) return p + (q - p) * 6 * t;
						if(t < 1/2) return q;
						if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
						return p;
				}

				var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
				var p = 2 * l - q;
				r = hue2rgb(p, q, h + 1/3);
				g = hue2rgb(p, q, h);
				b = hue2rgb(p, q, h - 1/3);
		}

		return [r,g,b];
}

Math.fmod = function (a,b) { return Number((a - (Math.floor(a / b) * b)).toPrecision(8)); };

getMaxFontSize = function(text, dims, font, fontSize, context)
{
	//gets the maximum fontSize so that all strings in an array will fit into a rect
	context.font = fontSize + "pt " + font;

	//reduce fontSize to fit
	var metrics = context.measureText(text);
	while((metrics.width > dims.w * 0.95 || metrics.height > dims.h * 0.95) && fontSize > 0)
	{
		fontSize -= 1; //reduce the fontSize a bit
		context.font = fontSize + "pt " + font;
		metrics = context.measureText(text);
	}

	return fontSize;

}

drawText = function(text, dims, font, fontSize, context, align)
{
	//iterate and draw text
	var offset = 0;
	var vStart = dims.y + dims.h/2;
	context.font = fontSize + "pt " + font;

	if(align == undefined || align == "center")
	{
		context.textAlign = "center";
		offset = dims.w/2;
	}
	else if(align == "left")
	{
		context.textAlign = "left";
		offset = 0;
	}
	else if(align == "right")
	{
		context.textAlign = "right";
		offset = dims.w;
	}

	context.fillText(text, dims.x + offset, vStart);

}

fitText = function(text, dims, font, fontSize, context, align)
{

	//dims = {x: y: w: h:}
	//fits and centers text into rectangle

	context.font = fontSize + "pt " + font;
	var words = text.split(' ');

	//reduce fontSize to fit longest word
	for(var i = 0; i < words.length; i++)
	{
		var metrics = context.measureText(words[i]);
		while(metrics.width > dims.w * 0.95)
		{
			fontSize -= 1; //reduce the fontSize a bit
			context.font = fontSize + "pt " + font;
			metrics = context.measureText(words[i]);
		}
	}

	//text wrapping
	var line = words[0];
	var lines = [];
	var numWords = 1;

	while(words.length > 1)
	{
		var testLine = line + ' ' + words[1];
		var metrics = context.measureText(testLine);
		if (metrics.width > dims.w * 0.95)
		{
			lines.push(line); //add whatever we had before
			line = words[1];
			numWords = 1;
		}
		else
		{
			line = testLine;
			numWords++;
		}
		words.splice(0,1);
		if(words.length == 1)
		{
			lines.push(line);
			words.splice(0,1);
		}
	}

	if(lines.length == 0) //there was only one word
	{
		lines.push(words[0]);
	}


	var testSize = (dims.h * 0.9)/(1.5 * lines.length);

	if(testSize < fontSize)
	{
		//run the process again recursively
		fitText(text, dims, font, testSize, context, align);
	}
	else
	{
		var vSpace = fontSize * 1.5;
		var vTotal = vSpace * lines.length;

		//calculate starting y based on number of lines
		var vStart = dims.y + dims.h/2 - vSpace * 0.5 * (lines.length - 1);

		//iterate and draw text
		var offset = 0;
		if(align == undefined || align == "center")
		{
			context.textAlign = "center";
			offset = dims.w/2;
		}
		else if(align == "left")
		{
			context.textAlign = "left";
			offset = 0;
		}
		else if(align == "right")
		{
			context.textAlign = "right";
			offset = dims.w;
		}

		for(var i = 0; i < lines.length; i++)
		{
			context.fillText(lines[i], dims.x + offset, vStart + i * vSpace);
		}


	}

}
