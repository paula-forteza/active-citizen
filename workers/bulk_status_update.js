// https://gist.github.com/mojodna/1251812
var async = require("async");
var models = require("../../models");
var log = require('../utils/logger');
var queue = require('./queue');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');
var airbrake = require('../utils/airbrake');

var BulkStatusUpdateWorker = function () {};

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
