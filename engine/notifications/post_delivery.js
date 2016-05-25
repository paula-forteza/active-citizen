var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var filterNotificationForDelivery = require('./emails_utils').filterNotificationForDelivery;

module.exports = function (notification, user, callback) {
  var post = notification.AcActivities[0].Post;
  if (notification.type=='notification.post.new') {
    filterNotificationForDelivery(notification, user, 'post_activity', i18n.t('notification.email.postNew')+": "+post.name, callback);
  } else if (notification.type=='notification.post.endorsement') {
    filterNotificationForDelivery(notification, user, 'post_activity', i18n.t('notification.email.postEndorsementNew')+": "+post.name, callback);
  } else {
    callback();
  }
};
