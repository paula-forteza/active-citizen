var predictionio = require('./predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var engine = new predictionio.Engine({url: 'http://ac:8000'});

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

models.User.find({ where: {email:'robert.bjarnason@gmail.com'}}).then(function (user) {
  engine.sendQuery({
    uid: user.id,
    user: user.id,
    n: 1,
    fields: [
    {
      name: "domain",
      values: [1],
      bias: -1
    }]/*,
    dateRange: {
      name: "availabledate",
      before: "2012-08-15T11:28:45.114-07:00",
      after: "2010-08-20T11:28:45.114-07:00"
    }*/
  }).
  then(function (results) {
    console.log(results);
    var array = [];
    async.eachSeries(results.itemScores, function (item, callback) {
      console.log("ITEM");
      console.log(item.item);
      models.Post.find({where:{ id: item.item }}).then(function(post) {
        console.log(post.name);
        console.log(post.status);
        callback();
      });
    }, function () {
      getClient(1).getEvents({itemId: '2160'}).then(function(events) {
        console.log(events);
        _(events).forEach(function(event) {
          if (event.properties) {
            if (event.properties.community) {
              console.log("COMMUNITY COMMUNITY: ");
              console.log(event.properties.community);
            }
          }
        });
        callback();
      }).catch(function (error) {
        console.log("error");
        console.log(error);
        callback();
      });
    })
  });
});

