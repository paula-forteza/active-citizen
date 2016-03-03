var predictionio = require('./predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var engine = new predictionio.Engine({url: 'http://localhost:8000'});

models.User.find({ where: {email:'robert.bjarnason@gmail.com'}}).then(function (user) {
  engine.sendQuery({
    uid: user.id,
    n: 1
  }).
  then(function (result) {
    console.log(result);
  });
});


