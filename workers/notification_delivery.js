// https://gist.github.com/mojodna/1251812
var async = require("async");
var models = require("../../models");
var log = require('../utils/logger');
var queue = require('./queue');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');
var deliverPostNotification = require('../engine/notifications/post_delivery.js');
var deliverPointNotification = require('../engine/notifications/point_delivery.js');
var airbrake = require('../utils/airbrake');

var NotificationDeliveryWorker = function () {};

NotificationDeliveryWorker.prototype.process = function (notificationJson, callback) {
  var user;
  var notification;
  var domain;
  var community;

  async.series([
      function(seriesCallback){
        models.AcNotification.find({
          where: { id: notificationJson.id },
          include: [
            {
              model: models.User,
              attributes: ['id','notifications_settings','email','name','created_at'],
              required: false
            },
            {
              model: models.AcActivity,
              as: 'AcActivities',
              required: true,
              include: [
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
                  required: false,
                  include: [
                    {
                      model: models.Community,
                      required: false,
                      include: [
                        {
                          model: models.Domain,
                          required: false
                        }
                      ]
                    }
                  ]
                },
                {
                  model: models.Post,
                  required: false
                },
                {
                  model: models.PostStatusChange,
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
          log.info("NotificationDeliveryWorker Debug 1", {results: results.dataValues});
          if (results) {
            notification = results;
            if (notification.AcActivities[0].Domain) {
              domain = notification.AcActivities[0].Domain;
            } else if (notification.AcActivities[0].Group && notification.AcActivities[0].Group &&
                       notification.AcActivities[0].Group.Community &&
                       notification.AcActivities[0].Group.Community.Domain) {
              domain = notification.AcActivities[0].Group.Community.Domain;
              log.info("NotificationDeliveryWorker Debug 1a", {});
            } else {
              log.error("Couldn't find domain for NotificationDeliveryWorker");
            }
            log.info("NotificationDeliveryWorker Debug 2", {notification: notification.dataValues });
            if (notification.AcActivities[0].Community) {
              community = notification.AcActivities[0].Community;
            } else if (notification.AcActivities[0].Group &&
                       notification.AcActivities[0].Group.Community) {
              community = notification.AcActivities[0].Group.Community;
            } else {
              log.error("Couldn't find community for NotificationDeliveryWorker");
            }
            log.info("NotificationDeliveryWorker Debug 4", {});
            seriesCallback();
          } else {
            seriesCallback('Notification not found');
          }
        }).catch(function(error) {
          seriesCallback(error);
        });
      },
      function(seriesCallback){
        if (notification.user_id) {
          models.User.find({
            where: { id: notification.user_id },
            attributes: ['id','notifications_settings','email','name','created_at']
          }).then(function(userResults) {
            if (userResults) {
              log.info("NotificationDeliveryWorker Debug 5", {userResults: userResults.dataValues});
              user = userResults;
              seriesCallback();
            } else {
              if (notification.AcActivities[0].object.email) {
                log.info("NotificationDeliveryWorker Debug 5.5", {});
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
      function(seriesCallback){
        if (user) {
          user.setLocale(i18n, domain, community, function () {
            log.info("NotificationDeliveryWorker Debug 6", {});
            seriesCallback();
          });
        } else {
          seriesCallback();
        }
      }
    ],
    function(error) {
      if (error) {
        if (error.stack)
          log.error("NotificationDeliveryWorker Error", {err: error, stack: error.stack.split("\n") });
        else
          log.error("NotificationDeliveryWorker Error", {err: error });

        airbrake.notify(error, function(airbrakeErr, url) {
          if (airbrakeErr) {
            log.error("AirBrake Error", { context: 'airbrake', user: toJson(req.user), err: airbrakeErr });
          }
          callback(error);
        });
      } else {
        log.info('Processing NotificationDeliveryWorker Started', { type: notification.type, user: user ? user.simple() : null });
        switch(notification.type) {
          case "notification.user.invite":
            queue.create('send-one-email', {
              subject: i18n.t('email.user_invite'),
              template: 'user_invite',
              user: user ? user : { id: null, email: notification.AcActivities[0].object.email, name: notification.AcActivities[0].object.email },
              domain: domain,
              community: community,
              token: notification.AcActivities[0].object.token
            }).priority('critical').removeOnComplete(true).save();
            log.info('Processing notification.password.recovery Completed', { type: notification.type, user: user ? user.simple() : null });
            callback();
            break;
          case "notification.password.recovery":
            queue.create('send-one-email', {
              subject: i18n.t('notification.email.password_recovery'),
              template: 'password_recovery',
              user: user,
              domain: domain,
              community: community,
              token: notification.AcActivities[0].object.token
            }).priority('critical').removeOnComplete(true).save();
            log.info('Processing notification.password.recovery Completed', { type: notification.type, user: user.simple() });
            callback();
            break;
          case "notification.password.changed":
            queue.create('send-one-email', {
              subject: i18n.t('email.password_changed'),
              template: 'password_changed',
              user: user,
              domain: domain,
              community: community,
              token: notification.activity.object.token
            }).priority('critical').removeOnComplete(true).save();
            log.info('Processing notification.password.changed Completed', { type: notification.type, user: user.simple() });
            callback();
            break;
          case "notification.post.status.change":
            queue.create('send-one-email', {
              subject: i18n.t('statusChange.updateSubject'),
              template: 'post_status_change',
              user: user,
              domain: domain,
              community: community,
              post: notification.AcActivities[0].Post,
              content: notification.AcActivities[0].PostStatusChange.content,
              status_changed_to: notification.AcActivities[0].PostStatusChange.status_changed_to
            }).priority('critical').removeOnComplete(true).save();
            log.info('Processing notification.password.changed Completed', { type: notification.type, user: user.simple() });
            callback();
            break;
          case "notification.post.new":
          case "notification.post.endorsement":
            deliverPostNotification(notification, user, function () {
              log.info('Processing notification.post.* Completed', { type: notification.type, user: user.simple() });
              callback();
            });
            break;
          case "notification.point.new":
          case "notification.point.quality":
            deliverPointNotification(notification, user, function () {
              log.info('Processing notification.point.* Completed', { type: notification.type, user: user.simple() });
              callback();
            });
            break;
          default:
            callback();
        }
      }
    });
};

module.exports = new NotificationDeliveryWorker();
