var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var async = require('async');
var log = require('../utils/logger');
var _ = require('lodash');

var isItemRecommended = require('../recommendations/events_manager').isItemRecommended;

var createItem = function (notification, options, callback) {
  var detail = {};
  detail.notification_id = notification.id;
  detail.activity_id = notification.activity_id;
  detail.user_id = notification.user_id;

  models.AcNewsFeedItem.create(_.merge(detail, options)).then(function (item) {
    if (item) {
      callback();
    } else {
      callback('Could not created item');
    }
  }).catch(function (error) {
    callback(error);
  })
};

var buildNewsFeedItems = function (notification, callback) {
  var shouldInclude = false;
  var activity = _.last(notification.AcActivities);
  var lastNewsItem;

  async.series([
    function (seriesCallback) {
      if (notification.user_id == activity.user_id) {
        shouldInclude = true;
        seriesCallback();
      } else {
        models.AcFollowing.find({
          where: {
            user_id: notification.user_id,
            other_user_id: activity.user_id
          }
        }).then(function (following) {
          if (following) {
            shouldInclude = true;
          }
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error)
        });
      }
    },
    function (seriesCallback) {
      models.AcNewsFeedItem.find({
        order: [
          [ { model: models.AcNewsFeedItem }, 'updated_at', 'desc' ]
        ]
      }).then(function (item) {
        if (item) {
          lastNewsItem = item;
        }
        seriesCallback();
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      if (shouldInclude) {
        createItem(notification, {
          type: 'news_feed.from.notification.should',
          domain_id: activity.domain_id,
          group_id: activity.group_id,
          post_id: activity.post_id,
          community_id: activity.community_id }, function (error) {
          seriesCallback(error)
        });
      } else {
        async.parallel([
          // Domain news feed
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              limit: 15,
              after: lastNewsItem ? lastNewsItem.updated_at.toISOString() : null
            }, {
              domain_id: activity.domain_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'news_feed.from.notification.recommendation',
                  domain_id: activity.domain_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          },
          // Community news feed
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              after: lastNewsItem ? lastNewsItem.updated_at.toISOString() : null
            }, {
              community_id: activity.community_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'news_feed.from.notification.recommendation',
                  community_id: activity.community_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          },
          // Group news feed
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              after: lastNewsItem ? lastNewsItem.updated_at.toISOString() : null
            }, {
              group_id: activity.group_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'news_feed.from.notification.recommendation',
                  group_id: activity.group_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          },
          // Post news feed
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              after: lastNewsItem ? lastNewsItem.updated_at.toISOString() : null
            }, {
              post_id: activity.post_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'news_feed.from.notification.recommendation',
                  post_id: activity.post_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          }
        ], seriesCallback);
      }
    }
  ], callback);
};

module.exports = function (notification, user, callback) {

  var news_feed_item;

  async.series([
    // See if news item for same notification exists and set updated time if needed
    function (seriesCallback) {
      models.AcNewsFeedItem.find({
        where: {
          notification_id: notification.id
        }
      }).then(function (oldNewsFeedItem) {
        if (oldNewsFeedItem) {
          news_feed_item = oldNewsFeedItem;
          news_feed_item.changed('updated_at', true);
          news_feed_item.update().then(function (updateResults) {
            if (updateResults) {
              log.error("Filtering News Feed Notifications Error", {err: "Could not update timestamp"});
            }
            seriesCallback();
          });
        } else {
          seriesCallback();
        }
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      if (news_feed_item) {
        seriesCallback();
      } else {
        buildNewsFeedItem(notification, seriesCallback);
      }
    }
  ], function (error) {
    if (error) {
      log.error("Filtering News Feed Notifications Error", {err: error});
    }
  });
};
