//Express initializes app to be a function handler that you can supply to an HTTP server

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var mongo = require('mongodb').MongoClient
var url = 'mongodb://localhost:27017/mongoTesting';

mongo.connect( url, function (err, db) {

  if (err) throw err;

  var users = db.collection('usercollection');
  users.find().toArray(function (err, result) {
    if (err) throw err
    console.log(result);
  })
  db.close();

})

//We define a route handler / that gets called when we hit our website home.

app.use("/scripts",express.static(__dirname + "/scripts"));
app.use("/style",express.static(__dirname + "/style"));
app.use("/libs",express.static(__dirname + "/libs"));
app.use("/samples",express.static(__dirname + "/samples"));

//two types of user
 app.get('/admin', function(req, res){
   res.sendFile(__dirname + '/admin.html');
 });
//
 app.get('/', function(req, res){
   res.sendFile(__dirname + '/index.html');
 });


var admin = io.of('/admin');

admin.on('connection', function(socket){

  console.log('an admin connected');

  socket.on('command', function(msg)
  {

    var items = msg.split(" ");

    if(items[0] == "_mode" && msg.length > 1)
    {
      players.emit('mode_change', items[1]);
    }
    else
    {
      players.emit('chat_update', msg);
    }

    console.log('admin command: ' + msg);

  });

  socket.on('disconnect', function()
  {
    console.log('an admin disconnected');
  });

});




//io is everyone
var players = io.of('/player');

players.on('connection', function(socket)
{

  console.log('a player connected');

  socket.on('hello', function(msg)
  {
    admin.emit('click', msg);
  });

  socket.on('disconnect', function()
  {
    console.log('a player disconnected');
  });



});


//We make the http server listen on port 3000.
http.listen(3000, function(){
  console.log('listening on *:3000');
});
