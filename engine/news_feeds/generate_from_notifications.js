var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var async = require('async');
var log = require('../../utils/logger');
var _ = require('lodash');
var toJson = require('../../utils/to_json');

var isItemRecommended = require('../recommendations/events_manager').isItemRecommended;

var createItem = function (notification, options, callback) {
  var detail = {};
  detail.ac_notification_id = notification.id;
  detail.ac_activity_id = _.last(notification.AcActivities).id;
  detail.user_id = notification.user_id;
  detail.priority = 100;

  models.AcNewsFeedItem.create(_.merge(detail, options)).then(function (item) {
    if (item) {
      log.info("Generate News Feed Notifications Created item", { item: toJson(item) });
      callback();
    } else {
      callback('Could not created item');
    }
  }).catch(function (error) {
    callback(error);
  })
};

var getLastRecommendedNewsFeedDate = function(options, callback) {
  var where = {
    type: 'newsFeed.from.notification.recommendation'
  };

  if (options.domain_id) {
    where = _.merge(where, {
      domain_id: options.domain_id
    })
  }

  if (options.community_id) {
    where = _.merge(where, {
      community_id: options.community_id
    })
  }

  if (options.group_id) {
    where = _.merge(where, {
      group_id: options.group_id
    })
  }

  if (options.post_id) {
    where = _.merge(where, {
      post_id: options.post_id
    })
  }

  models.AcNewsFeedItem.find({
    where: where,
    order: [
      [ 'updated_at', 'desc' ]
    ]
  }).then(function (item) {
    if (item) {
      callback(null, item.updated_at);
    } else {
      callback();
    }
  }).catch(function (error) {
    callback(error);
  });
};

var buildNewsFeedItems = function (notification, callback) {
  var shouldInclude = false;
  var activity = _.last(notification.AcActivities);
  var lastNewsItem;

  async.series([
    // If my activity, new post, my post or some of my followings mark it as should include
    function (seriesCallback) {
      if (notification.user_id == activity.user_id ||
          activity.type == 'activity.post.new' ||
          (activity.Post && activity.Post.user_id == notification.user_id) ) {
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
      if (shouldInclude || !activity.Post) {
        seriesCallback()
      } else {
        models.Endorsement.find({
          where: {
            user_id: notification.user_id,
            post_id: activity.Post.id
          }
        }).then(function (endorsement) {
          if (endorsement) {
            shouldInclude = true;
          }
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error)
        });
      }
    },
    function (seriesCallback) {
      // Create newsFeed item if needed
      if (shouldInclude) {
        createItem(notification, {
          type: 'newsFeed.from.notification.should',
          domain_id: activity.domain_id,
          group_id: activity.group_id,
          post_id: activity.post_id,
          community_id: activity.community_id },
          seriesCallback);
      } else {
        var lastNewsItemUpdatedAt;
        async.series([
          // Domain news feed from recommendations
          function (innerSeriesCallback) {
            lastNewsItemUpdatedAt = null;
            getLastRecommendedNewsFeedDate({domain_id: activity.domain_id}, function(error, itemUpdatedAt) {
              lastNewsItemUpdatedAt = itemUpdatedAt;
              innerSeriesCallback(error);
            });
          },
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              limit: 15,
              after: lastNewsItemUpdatedAt ? lastNewsItemUpdatedAt.toISOString() : null
            }, {
              domain_id: activity.domain_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'newsFeed.from.notification.recommendation',
                  domain_id: activity.domain_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          },
          // Community news feed from recommendations
          function (innerSeriesCallback) {
            lastNewsItemUpdatedAt = null;
            getLastRecommendedNewsFeedDate({community_id: activity.community_id}, function(error, itemUpdatedAt) {
              lastNewsItemUpdatedAt = itemUpdatedAt;
              innerSeriesCallback(error);
            });
          },
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              after: lastNewsItemUpdatedAt ? lastNewsItemUpdatedAt.toISOString() : null
            }, {
              community_id: activity.community_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'newsFeed.from.notification.recommendation',
                  community_id: activity.community_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          },
          // Group news feed from recommendations
          function (innerSeriesCallback) {
            lastNewsItemUpdatedAt = null;
            getLastRecommendedNewsFeedDate({group_id: activity.group_id}, function(error, itemUpdatedAt) {
              lastNewsItemUpdatedAt = itemUpdatedAt;
              innerSeriesCallback(error);
            });
          },
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              after: lastNewsItemUpdatedAt ? lastNewsItemUpdatedAt.toISOString() : null
            }, {
              group_id: activity.group_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'newsFeed.from.notification.recommendation',
                  group_id: activity.group_id
                }, function (error) {
                  innerSeriesCallback(error)
                });
              } else {
                innerSeriesCallback();
              }
            });
          },
          // Post news feed from recommendations
          function (innerSeriesCallback) {
            lastNewsItemUpdatedAt = null;
            getLastRecommendedNewsFeedDate({post_id: activity.post_id}, function(error, itemUpdatedAt) {
              lastNewsItemUpdatedAt = itemUpdatedAt;
              innerSeriesCallback(error);
            });
          },
          function (innerSeriesCallback) {
            isItemRecommended(activity.post_id, notification.User, {
              after: lastNewsItemUpdatedAt ? lastNewsItemUpdatedAt.toISOString() : null
            }, {
              post_id: activity.post_id
            }, function (isRecommended) {
              if (isRecommended) {
                createItem(notification, {
                  type: 'newsFeed.from.notification.recommendation',
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
          ac_notification_id: notification.id
        }
      }).then(function (oldNewsFeedItem) {
        if (oldNewsFeedItem) {
          log.info("Generate News Feed Notifications found old item and updating timestamp", { oldNewsFeedItemId: oldNewsFeedItem.id });
          news_feed_item = oldNewsFeedItem;
          news_feed_item.changed('updated_at', true);
          news_feed_item.update().then(function (updateResults) {
            if (updateResults) {
              log.error("Filtering News Feed Notifications Error", { err: "Could not update timestamp" });
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
        buildNewsFeedItems(notification, seriesCallback);
      }
    }
  ], function (error) {
    if (error) {
      log.error("Generate News Feed Notifications Error", { err: error });
    }
    callback(error);
  });
};
