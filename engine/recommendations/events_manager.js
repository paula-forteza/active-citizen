var predictionio = require('./predictionio-driver');
var models = require('../../../models');
var _ = require('lodash');
var async = require('async');
var log = require('../../utils/logger');
var engine = new predictionio.Engine();

var getClient = function (appId) {
  return new predictionio.Events({appId: appId});
};

var convertToString = function(integer) {
  return integer.toString();
};

var getPost = function (postId, callback) {
  models.Post.find(
    {
      where: {
        id: postId,
        status: 'published'
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
        properties = _.merge(properties,
          {
            category: [ convertToString(post.category_id) ]
          });
      }
      properties = _.merge(properties,
        {
          domain: [ convertToString(post.Group.Community.Domain.id) ],
          community: [ convertToString(post.Group.Community.id) ],
          group: [ convertToString(post.Group.id) ],
          groupAccess: [ convertToString(post.Group.access) ],
          groupStatus: [ convertToString(post.Group.status) ],
          communityAccess: [ convertToString(post.Group.access) ],
          status: [ post.status ],
          official_status: [ convertToString(post.official_status) ]
        });

      properties = _.merge(properties,
        {
          date: post.created_at.toISOString()
        }
      );

      client.createItem({
        entityId: post.id,
        properties: properties,
        date: post.created_at.toISOString(),
        eventDate: post.created_at.toISOString()
      }).then(function (result) {
        log.info('Events Manager createItem', {postId: post.id, result: result});
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
        date: date,
        eventDate: date
      }).then(function (result) {
        log.info('Events Manager createAction', {postId: targetEntityId, userId: userId, result: result});
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

var createUser = function (user, callback) {
  client = getClient(1);
  client.createUser( {
    appId: 1,
    uid: user.id,
    eventDate: user.created_at.toISOString()
  }).then(function(result) {
    console.log(result);
    callback();
  }).catch(function(error) {
    console.error(error);
    callback(error);
  });
};

var generateRecommendationEvent = function (activity, callback) {
  log.info('Events Manager generateRecommendationEvent', {type: activity.type, userId: activity.user_id });
  switch (activity.type) {
    case "activity.user.new":
      createUser(activity.User, callback);
      break;
    case "activity.post.new":
      createItem(activity.Post.id, callback);
      break;
    case "activity.post.endorsement.new":
      createAction(activity.Post.id, activity.user_id, activity.created_at.toISOString(), 'endorse', callback);
      break;
    case "activity.post.opposition.new":
      createAction(activity.Post.id, activity.user_id, activity.created_at.toISOString(), 'oppose', callback);
      break;
    case "activity.point.new":
      if (activity.Point.value==0) {
        createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-comment-new', callback);
      } else {
        createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-new', callback);
      }
      break;
    case "activity.point.helpful.new":
      createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-helpful', callback);
      break;
    case "activity.point.unhelpful.new":
      createAction(activity.Point.Post.id, activity.user_id, activity.created_at.toISOString(), 'point-unhelpful', callback);
      break;
    default:
      callback();
  }
};

var getRecommendationFor = function (user, dateRange, options, callback) {
  var fields = [];

  fields.push({
    name: 'status',
    domain: ['published'],
    bias: -1
  });

  if (options.domain_id) {
    fields.push({
      name: 'domain',
      values: [ options.domain_id ],
      bias: -1
    });
  }

  if (options.community_id) {
    fields.push({
      name: 'community',
      values: [ options.community_id ],
      bias: -1
    });
  }

  if (options.group_id) {
    fields.push({
      name: 'group',
      values: [ options.group_id ],
      bias: -1
    });
  }

  engine.sendQuery({
    user: user.id,
    num: options.limit || 10,
    fields: fields,
    dateRange: dateRange
  }).then(function (results) {
    callback(null, _.map(results, function(item) { return item.item; }));
  }).catch(function (error) {
    callback(error);
  });
};

isItemRecommended = function (itemId, user, dateRange, options, callback) {
  getRecommendationFor(user, dateRange, options, function (error, items) {
    if (error) {
      log.error("Recommendation Events Manager Error", { err: error });
      callback(false);
    } else {
      callback(_.includes(items, itemId));
    }
  });
};

module.exports = {
  generateRecommendationEvent: generateRecommendationEvent,
  getRecommendationFor: getRecommendationFor,
  isItemRecommended: isItemRecommended
};