// https://gist.github.com/mojodna/1251812

var models = require("../../models");
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var async = require('async');

var generatePostNotification = require('../engine/notifications/generate_post_notifications.js');
var generatePointNotification = require('../engine/notifications/generate_point_notifications.js');
var generateRecommendationEvent = require('../engine/recommendations/events_manager').generateRecommendationEvent;

var ActivityWorker = function () {};

ActivityWorker.prototype.process = function (activityJson, callback) {
  var activity;

  async.series([
    function (seriesCallback) {
      models.AcActivity.find({
        where: { id: activityJson.id },
        include: [
          {
            model: models.User,
            required: true
          },
          {
            model: models.Domain,
            required: true
          },
          {
            model: models.Community,
            required: false
          },
          {
            model: models.Group,
            required: false
          },
          {
            model: models.Post,
            required: false
          },
          {
            model: models.Point,
            required: false,
            include: [
              models.Post
            ]
          }
        ]
      }).then(function (results) {
        if (results) {
          activity = results;
          seriesCallback();
        } else {
          seriesCallback('Activity not found');
        }
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      log.info('Processing Activity Started', {type: activity.type});
      try {
        switch (activity.type) {
          case "activity.password.recovery":
            models.AcNotification.createNotificationFromActivity(activity.actor.user, activity, "notification.password.recovery", 100, function (error) {
              log.info('Processing activity.password.recovery Completed', {type: activity.type, err: error});
              seriesCallback();
            });
            break;
          case "activity.password.changed":
            models.AcNotification.createNotificationFromActivity(activity.actor.user, activity, "notification.password.changed", 100, function (error) {
              log.info('Processing activity.password.changed Completed', {type: activity.type, err: error});
              seriesCallback();
            });
            break;
          case "activity.post.new":
          case "activity.post.opposition.new":
          case "activity.post.endorsement.new":
            generatePostNotification(activity, activity.User, function (error) {
              log.info('Processing activity.post.* Completed', {type: activity.type, err: error});
              seriesCallback();
            });
            break;
          case "activity.point.new":
          case "activity.point.helpful.new":
          case "activity.point.unhelpful.new":
            generatePointNotification(activity, activity.User, function (error) {
              log.info('Processing activity.point.* Completed', {type: activity.type, err: error});
              seriesCallback();
            });
            break;
          default:
            seriesCallback();
        }
      } catch (err) {
        log.error("Processing Activity Error", {err: err});
        seriesCallback();
      }
    },
    function (seriesCallback) {
      generateRecommendationEvent(activity, seriesCallback);
    }
  ], function (error) {
    callback(error);
  });
};

module.exports = new ActivityWorker();
