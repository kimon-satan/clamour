
var globals = require('./globals.js');

var osc = require("osc");

var udpPort = new osc.UDPPort({
		localAddress: "127.0.0.1",
		localPort: 12345
});

udpPort.open();

//update the graphics

udpPort.on('message', (msg, rinfo) => {

		if(msg.address == "/poll")
		{
			 globals.display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
		}

});


require('./libs/utils.js'); //include the global utils functions
var helpers = require('./helpers.js'); //include the helpers
var admincmds = require('./admincmds.js');

//check the various collections exist if not create them

globals.Presets.findOne({type: "play", name: "default"}).then((doc)=> {

	if(doc == null)
	{
		console.log("creating default parameters");
		globals.Presets.insert({name: "default", options: globals.AllOptions});
	}

});


//We define a route handler / that gets called when we hit our website home.

globals.app.use("/admin",express.static(__dirname + "/admin"));
globals.app.use("/style",express.static(__dirname + "/style"));
globals.app.use("/libs",express.static(__dirname + "/libs"));
globals.app.use("/player",express.static(__dirname + "/player"));
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
 globals.app.get('/', function(req, res){
	 res.sendFile(__dirname + '/player/player.html');
 });




globals.admin.on('connection', admincmds.response);

globals.display.on('connection', function(socket)
{

	console.log("a display connected");

	socket.on('addTone', function(msg){

		console.log("addTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/addTone",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('updateTone', function(msg){

		console.log("updateTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/updateTone",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('endTone', function(msg){

		console.log("endTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/endTone",
				args: args,
		}, "127.0.0.1", 57120);

		globals.players.to(msg.id).emit('cmd', {cmd: 'set_params', value: {isMobile: true, isSplat: false}});

	})

	socket.on('startCrawler', function(msg){

		console.log("startCrawler", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/startCrawler",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('updateCrawler', function(msg){

		console.log("updateCrawler", msg);
		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/updateCrawler",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('endCrawler', function(msg){

		console.log("endCrawler", msg);
		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/endCrawler",
				args: args,
		}, "127.0.0.1", 57120);

	})

	socket.on('transTone', function(msg){

		console.log("transTone", msg);

		var args = [];

		Object.keys(msg).forEach(function(p)
		{
			args.push(p);
			args.push(msg[p]);
		})

		udpPort.send({
				address: "/transTone",
				args: args,
		}, "127.0.0.1", 57120);



	})




});


globals.players.on('connection', function(socket)
{

	var id;

	console.log('a player connected ');
	socket.emit("whoareyou", "?")

	socket.on('hello', function(msg)
	{

		//make all options

		var usrobj = {
				mode: "wait",
				connected: true,
				rooms: [],
				groups: []
		}

		Object.keys(globals.AllOptions).forEach(function(e){
			usrobj[e] = globals.AllOptions[e];
		})

		usrobj.colSeed = Math.random();
		usrobj.colMode = Math.floor(Math.random() * 4);
		usrobj.blobSeed = Math.random();

		if(msg == "new")
		{

		globals.UserData.insert(usrobj,{}, function(err,res)
			{
				if(err) throw err;
				console.log('hello new user: ' + res._id);
				id = res._id;
				socket.emit('welcome', res);
				globals.sockets[res._id] = socket; //store socket on global list
			});

		}
		else
		{

			globals.UserData.findOne(msg,{}, function(err,res)
			{
				if(err) throw err;

				if(!res)
				{
					//insert a new user instead
					globals.UserData.insert(usrobj, {}, function(err,res)
					{
						if(err) throw err;
						console.log('hello new user: ' + res._id);
						id = res._id;
						socket.emit('welcome', res);
						globals.sockets[res._id] = socket; //store socket on global list
					});
				}
				else
				{
					id = res._id;
					console.log('welcome back user: ' + id);
					res.connected = true;
					//join any exitsting Rooms

					for(var i = 0; i < res.rooms.length; i++)
					{
						console.log("joining " + res.rooms[i]);
						socket.join(res.rooms[i]);
					}

					globals.UserData.update( id,{$set: {connected: true}}, {}, function(){
							socket.emit('welcome', res);
					});

					//NB  . overwrites if necessary
					globals.sockets[res._id] = socket; //store socket on global list

				}

			});
		}

	});

	socket.on('update_user', function(msg)
	{
		globals.UserData.update({_id: msg._id},{$set: msg});
	});

	socket.on('splat', function(msg){

		console.log("splat", msg);

		var args = ["pan", msg.splatPan, "rate", msg.splatRate, "pos", msg.splatPos];

		udpPort.send({
				address: "/splat",
				args: args,
		}, "127.0.0.1", 57120);


		globals.display.emit('cmd', {type: "splat", val: msg});

	});

	socket.on('moveBlob', function(msg){

		//TODO OSC to supercollider here
		globals.display.emit('cmd', {type: "moveBlob", val: msg});

	});



	socket.on('disconnect', function()
	{
		console.log('a player disconnected ' + id);
		globals.UserData.update({_id: id},{$set: {connected: false}});
	});

});


//We make the http server listen on port 3000.
http.listen(3000, function(){
	console.log('listening on *:3000');
});
