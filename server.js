var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var rimraf = require('rimraf');

var parseurl = require('parseurl');
var mime = require('mime');
var sharp = require('sharp');

var latestGrab = "";
var latestTime = 0;
var imager = null;
startImager();
var fileDir = __dirname + '/img';
async function startImager() {
	//grab image from camera
	if(imager != null) return;
	var cmd = __dirname+'\\ffmpeg.exe';
	var uniqueName = new Date().getTime();
	var args = [
		'-y', 
		'-f', 'dshow',
		'-rtbufsize', '400M', 
		'-framerate', '30', 
		'-i', 'video=Live Gamer Ultra-Video', 
		'-r', '5', 
		'img\\temp%03d.jpg'
	];
	setInterval(function() {
		fs.readdir(fileDir, function(err, files) {
		  files.forEach(function(file, index) {
			fs.stat(path.join(fileDir, file), function(err, stat) {
			  var endTime, now;
			  if (err) {
				return console.error(err);
			  }
			  now = new Date().getTime();
			  endTime = new Date(stat.ctime).getTime() + 60000;
			  if (now > endTime) {
				return rimraf(path.join(fileDir, file), function(err) {
				  if (err) {
					return console.error(err);
				  }
				});
			  }
			});
		  });
		});
	}, 10000);


	imager = spawn(cmd, args);
	imager.stdout.on('data', function(data) {
		console.log(data);
	});

	imager.stderr.setEncoding("utf8")
	imager.stderr.on('data', function(data) {
		console.log(data);
	});
	imager.on('close', function() { imager = null; startImager() });
	return path;
}
async function grabImg() {
	var newestFile = null, newestTime = 0;
	var files = fs.readdirSync(fileDir);
	for(var i = 0; i < files.length; i++) {
		var file = files[i];
		try {
			var stat = fs.statSync(path.join(fileDir, file));
			var fileTime = new Date(stat.ctime).getTime();
			if(newestFile == null || fileTime > newestTime) {
				newestFile = file;
				newestTime = fileTime;
			}
		} catch(e){}
	}
	
	//get latest file...
	latestGrab = newestFile;
	latestGrab = new Date().getTime();
	return newestFile;
}

app.use(express.static('public'))
//Create image middleware
function serveStaticImg(root, options) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('Bad Root')
  }
  var options = {};
  root = path.resolve(root)
  options.root = root;
  options.extensions = options.extensions
    ? options.extensions
    : ['jpg', 'png'];

  return function expressImage(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next()
    }

    var pathname = path.join(options.root, parseurl(req).pathname);
    var extension = path.extname(pathname).substr(1);
    var params = req.query;

    if (options.extensions.indexOf(extension) === -1) {
      return next(); // cannot handle file 
    }

    res.set('content-type', mime.getType(extension))

    var x = parseInt(params.x);
    var y = parseInt(params.y);
    var width = parseInt(params.w);
    var height = parseInt(params.h);
	
    if (!(x || y)) {
	  res.sendFile(pathname);
	  return; //no parameter, send default
    }
	console.log(x, y, width, height);
	const imageResizer =
		  sharp()
			.extract({left: x, top: y, width: width, height: height})
			.png();
	fs.createReadStream(pathname)
	  .pipe(imageResizer)
	  .pipe(res);
  }
}


app.use('/img', serveStaticImg('img'))
app.use('/ref', serveStaticImg('refs'))


var listeners = io.of('/listener');
var controllers = io.of('/controller');
var realCtrl = null; //we only have one ...
controllers.on('connection', (socket) => {
	console.log("got controller -- setting as master");
	realCtrl = socket;
});

listeners.on('connection', (socket) => {
  console.log('a listener connected!');
  socket.on('getImage', async function(cb) {
	var a = await grabAndUnlink();
	cb({tag: a, time: new Date().getTime()});
  });
  
  socket.on('getLatest', function(cb) {
	  console.log(cb);
	  cb({tag: latestGrab, time: latestTime});
  });
  
  var promiseQueue = [];
  socket.on('control', async function(data, cb) {
	  if(realCtrl == null)
		return;
	var trickleCB = function() {
		  cb();
	};
	if(data.type == 'joy') {
        realCtrl.emit('manipulateJoystick', data.blob, trickleCB);
	} else {
		realCtrl.emit('pressKey', data.blob, trickleCB);
	}
  });
});

http.listen(80, async () => {
  console.log('listening on *:80');
});

var imgLoop = setInterval(async function() {
	var img = await grabImg();
	io.of('/listener').emit('cycleImg', {tag: img, time: new Date().getTime()});
}, 100);

