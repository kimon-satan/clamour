
var express = require('express');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
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
		   display.emit('cmd', { type: 'update', id: msg.args[0], val: msg.args[1]});
		}

});

require('./libs/utils.js'); //include the global utils functions

//simple db using monk & mongodb
const url = 'localhost:27017/ConditionalLove';
const monk = require('monk');
const db = monk(url);

db.then(() => {
  console.log('Connected correctly to server')
})

const UserData = db.get('UserData');
const UserGroups = db.get('UserGroups'); //not used so far
const Presets = db.get('Presets'); //not using so far - probably should just be json
const Threads = db.get('Threads'); //This might become a variable ?


const allOptions =
{
    state: 0,
    state_z: 0,
    isSplat: false,
    isMobile: false,
    isDying: false,
    maxState: 2,
    envTime: 8,
    blobSeed: 0.01,
    colSeed: 0.01,
    colMode: 0, //0 -> 3 (int),
    death: 0
}



//check the various collections exist if not create them

Presets.findOne({type: "play", name: "default"}).then((doc)=> {

  if(doc == null)
  {
     console.log("creating default parameters");
     Presets.insert({name: "default", options: allOptions});
  }

});




//We define a route handler / that gets called when we hit our website home.

app.use("/admin",express.static(__dirname + "/admin"));
app.use("/style",express.static(__dirname + "/style"));
app.use("/libs",express.static(__dirname + "/libs"));
app.use("/player",express.static(__dirname + "/player"));
app.use("/display",express.static(__dirname + "/display"));
app.use("/samples",express.static(__dirname + "/samples"));
app.use("/images",express.static(__dirname + "/images"));

//three types of user
 app.get('/admin', function(req, res){
   res.sendFile(__dirname + '/admin/admin.html');
 });
 //
 app.get('/display', function(req, res){
   res.sendFile(__dirname + '/display/display.html');
 });

//
 app.get('/', function(req, res){
   res.sendFile(__dirname + '/player/player.html');
 });


var admin = io.of('/admin');

admin.on('connection', function(socket){

  console.log('an admin connected');

  socket.on('cmd', function(msg)
  {

    //console.log(msg);

    if(msg.cmd == "change_mode")
    {

      parseOptions(msg.args, function(options)
      {

        getThread(msg.args, {id: msg.cli_id, mode: msg.mode, thread: msg.thread}, function(uids){

          options.mode = msg.mode;

          if(uids == null)return;

          uids.forEach(function(e){
            players.to(e).emit('cmd', {cmd: 'change_mode', value: options});
          });


        });

      })

    }
    else if(msg.cmd == "chat_update")
    {
      Threads.find({thread: msg.thread}, 'population').then((docs)=>{

        if(docs == null)return;
        if(docs[0] != undefined)
        {

          docs[0].population.forEach(function(e){
            players.to(e).emit('cmd', {cmd: 'chat_update', value: msg.value});
          });

        }

      });
    }
    else if(msg.cmd == "chat_clear")
    {
      Threads.find({thread: msg.thread}, 'population').then((docs)=>{

        if(docs == null)return;
        if(docs[0] != undefined)
        {

          docs[0].population.forEach(function(e){
            players.to(e).emit('cmd', {cmd: 'chat_clear'});
          });
        }

      });
    }
    else if(msg.cmd == "chat_newline")
    {
      Threads.find({thread: msg.thread}, 'population').then((docs)=>{

        if(docs == null)return;
        if(docs[0] != undefined)
        {

          docs[0].population.forEach(function(e){
            players.to(e).emit('cmd', {cmd: 'chat_newline'});
          });

        }

      });
    }
    else if(msg.cmd == "list_players")
    {
      listPlayers( msg.args, {id: msg.cli_id, mode: msg.mode, thread: msg.thread}, function(r){

          admin.emit('server_report', {id: msg.cli_id, thread: msg.thread, isproc: msg.isproc , msg: r}); //same thread response

      })
    }
    else if(msg.cmd == "list_threads")
    {
      listThreads( msg.args, {id: msg.cli_id, mode: msg.mode, thread: msg.thread}, function(r){

          admin.emit('server_report', {id: msg.cli_id, thread: msg.thread, isproc: msg.isproc , msg: r}); //same thread response

      })
    }
    else if(msg.cmd == "kill_thread")
    {
      Threads.remove({thread: msg.thread},{},function(e,r){
          if(e == null)
          {
            admin.emit('server_report', {id: msg.cli_id , msg: "thread: " +  msg.thread + " removed" });
          }
          else
          {
            admin.emit('server_report', {id: msg.cli_id , msg: "thread: " +  msg.thread + " can't be found" });
          }
      });

      UserData.update({},{$pull: {threads: msg.thread}},{multi: true} );
    }
    else if(msg.cmd == "kill_threads")
    {
      Threads.remove({},{},function(){
        admin.emit('server_report', {id: msg.cli_id , msg: "all threads removed" });
      });

      UserData.update({},{$set: {threads: []}},{multi: true} );
    }
    else if(msg.cmd == "get_threads")
    {
      Threads.find({}).then((docs)=>
      {
        if(docs.length < 1)
        {
          admin.emit('server_report', {id: msg.cli_id, msg: "there are no threads"});
        }
        else
        {
          var res = [];
          for(var i = 0; i < docs.length; i++)
          {
            res.push(docs[i].thread);
          }
          admin.emit('server_report', {id: msg.cli_id, suslist: res, susmode: "thread", selected: msg.thread});
        }

      });
    }
    else if(msg.cmd == "create_thread")
    {
      getThread(msg.args, {id: msg.cli_id, mode: msg.mode, thread: msg.thread}, function(population){});
    }
    else if(msg.cmd == "group")
    {

      if(!msg.args)
      {
        admin.emit('server_report', {id: msg.cli_id, msg: ""});
        return;
      }

      var name = undefined;

      if(msg.args[0].substring(0,1) != "-")
      {
        name = msg.args[0];
        msg.args.splice(0,1);
      }

      if(msg.args[0] == "-d")
      {

        var s_args = {};
        s_args.orig = msg.args[1];
        s_args.numGps = parseInt(msg.args[2]);
        //Meteor.call("createSubGroups", Meteor.user()._id, s_args, function(e,r){cli.cmdReturn(e,r)});

      }
      else if(msg.args[0] == "-r")
      {

        if(name == undefined)
        {
          UserGroups.remove({});
          UserData.update({},{$set: {groups: []}},{multi: true});
          admin.emit('server_report', {id: msg.cli_id, msg: "all groups removed"});
        }
        else
        {
          UserGroups.remove({name: name});
          UserData.update({},{$pull: {groups: name}},{multi: true});
          admin.emit('server_report', {id: msg.cli_id, msg:  name + " removed"});
        }

      }else{

        //remove references to the group in any other players
        UserData.update({},{$pull:{groups: name}},{multi: true}, function(){

          createGroup(name, msg.args, {thread: msg.thread}, function(rsp)
          {
              admin.emit('server_report', {id: msg.cli_id, msg: rsp});
          });
        });


      }
    }
    else if(msg.cmd == "list_groups")
    {
      var results = "";

      UserGroups.find({}).then((docs)=>
      {


        if(docs != null){
          docs.forEach(function(e)
          {

            var str = e.name + " :: " + e.members.length;
            results += str + "\n";

          });

        }

        admin.emit('server_report', {id: msg.cli_id, msg: results});

      });

    }
    else if(msg.cmd == "set_params")
    {
      parseOptions(msg.args, function(options)
      {
        var selector = parseFilters(msg.args, {id: msg.cli_id, mode: msg.mode, thread: msg.thread});

        admin.emit('server_report', {id: msg.cli_id, msg: ""});

        if(selector)
        {

          var searchObj = generateSearchObj(selector);
          selectPlayers(searchObj, function(uids)
          {
            uids.forEach(function(e)
            {
              players.to(e).emit('cmd', {cmd: 'set_params', value: options});
            });
          })

        }else{

          if(msg.thread != undefined)
          {
            Threads.find({thread: msg.thread}, 'population').then((docs)=>{

              if(docs == null)return;
              if(docs[0] != undefined)
              {

                docs[0].population.forEach(function(e){
                  players.to(e).emit('cmd', {cmd: 'set_params', value: options});
                });

              }

            });
          }
        }
      });


    }
    else if(msg.cmd == "cleanup")
    {


        UserData.find({connected: false}).then((docs)=>{
          if(docs == null)return;

          var users = [];

          docs.forEach(function(e){

            UserData.remove(e._id);
            users.push(e._id);

          });
          Threads.update({},{$pull: {population: {$in: users }}}); //remove these users from any threads
                                                                    //TODO remove users from groups too
          admin.emit('server_report', {id: msg.cli_id, msg: docs.length + " disconnected users removed "});
        });

    }
    else if(msg.cmd == "reset_all")
    {
      //clear the Databases
      UserData.remove({});
      Threads.remove({});
      UserGroups.remove({});
      admin.emit('server_report', {id: msg.cli_id, msg: "all databases reset"});
      players.emit('whoareyou'); //causes any connected players to reset
      //TODO display reset
    }
    else if(msg.cmd == "get_stats")
    {

      UserData.find({},'connected').then((docs)=>{

        var resp = "";

        resp += "players: " + docs.length + "\n";

        var numconnected = 0;

        docs.forEach(function(e){
          if(e.connected)numconnected += 1;
        })

        resp += "connected: " + numconnected;

        admin.emit('server_report', {id: msg.cli_id, msg: resp});
      });


    }
    else if(msg.cmd == "start_misty")
    {
      udpPort.send({
          address: "/startMisty",
          args: []
      }, "127.0.0.1", 57120);
      admin.emit('server_report', {id: msg.cli_id});
    }
    else if(msg.cmd == "kill_sound")
    {
      udpPort.send({
          address: "/allOff",
          args: []
      }, "127.0.0.1", 57120);
      admin.emit('server_report', {id: msg.cli_id});
    }
    else if(msg.cmd == "end")
    {
      udpPort.send({
          address: "/allOff",
          args: []
      }, "127.0.0.1", 57120);
      admin.emit('server_report', {id: msg.cli_id});
      display.emit("cmd", {type: "end"});
      players.emit('cmd', {cmd: 'change_mode', value: {mode: "blank"}});

    }


    //console.log('admin command: ' , msg);

  });

  socket.on('disp_cmd', function(msg)
  {

    //console.log(msg);

    if(msg.cmd == "instruct")
    {
      display.emit("cmd", {type: "instruct"});
      admin.emit('server_report', {id: msg.cli_id}); //empty response
    }
    else if(msg.cmd == "display")
    {
      display.emit("cmd", {type: "display"});
      admin.emit('server_report', {id: msg.cli_id}); //empty response
    }
    else if(msg.cmd == "clear_display")
    {
      display.emit("cmd", {type: "clear_display"});
      admin.emit('server_report', {id: msg.cli_id}); //empty response
    }
    else if(msg.cmd == "splat")
    {
      if(msg.args.length > 0)
      {
          var id = msg.args[0];
      }
      else
      {
          var id = generateTempId(5);
      }

      display.emit("cmd", {type: "splat", val: {_id: id,
        colSeed: allOptions.colSeed,
        colMode: allOptions.colMode,
        blobSeed: Math.random(),
        splatPan: (Math.random() * 2.0 - 1.0) * 0.85,
      }});
      admin.emit('server_report', {id: msg.cli_id}); //empty response
    }
    else if(msg.cmd == "dispBlob")
    {
      if(msg.args.length > 0)
      {
          var id = msg.args[0];
      }
      else
      {
          var id = generateTempId(5);
      }

      display.emit("cmd", {type: "blob", val: {_id: id,
        colSeed: Math.random(),
        colMode: Math.floor(Math.random() * 4),
        blobSeed: Math.random()
      }});
      admin.emit('server_report', {id: msg.cli_id}); //empty response
    }

  })

  socket.on('disconnect', function()
  {
    console.log('an admin disconnected');
  });

});

var display = io.of('/display');

display.on('connection', function(socket)
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

    players.to(msg.id).emit('cmd', {cmd: 'set_params', value: {isMobile: true, isSplat: false}});

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
//io is everyone
var players = io.of('/player');

players.on('connection', function(socket)
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
        threads: [],
        groups: []
    }

    Object.keys(allOptions).forEach(function(e){
      usrobj[e] = allOptions[e];
    })

    usrobj.colSeed = Math.random();
    usrobj.colMode = Math.floor(Math.random() * 4);
    usrobj.blobSeed = Math.random();

    if(msg == "new")
    {

      UserData.insert(usrobj,{}, function(err,res)
      {
        if(err) throw err;
        console.log('hello new user: ' + res._id);
        socket.join(res._id);
        id = res._id;
        socket.emit('welcome', res);
      });

    }
    else
    {

      UserData.findOne(msg,{}, function(err,res)
      {
        if(err) throw err;
        if(!res)
        {


          //insert a new user instead
          UserData.insert(usrobj, {}, function(err,res)
          {
            if(err) throw err;
            console.log('hello new user: ' + res._id);
            id = res._id;
            socket.join(res._id);
            socket.emit('welcome', res);
          });
        }
        else
        {

          socket.join(res._id);
          id = res._id;
          console.log('welcome back user: ' + id);
          res.connected = true;
          UserData.update( id,{$set: {connected: true}},{},function(){
              socket.emit('welcome', res);
          });



        }

      });
    }

  });

  socket.on('update_user', function(msg)
  {
    UserData.update({_id: msg._id},{$set: msg});
  });


  socket.on('splat', function(msg){

    console.log("splat", msg);

    var args = ["pan", msg.splatPan, "rate", msg.splatRate, "pos", msg.splatPos];

    udpPort.send({
        address: "/splat",
        args: args,
    }, "127.0.0.1", 57120);


    display.emit('cmd', {type: "splat", val: msg});

  });

  socket.on('moveBlob', function(msg){

    //TODO OSC to supercollider here


    display.emit('cmd', {type: "moveBlob", val: msg});

  });

  socket.on('disconnect', function()
  {
    console.log('a player disconnected ' + id);
    UserData.update({_id: id},{$set: {connected: false}});
  });

});


//We make the http server listen on port 3000.
http.listen(3000, function(){
  console.log('listening on *:3000');
});


//////////////////////HELPER FUNCTIONS/////////////////////////


function listPlayers(args, cli, cb)
{

  var selector = parseFilters(args, cli);
  if(!selector)selector = {};
  var so = generateSearchObj(selector);

  //number filters don't work here

  var results = "";

  UserData.find(so).then((docs)=>
  {

    docs.forEach(function(e)
    {
      var id = String(e._id);
      var str = id.substring(0,3) + "..." + id.substring(id.length -3, id.length) ;
      str += (e.connected) ? " connected " : " dormant ";
      str += ",  mode: " + e.mode;

      if(e.mode == "play")
      {
        str += ", state: " + Math.round((e.state + e.state_z)*100)/100;
        str += ", maxState: " + e.maxState;
        str += ", isSplat: " + e.isSplat;
        str += ", isMobile: " + e.isMobile;
        str += ", isDying: " + e.isDying;
        str += ", death: " + Math.round(e.death * 100)/100;
        str += ", envTime: " + e.envTime;
      }

      results += str + "\n";

    });

    cb(results);

  });
}

function listThreads(args, cli, cb)
{

  var results = "";

  Threads.find({}).then((docs)=>
  {

    docs.forEach(function(e)
    {

      var str = e.thread + " :: " + e.population.length;
      if(e.thread == cli.thread)str += " *";
      if(e.thread == cli.temp_thread)str += " -";

      results += str + "\n";

    });

    cb(results);

  });
}

function selectPlayers(args, cb){

	console.log("selecting players ... ");

	var searchObj = generateSearchObj(args);

	UserData.find(searchObj, '_id').then((docs) => {
  // only the name field will be selected

    var uids = [];

    docs.forEach(function(e)
    {
      uids.push(e._id);
    });

    if(typeof(args.numPlayers) != "undefined"){
      shuffleArray(uids);
      var numPlayers = Math.min(uids.length , args.numPlayers);
      uids = uids.slice(0,numPlayers);
    }

    cb(uids);

  });

}

function addThreadToPlayers(args, cb)
{

		if(typeof(args) == "undefined")return false;

		selectPlayers(args, function(uids){

      var msg =  args.mode + " with " + uids.length + " players with thread: " + args.thread; //this message needs to change

      //this is all a bit messy but it sort of works
      UserData.update({},{$pull:{groups: args.group}},{multi: true}, function(){

        uids.forEach(function(e){

            UserData.update({_id: e},{$push: {threads: args.thread}});

            if(typeof(args.group) != "undefined")
            {
              UserData.update({_id: e},{$push: {groups: args.group}});
            }

        })

      });

  		Threads.insert({thread: args.thread, population: uids},{}, function(){

        if(typeof(args.group) != "undefined")
        {
            UserGroups.update({name: args.group}, {$set: {members: uids}}, {upsert: true});
            msg += "\n these players will now be called " + args.group;
        }
        cb(msg);

      });

    });

};

function createGroup(name, args, cli, cb)
{
  var selector = parseFilters(args, {thread: cli.thread});

  if(!selector && cli.thread){
    selector = { filters: [ { not: false, mode: 'thread', thread: cli.thread } ] } //search for players on the current thread
  }

  selector.group = name;

  if(selector && selector.group){

    selectPlayers(selector, function(uids){

      uids.forEach(function(e)
      {
        UserData.update({_id: e},{$push: {groups: selector.group}});
      });

      UserGroups.update({name: selector.group}, {$set: {members: uids}}, {upsert: true});

      var rsp = uids.length + " players will now be called " + selector.group;
      cb(rsp);

    });


  }else{
    cb("");
  }

}

function getThread(args, cli, send)
{

  var selector = parseFilters(args, cli);

  if(selector)
  {

    selector.thread = generateTempId(5); //needs to be passed back to cli
    selector.mode = cli.mode;

    addThreadToPlayers(selector, function(msg){

      admin.emit('server_report', {msg: msg, id: cli.id, thread: selector.thread });

      Threads.findOne({thread: selector.thread}, 'population').then((docs)=>{
          send(docs.population);
      });

    });

  }else{

    admin.emit('server_report', {id: cli.id, thread: cli.thread}); //same thread response

    Threads.findOne({thread: cli.thread}, 'population').then((docs)=>{
        send(docs.population);
    });

  }
}


function parseFilters(args, cli){

  if(!args)return false;

  //parses a set of selction filters into a mongo selector

  var selector = {};

  for(var i = 0; i < args.length; ){
    if(args[i] == "-f" || args[i] == "-n"){

      if(typeof(selector.filters) == "undefined")selector.filters = [];

      (function(){
        var filter = {};
        filter.not = args[i] == "-n";
        args.splice(i,1);

        switch(args[i]){

          case "thread":
            filter.mode = "thread";
            filter.thread = cli.thread;
          break;

          case "play":
          case "chat":
          case "wait":
          case "broken":
          case "connected":
            filter.mode = args[i];
          break;

          case "state":
          case "envTime":
          case "death":
            filter.mode = args[i];
            args.splice(i, 1);
            filter[filter.mode] = args[i];
          break;

          case "isMobile":
          case "isDying":
          case "isSplat":
            filter.mode = args[i];
            args.splice(i, 1);
            filter[filter.mode] = (args[i] == "T") ? true : false;
          break;


          case undefined:
          break;

          default:

            if(!isNaN(args[i]))
            {
              selector.numPlayers = parseInt(args[i]);
            }
            else
            {
              filter.mode = "group"; //assume it's a group
              filter.group = args[i];
            }
        }


        args.splice(i, 1);
        selector.filters.push(filter);

      })();

    }
    else if(args[i] == "-g")
    {
      args.splice(i,1);
      selector.group = args[i];
      args.splice(i,1);
    }
    else
    {
      //could add parsing text to ignore other arguments
      //assume it's a group and that it exists
      if(typeof(selector.filters) == "undefined")selector.filters = [];
      var filter = {mode: "group", group: args[i]};
      selector.filters.push(filter);
      args.splice(i, 1);
    }
  }

  if(typeof(selector.filters) == "undefined")
  {
      selector = false; //there are no selectors
  }

  return selector;
}


//we don't need this for the moment

function parseOptions(args, cb)
{

  //parses options into an object

  var options = {};

  if(args.length == 0)
  {
    cb(options);
    return;
  }

  i = args.indexOf("-time");

  if(i > -1){
    args.splice(i,1);
    options["time"] = parseInt(args[i]);
    args.splice(i,1);
  }

  //We need the current options for the CLI to do this
  var params = Object.keys(allOptions);

  for(var x = 0; x < params.length; x++)
  {
      i = args.indexOf("-" + params[x]);
      if(i > -1)
      {
        args.splice(i,1);
        if(args[i].substring(0,1) == "[")
        {
          //repackage as an array
          args[i] = args[i].substring(1, args[i].length -1);
          options[params[x]] = args[i].split(",");

        }
        else if(args[i].substring(0,1) == "(")
        {
          //repackage as an object
          args[i] = args[i].substring(1, args[i].length -1);
          var ar = args[i].split(",");
          options[params[x]] = {min: parseFloat(ar[0]), max: parseFloat(ar[1])};
        }
        else
        {
          options[params[x]] = isNumber(args[i]) ? parseFloat(args[i]) : args[i];
          if(options[params[x]] == "T")options[params[x]] = true; //handle booleans
          if(options[params[x]] == "F")options[params[x]] = false;
        }

        args.splice(i,1);

      }
  }

  loadPresets(args, options, function(res)
  {

      //saving presets will go here
      cb(options);

  });

  //saving presets

  // i = args.indexOf("-s");
  //
  // if(i > -1){
  //   args.splice(i,1);
  //   Meteor.call("createPreset", Meteor.user()._id, {type: type, name: args[i], options: options},function(e,r){cli.cmdReturn(e,r)});
  //   args.splice(i,1);
  //
  // }else{
  //   //cli.newCursor();
  // }

  //we need to add code to check current options

  // for(var i in options){
  //   gCurrentOptions[type][i] = options[i]; //copy the changes to current options
  // }



}

function loadPresets(args, options, cb)
{
  var i = args.indexOf("-p");


  if(i > -1)
  {
      args.splice(i,1);

      Presets.findOne({type: type, name: args[i]}).then((doc)=>{

        if(doc)
        {

          var preset = doc.options;
          if(preset)
          {
            for(var x in preset)
            {
              options[x] = preset[x];
            }
          }

        }

        args.splice(i,1);
        loadPresets(args, options, cb);

      });
  }
  else
  {
    cb(options);
  }

}
