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

//simple db using monk & mongodb
const url = 'localhost:27017/ConditionalLove';
const monk = require('monk');
const db = monk(url);

db.then(() => {
  console.log('Connected correctly to server')
})

const UserData = db.get('UserData');
const UserData = db.get('UserGroups');
const Presets = db.get('Presets');
const Threads = db.get('Threads');

//list the users
users.find({}).then((docs) => {

  console.log(docs);

});

users.remove({}); //clear all the users


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
