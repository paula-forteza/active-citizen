var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var filterNotificationForDelivery = require('./emails_utils').filterNotificationForDelivery;

module.exports = function (notification, user, callback) {
  if (notification.type=='notification.point.new') {
    filterNotificationForDelivery(notification, user, 'my_points', 'point_activity', i18n.t('notification.email.newPointOnMyPoint'), callback);
  } else if (notification.type=='notification.point.quality') {
    filterNotificationForDelivery(notification, user, 'my_points_endorsements', 'point_activity', i18n.t('email.point.subject.quality'), callback);
  }
};
