var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var filterNotificationForDelivery = require('./emails_utils').filterNotificationForDelivery;

module.exports = function (notification, user, callback) {
  if (notification.type=='notification.post.new') {
    filterNotificationForDelivery(notification, user, 'post_activity', i18n.t('notification.email.postNew'), callback);
  } else if (notification.type=='notification.post.endorsement') {
    filterNotificationForDelivery(notification, user, 'post_activity', i18n.t('notification.email.postNew'), callback);
  } else {
    callback();
  }
};
