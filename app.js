var nconf = require('nconf');
var fs = require('fs');

var toobusy = require('toobusy');
var express = require('express');
var routes = require('./routes');
var http = require('http');
// var httpProxy = require('http-proxy');
var path = require('path');

var mongoose = require('mongoose');

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

// var PersonaStrategy = require('passport-persona').Strategy;
// var generatePassword = require('password-generator');

nconf.argv()
    .env()
    .file({ file: 'settings.json' });
    
var app = express();

// all environments
app.set('port', process.env.PORT || 80);

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(function(req, res, next) {
  if (toobusy()) {
    res.send(503, "I'm busy right now, sorry.");
  } else {
    next();
  } 
});

app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('xaifeeK0Xoo1Oghahfu8WeeShooqueeG'));

// app.use(express.session({
//   secret: "xaifeeK0Xoo1Oghahfu8WeeShooqueeG",
//   cookie: {
//     httpOnly: true, 
//     secure: false},
// }));

var sessions = require("client-sessions");
app.use(sessions({
  cookieName: 'haSession', // cookie name dictates the key name added to the request object
  secret: 'ohziuchaepah7xie0vei6Apai8aep4th', // should be a large unguessable string
  duration: 24 * 60 * 60 * 1000, // how long the session will stay valid in ms
  activeDuration: 1000 * 60 * 5 // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
}));

app.use(function(req, res, next) {
  if (req.haSession.seenyou) {
    res.setHeader('X-Seen-You', 'true');
  } else {
    // setting a property will automatically cause a Set-Cookie response
    // to be sent
    req.haSession.seenyou = true;
    res.setHeader('X-Seen-You', 'false');
  }
  res.setHeader('X-Lag', toobusy.lag());
  next();
});
  
app.use(passport.initialize());
app.use(passport.session());

//http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Credentials", "true");
    var oneof = false;
    if(req.headers.origin) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        oneof = true;
    }
    if(req.headers['access-control-request-method']) {
        res.header('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
        oneof = true;
    }
    if(req.headers['access-control-request-headers']) {
        res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
        oneof = true;
    }
    if(oneof) {
        res.header('Access-Control-Max-Age', 60 * 60 * 24 * 365);
    }

    // intercept OPTIONS method
    if (oneof && req.method == 'OPTIONS') {
        res.send(200);
    }
    else {
        next();
    }
});
  
// app.use(allowCrossDomain);  
app.use(app.router);

app.use(require('less-middleware')({ src: __dirname + '/public' }));
// app.use('/dashboard', express.static(path.join(__dirname, 'UI/public')));
app.use(express.static(path.join(__dirname, 'public')));

// var mediaProxy = httpProxy.createServer(80, 'localhost');
// app.use('/proxy', mediaProxy);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}


var Account = require('./models/account');

mongoose.connect(nconf.get('database'));


passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());


// passport.use(new PersonaStrategy({
//     audience: 'https://data.hyperaud.io/',
//     checkAudience: false
//   },
//   function(email, done) {
//       Account.findByUsername(email, function(err, result){
//         if (err) {
//             console.log(err);
//         }
//         if (result) {
//           return done(null, result);
//         } else {
//           var password = generatePassword();
//           console.log("password " + password);
//           Account.register(new Account({
//                 username : email,
//                 email: email
//             }),
//             password, 
//             function(err, account) {
//               if (err) {
//                   console.log(err);
//               }
//               return done(null, account);
//           });
//         }         
//       });
//   }
// ));


app.get('/', routes.index);

app.get('/whoami', function(req, res){
  if (req.isAuthenticated()) {
    res.json({user: req.user});
  } else {
    res.json({user: null});
  }
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.post('/login', passport.authenticate('local'), function(req, res) {
    // res.redirect('/');
    res.json({user: req.user});
});

// app.post('/auth/browserid', passport.authenticate('persona', { failureRedirect: '/login' }), function(req, res) {
//     res.redirect('/');
// });

app.get('/logout', function(req, res){
  req.logout();
  // res.redirect('/');
  res.json({user: null});
});

app.get('/register', function(req, res) {
    res.render('register', {});
});

app.post('/register', function(req, res) {
    Account.register(new Account(
        {
            username : req.body.username
        }),
        req.body.password,
        function(err, account) {
          if (err) {
              return res.render('register', { account : account });
          }
		  if (req.isAuthenticated()) {
		    res.json({user: req.user});
		  } else {
		    res.json({user: null});
		  }
        });
});


require('./media')(app, nconf);
require('./transcripts')(app, nconf);
require('./mixes')(app, nconf);

require('./subscribers')(app, nconf);

// app.use(express.static(path.join(__dirname, 'media')));


var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

process.on('SIGINT', function() {
  server.close();
  // calling .shutdown allows your process to exit normally
  toobusy.shutdown();
  process.exit();
});


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}


