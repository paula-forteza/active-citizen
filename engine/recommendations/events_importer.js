var predictionio = require('./predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

var importAllUsers = function (done) {
  var client = getClient(1);

  models.User.findAll().then(function (users) {
    async.eachSeries(users, function (user, callback) {
      client.createUser( {
        appId: 1,
        uid: user.id
      }).then(function(result) {
        console.log(result);
        callback();
      }).catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("FIN");
      done();
    });
  });
};

var importAllPosts = function (done) {
  var client = getClient(1);

  models.Post.findAll(
    {
      where: {
        status: 'published'
      },
      include: [
        {
          model: models.Point,
          required: false,
          where: {
            status: 'published'
          }
        },
        {
          model: models.Category,
          required: false
        },
        {
          model: models.Group,
          required: true,
          where: {
            access: models.Group.ACCESS_PUBLIC
          },
          include: [
            {
              model: models.Community,
              required: true,
              where: {
                access: models.Community.ACCESS_PUBLIC
              },
              include: [
                {
                  model: models.Domain,
                  required: true
                }
              ]
            }
          ]
        }
      ]
    }).then(function (posts) {
    async.eachSeries(posts, function (post, callback) {

      var properties = {};

      if (post.category_id) {
        properties = _merge(properties,
          {
            category: [ post.category_id ]
          });
      }
      properties = _merge(properties,
        {
          domain: [ post.Group.Community.Domain.id ],
          community: [ post.Group.Community.id ],
          group: [ post.Group.id ]
        });

      properties = _merge(properties,
        {
          availableDate: post.created_at.toISOString(),
          date: post.created_at.toISOString(),
          expireDate: new Date("April 1, 3016 04:20:00")
        }
      );

      client.createItem({
        entityId: post.id,
        properties: properties
      }).then(function(result) {
        console.log(result);
        callback();
      }).catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("FIN");
      done();
    });
  });
};

var importAllActionsFor = function (model, where, include, action, done) {
  var client = getClient(1);

  model.findAll(
    {
      where: where,
      include: include
    }
  ).then(function (objects) {
    async.eachSeries(objects, function (object, callback) {
      var targetEntityId;
      if (action.indexOf('help') > -1) {
        targetEntityId = object.Point.Post.id;
      } else if (action.indexOf('post') > -1) {
        targetEntityId = object.id;
      } else {
        targetEntityId = object.Post.id;
      }
      console.log(targetEntityId);
      client.createAction({
        event: action,
        uid: object.user_id,
        targetEntityId: targetEntityId,
        date: object.created_at.toISOString()
      }).then(function(result) {
        console.log(result);
        callback();
      }).
      catch(function(error) {
        console.error(error);
        callback();
      });
    }, function (error) {
      console.log(error);
      console.log("FIN");
      done();
    });
  });
};

var importAll = function(done) {
  async.series([
    function(callback){
      importAllUsers(function () {
        callback();
      });
    },
    function(callback){
      importAllPosts(function () {
        callback();
      });
    },
    function(callback){

      importAllActionsFor(models.Endorsement, { value: { $gt: 0 } }, [ models.Post ], 'endorse', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Endorsement, { value: { $lt: 0 } }, [ models.Post ], 'oppose', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Post, {}, [], 'new_post', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Point, { value: { $ne: 0 }}, [ models.Post ], 'new_point', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.Point, [ models.Post ], { value: 0 }, 'new_point_comment', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.PointQuality,  [{
          model: models.Point,
          include: [ models.Post ]
        }], { value: { $gt: 0 } }, 'point_helpful', function () {
        callback();
      });
    },
    function(callback){
      importAllActionsFor(models.PointQuality,  [{
        model: models.Point,
        include: [ models.Post ]
      }], { value: { $lt: 0 } }, 'point_unhelpful', function () {
        callback();
      });
    }
  ], function () {
    console.log("FIN");
    done();
  });
};

getClient(1).status().then(function(status) {
  console.log("status");
  console.log(status); // Prints "{status: 'alive'}"
  /*importAllUsers(function () {
    console.log("DONE");
  });
  importAllPosts(function () {
   console.log("DONE");
   });*/
  importAllActionsFor(models.Endorsement, { value: { $gt: 0 } }, [ models.Post ], 'endorse', function () {
    callback();
  });
}).catch(function (error) {
  console.log("error");
  console.log(error);
});
