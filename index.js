//Express initializes app to be a function handler that you can supply to an HTTP server

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//We define a route handler / that gets called when we hit our website home.

app.use("/scripts",express.static(__dirname + "/scripts"));
app.use("/style",express.static(__dirname + "/style"));
app.use("/libs",express.static(__dirname + "/libs"));

//two types of user
 app.get('/admin', function(req, res){
   res.sendFile(__dirname + '/admin.html');
 });
//
 app.get('/', function(req, res){
   res.sendFile(__dirname + '/index.html');
 });


//io is everyone
//socket is this user

io.on('connection', function(socket)
{

  console.log('a user connected');

  socket.on('command', function(msg)
  {

    var items = msg.split(" ");

    if(items[0] == "_mode" && msg.length > 1)
    {
      socket.broadcast.emit('mode_change', items[1]);
    }
    else
    {
      socket.broadcast.emit('chat_update', msg);
    }

    console.log('command: ' + msg);

  });

  socket.on('hello', function(msg)
  {
    console.log(msg);
  });

  socket.on('disconnect', function()
  {
    console.log('user disconnected');
  });

});

//We make the http server listen on port 3000.
http.listen(3000, function(){
  console.log('listening on *:3000');
});
