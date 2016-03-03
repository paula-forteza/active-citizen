var predictionio = require('./predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

var getPost = function (postId, callback) {
  models.Post.find(
    {
      where: {
        id: postId
      },
      include: [
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
    }).then(function (post) {
    if (post) {
      callback(post)
    } else {
      callback(null);
    }
  });
};

var createItem = function (postId, callback) {
  client = getClient(1);
  getPost(postId, function (post) {
    if (post) {
      var properties = {};

      if (post.category_id) {
        properties = _merge(properties,
          {
            category: [post.category_id]
          });
      }
      properties = _merge(properties,
        {
          domain: [post.Group.Community.Domain.id],
          community: [post.Group.Community.id],
          group: [post.Group.id]
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
      }).then(function (result) {
        console.log(result);
        callback();
      }).catch(function (error) {
        console.error(error);
        callback();
      });
    } else {
      console.log("Could not find post");
      callback();
    }
  })
};

var createAction = function (targetEntityId, userId, date, action, callback) {
  client = getClient(1);

  getPost(targetEntityId, function (post) {
    if (post) {
      client.createAction({
        event: action,
        uid: userId,
        targetEntityId: targetEntityId,
        date: object.created_at.toISOString()
      }).then(function (result) {
        console.log(result);
        callback();
      }).catch(function (error) {
        console.error(error);
        callback(error);
      });
    } else {
      console.log("Could not find post");
      callback();
    }
  });
};

var createUser = function (userId, callback) {
  client = getClient(1);

  client.createUser( {
    appId: 1,
    uid: userId
  }).then(function(result) {
    console.log(result);
    callback();
  }).catch(function(error) {
    console.error(error);
    callback(error);
  });
};

var generateRecommendationEvent = function (activity, callback) {
  switch (activity.type) {
    case "activity.user.new":
      createAction(activity.user_id, callback);
      break;
    case "activity.post.new":
      createAction(activity.Post.id, callback);
      break;
    case "activity.post.endorsement.new":
      createAction(activity.Post.id, activity.user_id, activity.created_at.toISOString(), 'endorse', callback);
      break;
    case "activity.post.opposition.new":
      createAction(activity.Post.id, activity.user_id, activity.created_at.toISOString(), 'oppose', callback);
      break;
    case "activity.point.new":
      if (activity.Point.value==0) {
        createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point_comment_new', callback);
      } else {
        createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point_new', callback);
      }
      break;
    case "activity.point.helpful.new":
      createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point_helpful', callback);
      break;
    case "activity.point.unhelpful.new":
      createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point_unhelpful', callback);
      break;
    default:
      callback();
  }
};

module.exports = {
  generateRecommendationEvent: generateRecommendationEvent
};