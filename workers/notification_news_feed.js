// https://gist.github.com/mojodna/1251812
var async = require("async");
var models = require("../../models");
var log = require('../utils/logger');
var queue = require('./queue');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');

var NewsFeedNotificationsFilter = require('../engine/filters/news_feed_notifications.js');

var NotificationNewsFeedWorker = function () {};

NotificationNewsFeedWorker.prototype.process = function (notificationJson, callback) {
  try {
    var user;
    var notification;
    var domain;
    var community;

    async.series([
      function(callback){
        models.AcNotification.find({
          where: { id: notificationJson.id },
          order: [
            [ { model: models.AcActivity } ,'updated_at', 'asc' ]
          ],
          include: [
            {
              model: models.AcActivity,
              as: 'AcActivities',
              required: true,
              include: [
                {
                  model: models.User,
                  required: true
                },
                {
                  model: models.Domain,
                  required: false
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
                  required: false
                }
              ]
            }
          ]
        }).then(function(results) {
          if (results) {
            notification = results;
            domain = notification.AcActivities[0].Domain;
            community = notification.AcActivities[0].Community;
            callback();
          } else {
            callback('Notification not found');
          }
        }).catch(function(error) {
          callback(error);
        });
      },
      function(callback){
        models.User.find({
          where: { id: notification.user_id }
        }).then(function(userResults) {
          if (userResults) {
            user = userResults;
            callback();
          } else {
            callback('User not found');
          }
        }).catch(function(error) {
          callback(error);
        });
      },
      function(callback){
        user.setLocale(i18n, domain, community, function () {
          callback();
        });
      }
    ],
    function(error) {
      if (error) {
        log.error("NotificationNewsFeedWorker Error", {err: error});
        callback();
      } else {
        log.info('Processing NotificationNewsFeedWorker Started', { type: notification.type, user: user });
        switch(notification.type) {
          case "notification.post.new":
          case "notification.post.endorsement":
          case "notification.point.new":
          case "notification.point.quality":
            NewsFeedNotificationsFilter(notification, user, function () {
              log.info('Processing notification.* Completed', { type: notification.type, user: user });
              callback();
            });
            break;
          default:
            callback();
        }
      }
    });
  } catch (error) {
    log.error("Processing NotificationNewsFeedWorker Error", {err: error});
    callback();
  }
};

module.exports = new NotificationNewsFeedWorker();
