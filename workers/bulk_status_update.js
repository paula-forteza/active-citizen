// https://gist.github.com/mojodna/1251812
var async = require("async");
var models = require("../../models");
var log = require('../utils/logger');
var queue = require('./queue');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');
var airbrake = require('../utils/airbrake');
var _ = required('lodash');

var BulkStatusUpdateWorker = function () {};

var movePostToGroupId = function (postId, toGroupId, done) {
  var group, post, communityId, domainId;
  async.series([
    function (callback) {
      models.Group.find({
        where: {
          id: toGroupId
        },
        include: [
          {
            model: models.Community,
            required: true,
            include: [
              {
                model: models.Domain,
                required: true
              }
            ]
          }
        ]
      }).then(function (groupIn) {
        group = groupIn;
        communityId = group.Community.id;
        domainId = group.Community.Domain.id;
        callback();
      }).catch(function (error) {
        callback(error);
      });
    },
    function (callback) {
      models.Post.find({
        where: {
          id: postid
        }
      }).then(function (postIn) {
        post = postIn;
        post.set('group_id', group.id);
        post.save().then(function (results) {
          console.log("Have changed group id");
          callback();
        });
      }).catch(function (error) {
        callback(error);
      });
    },
    function (callback) {
      models.AcActivity.findAll({
        where: {
          post_id: post.id
        }
      }).then(function (activities) {
        async.eachSeries(activities, function (activity, innerSeriesCallback) {
          activity.set('group_id', group.id);
          activity.set('community_id', communityId);
          activity.set('domain_id', domainId);
          activity.save().then(function (results) {
            console.log("Have changed group and all: "+activity.id);
            innerSeriesCallback();
          });
        }, function (error) {
          callback();
        })
      }).catch(function (error) {
        callback(error);
      });
    }
  ], function (error) {
    if (error) {
      done(error)
    } else {
      log.info("Moved post to group", { postId: post.id, groupId: group.id });
      done();
    }
  });
};

var createStatusUpdateForPostId = function(postId, official_status, content, callback) {
  models.Post.find({
    where: {
      id: postId
    },
    include: [
      {
        model: models.Group,
        required: true,
        attributes: ['id'],
        include: [
          {
            model: models.Community,
            required: true,
            attributes: ['id'],
            include: [
              {
                model: models.Domain,
                required: true,
                attributes: ['id']
              }
            ]
          }
        ]
      }
    ]
  }).then(function (post) {
    if (post) {
      models.PostStatusChange.build({
        post_id: post.id,
        status_changed_to: post.official_status != parseInt(official_status) ? official_status : null,
        content: content,
        user_id: req.user.id,
        status: 'active',
        user_agent: req.useragent.source,
        ip_address: req.clientIp
      }).save().then(function (post_status_change) {
        if (post_status_change) {
          models.AcActivity.createActivity({
            type: 'activity.post.status.change',
            userId: req.user.id,
            postId: post.id,
            object: { bulkStatusUpdate: true },
            postStatusChangeId: post_status_change.id,
            groupId: post.Group.id,
            communityId: post.Group.Community.id,
            domainId: post.Group.Community.Domain.id
          }, function (error) {
            if (error) {
              log.error("Post Status Change Error", {
                context: 'status_change',
                post: toJson(post),
                user: toJson(req.user),
                err: error
              });
              callback("Post Status Change Error");
            } else {
              if (post.official_status != parseInt(official_status)) {
                post.official_status = official_status;
                post.save().then(function (results) {
                  log.info('Post Status Change Created And New Status', {
                    post: toJson(post),
                    context: 'status_change',
                    user: toJson(req.user)
                  });
                  callback();
                });
              } else {
                log.info('Post Status Change Created', {
                  post: toJson(post),
                  context: 'status_change',
                  user: toJson(req.user)
                });
                callback();
              }
            }
          });
        } else {
          log.error("Post Status Change Error", {
            context: 'status_change',
            post: toJson(post),
            user: toJson(req.user),
            err: "Could not created status change"
          });
          callback("Post Status Change Error")
        }
      }).catch(function (error) {
        log.error("Post Status Change Error", {
          context: 'status_change',
          post: toJson(post),
          user: toJson(req.user),
          err: error
        });
        callback("Post Status Change Error")
      });
    } else {
      log.error("Post Status Change Post Not Found", {
        context: 'status_change',
        postId: req.params.id,
        user: toJson(req.user),
        err: "Could not created status change"
      });
      callback("404");
    }
  }).catch(function (error) {
    callback(error);
  });
};

var getAllUsersWithEndorsements = function (config, callback) {
  var allPostIds = [];
  var allUsers = [];
  _.each(config.groups, function (group) {
    _.each(group.posts, function (post) {
      allPostIds.push(post.id);
    });
  });

  async.eachSeries(allPostIds, function (postId, seriesCallback) {
    models.Endorsement.findAll({
      where: {
        post_id: postId
      },
      include: [
        models.User
      ]
    }).then(function (endorsements) {
      _.each(endorsements, function (endorsement) {
        allUsers.push(endorsement.User);
        seriesCallback();
      });
    }).catch(function (error) {
      seriesCallback(error);
    });
  }, function (error) {
    allUsers = _.uniqBy(allUsers, function (user) {
      return user.id;
    });
    callback(error, allUsers);
  });
};

var changeStatusOfAllPost = function (config, callback) {
  var allPosts = [];
  _.each(config.groups, function (group) {
    _.each(group.posts, function (post) {
      allPosts.push(post);
    });
  });
  async.eachSeries(allPosts, function (configPost, seriesCallback) {
    models.Post.find({
      where: {
        id: configPost.id
      },
      include: [
        models.User
      ]
    }).then(function (dbPost) {
      if (configPost.changeStatusTo) {
        var statusMessage;
        if (configPost.templateName) {
          statusMessage = config.templates[configPost.templateName].content;
        } else if (configPost.customMessage) {
          statusMessage = configPost.customMessage;
        }
        createStatusUpdateForPostId(configPost.id, configPost.changeStatusTo, statusMessage, seriesCallback);
      } else {
        seriesCallback();
      }
    }).catch(function (error) {
      seriesCallback(error);
    });
  }, function (error) {
    callback(error);
  });
};

var moveNeededPosts = function (config, callback) {
  async.eachSeries(config.groups, function (configGroup, groupSeriesCallback) {
    async.eachSeries(configGroup, function (configPost, postSeriesCallback) {
      models.Post.find({
        where: {
          id: configPost.id
        },
        include: [
          models.User
        ]
      }).then(function (dbPost) {
        if (configPost.moveToGroupId) {
          movePostToGroupId(dbPost.id, moveToGroupId, postSeriesCallback);
        } else {
          postSeriesCallback();
        }
      }).catch(function (error) {
        postSeriesCallback(error);
      });
    }, function (error) {
      groupSeriesCallback(error, allUsers);
    });
  }, function (error) {
    callback(error);
  });
};

BulkStatusUpdateWorker.prototype.process = function (bulkStatusUpdateId, callback) {
  var statusUpdate;
  var allUsersWithEndorsements;
  var allSuccessful, allFailed, allInProgress, allOpen;
  var allMoved;

  async.series([
    // Get Bulk Status Update
    function(seriesCallback){
      models.BulkStatusUpdate.find({
        where: { id: bulkStatusUpdateId },
        include: [
          {
            model: models.Community,
            required: true
          },
          {
            model: models.User,
            required: true
          }
        ]
      }).then(function(results) {
        log.info("BulkStatusUpdateWorker Debug 1", {results: results.dataValues});
        if (results) {
          //
          seriesCallback();
        } else {
          seriesCallback('BulkStatusUpdateWorker Update not found');
        }
      }).catch(function(error) {
        seriesCallback(error);
      });
    },
    // Get All Users With Endorsements
    function(seriesCallback){
      if (notification.user_id) {
        models.User.find({
          where: { id: notification.user_id },
          attributes: ['id','notifications_settings','email','name','created_at']
        }).then(function(userResults) {
          if (userResults) {
            log.info("BulkStatusUpdateWorker Debug 5", {userResults: userResults.dataValues});
            user = userResults;
            seriesCallback();
          } else {
            if (notification.AcActivities[0].object.email) {
              log.info("BulkStatusUpdateWorker Debug 5.5", {});
              seriesCallback();
            } else {
              seriesCallback('User not found');
            }
          }
        }).catch(function(error) {
          seriesCallback(error);
        });
      } else {
        seriesCallback();
      }
    },
    // Sort all posts into buckets
    function(seriesCallback){
      seriesCallback();
    },
    // Do status changes for all posts
    function(seriesCallback){
      seriesCallback();
    },
    // Move all posts
    function(seriesCallback){
      seriesCallback();
    },
    // Loop through users and send one email to each
    function(seriesCallback){
      seriesCallback();
    }

    ],
  function(error) {
    if (error) {
      if (error.stack)
        log.error("BulkStatusUpdateWorker Error", {err: error, stack: error.stack.split("\n") });
      else
        log.error("BulkStatusUpdateWorker Error", {err: error });

      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr });
        }
        callback(error);
      });
    } else {
      log.info('Processing BulkStatusUpdateWorker Started', { type: notification.type, user: user ? user.simple() : null });
    }
  });
};

module.exports = new BulkStatusUpdateWorker();
