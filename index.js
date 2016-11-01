//Express initializes app to be a function handler that you can supply to an HTTP server
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//We define a route handler / that gets called when we hit our website home.
app.get('/hello', function(req, res){
  res.send('<h1>Hello world</h1>');
});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  console.log('a user connected');

  socket.on('chat message', function(msg){
    io.emit('chat message', msg);
    console.log('message: ' + msg);
  });

  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

//We make the http server listen on port 3000.
http.listen(3000, function(){
  console.log('listening on *:3000');
});
