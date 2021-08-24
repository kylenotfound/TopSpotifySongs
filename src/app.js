require('dotenv').config()

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const { connected, nextTick } = require('process');

var client_id = process.env.SPOTIFY_CLIENT_ID; 
var client_secret = process.env.SPOTIFY_CLIENT_SECRET; 
var redirect_uri = process.env.SPOTIFY_REDIRECT_URI; 

var user_range;
var user_limit;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();
app.set('view engine', 'pug');

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {
  user_limit = req.query.limit;
  user_range = req.query.range;
  if(user_limit == null){
    user_limit = 10;
  } else if (user_limit > 50){
    user_limit = 50;
  }
  if(user_range == null){
    user_range = "long_term";
  }
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var user_url = 'https://api.spotify.com/v1/me/top/tracks?time_range='+user_range+'&limit='+user_limit;
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: user_url,
          headers: { 'Authorization': 'Bearer ' + access_token },
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          if(body != null){
            let data = JSON.parse(body);
            if(data.items[0] != null){
              var songs_list = [];
              for(var i = 0; i < user_limit; i++){
                var output = data.items[i].artists[0].name + ": " + data.items[i].name;
                songs_list.push(output);
                console.log(output);
              }
              res.render('index.pug', {
                'songs_list': songs_list
              });
            }
          }
        });
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          })
        );
      }
    });
  }

});

console.log('Listening on 8888');
app.listen(8888);

