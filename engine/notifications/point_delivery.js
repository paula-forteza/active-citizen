var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var filterNotificationForDelivery = require('./emails_utils').filterNotificationForDelivery;

module.exports = function (notification, user, callback) {
  var post = notification.AcActivities[0].Post;
  if (notification.type=='notification.point.new') {
    filterNotificationForDelivery(notification, user, 'point_activity', i18n.t('notification.email.newPointOnMyPoint')+": "+post.name, callback);
  } else if (notification.type=='notification.point.quality') {
    filterNotificationForDelivery(notification, user, 'point_activity', i18n.t('notification.email.newPointQuality')+": "+post.name, callback);
  }
};
