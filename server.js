
var globals = require('./globals.js');
var helpers = require('./helpers.js'); //include the helpers
var admincmds = require('./admincmds.js');
var displaycmds = require('./displaycmds.js');
var playercmds = require('./playercmds.js');

//check the various collections exist if not create them

globals.Presets.findOne({type: "love", name: "default"}).then((doc)=> {

	if(doc == null)
	{
		console.log("creating default parameters");
		globals.Presets.insert({name: "default", options: globals.LoveParameters});
	}

});

helpers.loadSettings();

//We define a route handler / that gets called when we hit our website home.

globals.app.use("/admin",express.static(__dirname + "/admin"));
globals.app.use("/style",express.static(__dirname + "/style"));
globals.app.use("/libs",express.static(__dirname + "/libs"));
globals.app.use("/player",express.static(__dirname + "/player"));
globals.app.use("/tests",express.static(__dirname + "/tests"));
globals.app.use("/display",express.static(__dirname + "/display"));
globals.app.use("/samples",express.static(__dirname + "/samples"));
globals.app.use("/images",express.static(__dirname + "/images"));

//three types of user
 globals.app.get('/admin', function(req, res){
	 res.sendFile(__dirname + '/admin/admin.html');
 });
 //
 globals.app.get('/display', function(req, res){
	 res.sendFile(__dirname + '/display/display.html');
 });
//
globals.app.get('/tests', function(req, res){
	res.sendFile(__dirname + '/tests/tests.html');
});

//
 globals.app.get('/', function(req, res){
	 res.sendFile(__dirname + '/player/player.html');
 });

globals.admin.on('connection', admincmds.response);
globals.display.on('connection', displaycmds.response);
globals.players.on('connection', playercmds.response);

//We make the http server listen on port 3000.
http.listen(3000, function(){
	console.log('listening on *:3000');
});
