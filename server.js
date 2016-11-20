/*
TODO

list the current users & their state
//could have a refresh function
... actually just make wait mode send a refreshed record new connections ?
... how to avoid doubling up of signals ?
//mobile test
//probably can move on to integrated verison now

*/

//Express initializes app to be a function handler that you can supply to an HTTP server

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

require('./libs/utils.js'); //include the global utils functions

//simple db using monk & mongodb
const url = 'localhost:27017/ConditionalLove';
const monk = require('monk');
const db = monk(url);

db.then(() => {
  console.log('Connected correctly to server')
})

const UserData = db.get('UserData');
const UserGroups = db.get('UserGroups');
const Presets = db.get('Presets');
const Threads = db.get('Threads');

//check the various collections exist if not create them

Presets.findOne({type: "play", name: "df"}).then((doc)=> {

  if(doc == null)
  {

      console.log("creating play defaults");
      //create one
      var p = {
          state: 0,
          isSplat: false,
          maxState: 5,
          envTime: 8
      }

     Presets.insert({type: "play", name: "df", options: p});
  }

});




//list the users
// users.find({}).then((docs) => {
//
//   console.log(docs);
//
// });
//
// users.remove({}); //clear all the users


//We define a route handler / that gets called when we hit our website home.

app.use("/admin",express.static(__dirname + "/admin"));
app.use("/style",express.static(__dirname + "/style"));
app.use("/libs",express.static(__dirname + "/libs"));
app.use("/player",express.static(__dirname + "/player"));
app.use("/samples",express.static(__dirname + "/samples"));

//two types of user
 app.get('/admin', function(req, res){
   res.sendFile(__dirname + '/admin/admin.html');
 });
//
 app.get('/', function(req, res){
   res.sendFile(__dirname + '/player/player.html');
 });


// var admin = io.of('/admin');
//
// admin.on('connection', function(socket){
//
//   console.log('an admin connected');
//
//   socket.on('command', function(msg)
//   {
//
//     var items = msg.split(" ");
//
//     if(items[0] == "_mode" && msg.length > 1)
//     {
//       players.emit('mode_change', items[1]);
//     }
//     else
//     {
//       players.emit('chat_update', msg);
//     }
//
//     console.log('admin command: ' + msg);
//
//   });
//
//   socket.on('listusers', function(msg)
//   {
//     //admin.emit //a search object which shows all the current users
//   });
//
//   socket.on('disconnect', function()
//   {
//     console.log('an admin disconnected');
//   });
//
// });




//io is everyone
// var players = io.of('/player');
//
// players.on('connection', function(socket)
// {
//
//   console.log('a player connected ' , socket.id);
//
//   socket.on('hello', function(msg)
//   {
//
//     if(msg == "new")
//     {
//       console.log('hello new user');
//       users.insert({currMode: 0, clicks: 0},{}, function(err,res)
//       {
//         if(err) throw err;
//         socket.emit('welcome', res);
//       });
//
//     }
//     else
//     {
//
//       users.findOne(msg,{}, function(err,res)
//       {
//         if(err) throw err;
//         if(!res)
//         {
//           console.log('hello new user');
//           //insert a new user instead
//           users.insert({currMode: 0, clicks: 0},{}, function(err,res)
//           {
//             if(err) throw err;
//             socket.emit('welcome', res);
//           });
//         }
//         else
//         {
//           console.log('welcome back ' + msg);
//           socket.emit('welcome', res);
//         }
//
//       });
//     }
//
//   });
//
//   // generate a new player -somehow get the current mode ?
//
//   socket.on('click', function(msg)
//   {
//     admin.emit('click', msg);
//     users.findOneAndUpdate({_id: monk.id(msg._id)},{$set:{clicks: msg.clicks}});
//   });
//
//   socket.on('changemode', function(msg)
//   {
//     console.log("changemode ", msg);
//     users.findOneAndUpdate({_id: monk.id(msg._id)},{$set:{currMode: msg.currMode}});
//   });
//
//   socket.on('disconnect', function()
//   {
//     console.log('a player disconnected');
//   });
//
//
//
// });


//We make the http server listen on port 3000.
http.listen(3000, function(){
  console.log('listening on *:3000');
});


//////////////////////HELPER FUNCTIONS/////////////////////////

/*cli

.cli_mode
.cli_idx // for callbacks

*/

function permThread(cmd, args, send,  cli){

  //send is the function call to emit

  //disambiguate from temp thread

  var selector = parseFilters(args);

  console.log(selector);

  //var options = parseSuOptions(args, cmd, cli); // we don't need this for the moment

  if(selector){

    selector.thread = generateTempId(5); //needs to be passed back to cli
    selector.mode = cli.cli_mode;

    //add the thread to the new players
    //this implies that players can check the database

  //   Meteor.call("addThreadToPlayers", Meteor.user()._id, selector,
  //     function(e, r){
  // //only make the call once the thread has been added,
  //       if(!e){
  //
  //         send(options, cli.thread);
  //         cli.println(r);
  //
  //       }else{
  //         cli.println(e.reason);
  //       }
  //       cli.newCursor();
  //     }
  //   );
  }else{

    var thread = generateTempId(5);
    send(options, thread);

    //TO DO add an extra option for reset here ... perhaps just the same as instant ??
    //cli.newCursor(); //needs a socket emit here
  }
}


function parseFilters(args){

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
            filter.mode = "play";
          break;

          case "chat":
            filter.mode = "chat";
          break;

          case "state":
            filter.mode = "state";
            args.splice(i, 1);
            filter.state = args[i];
          break;

          default:
            if(!isNaN(args[i]))
            {
              selector.numPlayers = parseInt(args[i]);
            }else {
              UserGroups.findOne({name: args[i]}).then((doc) => {
                if(doc != null)
                {
                  filter.mode = "group";
                  filter.group = args[i];
                }
              })
            }

        }

        args.splice(i, 1);
        selector.filters.push(filter);

      })();

    }else if(args[i] == "-g"){

      args.splice(i,1);
      selector.group = args[i];
      args.splice(i,1);

    }else {
      UserGroups.findOne({name: args[i]}).then((doc) => {
        if(doc != null)
        {
          if(typeof(selector.filters) == "undefined")selector.filters = [];
          var filter = {mode: "group", group: args[i]};
          selector.filters.push(filter);
          args.splice(i, 1);
        }
        else {
          i++;
        }
      })
    }
  }

  if(typeof(selector.filters) == "undefined")selector = false; //there are no selectors

  return selector;
}


//we don't need this for the moment

// function parseSuOptions(args, type, cli){
//
//
//   //parses options into an object
//
//   var options = {};
//
//   if(args.length == 0){
//     return options;
//   }
//
//   var i = args.indexOf("-p");
//
//   while(i > -1){
//       args.splice(i,1);
//       var preset = Presets.findOne({type: type, name: args[i]}).options;
//       if(preset){
//         for(var x in preset){
//           options[x] = preset[x];
//         }
//       }
//       args.splice(i,1);
//       i = args.indexOf("-p");
//   }
//
//
//   i = args.indexOf("-time");
//
//   if(i > -1){
//     args.splice(i,1);
//     options["time"] = parseInt(args[i]);
//     args.splice(i,1);
//   }
//
//
//
//   var params = Object.keys(gCurrentOptions[type]);
//
//   for(var x = 0; x < params.length; x++){
//       i = args.indexOf("-" + params[x]);
//       if(i > -1){
//         args.splice(i,1);
//         if(args[i].substring(0,1) == "["){
//           //repackage as an array
//           args[i] = args[i].substring(1, args[i].length -1);
//           options[params[x]] = args[i].split(",");
//
//         }else if(args[i].substring(0,1) == "("){
//           //repackage as an object
//           args[i] = args[i].substring(1, args[i].length -1);
//           var ar = args[i].split(",");
//           options[params[x]] = {min: parseFloat(ar[0]), max: parseFloat(ar[1])};
//
//
//         }else{
//           options[params[x]] = isNumber(args[i]) ? parseFloat(args[i]) : args[i];
//           if(options[params[x]] == "T")options[params[x]] = true; //handle booleans
//           if(options[params[x]] == "F")options[params[x]] = false;
//         }
//
//         args.splice(i,1);
//       }
//   }
//
//   i = args.indexOf("-s");
//
//   if(i > -1){
//     args.splice(i,1);
//     Meteor.call("createPreset", Meteor.user()._id, {type: type, name: args[i], options: options},function(e,r){cli.cmdReturn(e,r)});
//     args.splice(i,1);
//
//   }else{
//     //cli.newCursor();
//   }
//
//   for(var i in options){
//     gCurrentOptions[type][i] = options[i]; //copy the changes to current options
//   }
//
//   return options;
//
//
// }
