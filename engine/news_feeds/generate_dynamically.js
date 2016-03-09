var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var async = require('async');
var log = require('../../utils/logger');
var _ = require('lodash');
var toJson = require('../../utils/to_json');

var isItemRecommended = require('../recommendations/events_manager').isItemRecommended;
var getRecommendationFor = require('./news_feeds_utils').getRecommendationFor;

var getRecommendedNewsFeedDate = require('./news_feeds_utils').getRecommendedNewsFeedDate;
var activitiesDefaultIncludes = require('./news_feeds_utils').activitiesDefaultIncludes;

// Load current news feed generated from notifications by modified_at
// Get recommendations and insert into the news with the modified_at timestamps
// Get promotions to add to the news feed
// Create critical priority job to insert recommendation and promotions to postgres
// Send data back to user

var GENERAL_NEWS_FEED_LIMIT = 30;
var RECOMMENDATION_FILTER_THRESHOLD = 5;

var whereFromOptions = function (options) {

  // Example query 1
  //  Get latest
  //  AcNewsFeed Options
  //    Limit 30
  //  AcActivities
  //    modified_at $gt last_dynamically_generated_processed_news_feed_ac_activity_modified_at
  //    modified_at $lt first_dynamically_generated_processed_news_feed_ac_activity_modified_at

  // Example query 2
  //  Get latest since last
  //  AcNewsFeed Options
  //    modified_at $gt latest_news_feed_item_at
  //  AcActivities
  //    $and
  //      A
  //        modified_at $gt latest_news_feed_item_at
  //      B
  //        modified_at $gt last_dynamically_generated_processed_news_feed_ac_activity_modified_at
  //        modified_at $lt first_dynamically_generated_processed_news_feed_ac_activity_modified_at

  // Example query 3
  // Get older since last shown item
  //  AcNewsFeed Options
  //    modified_at $lt last_shown_news_feed_item_at
  //  AcActivities
  //   $and
  //    A
  //      modified_at $lt last_shown_news_feed_item_at
  //    B
  //      modified_at $gt last_dynamically_generated_processed_news_feed_ac_activity_modified_at
  //      modified_at $lt first_dynamically_generated_processed_news_feed_ac_activity_modified_at

  var where = {
    status: 'active'
  };

  if (options.isAcActivity) {
    var modifiedBase = {};

    if (options.firstDynamicItemModifiedAt && options.lastDynamicItemModifiedAt) {
      modifiedBase = {
        updated_at: {
          $gt: options.lastDynamicItemModifiedAt,
          $lt: options.firstDynamicItemModifiedAt
        }
      };
    } else if (options.firstDynamicItemModifiedAt) {
      modifiedBase = {
        updated_at: {
          $lt: options.firstDynamicItemModifiedAt
        }
      };
    } else if (options.lastDynamicItemModifiedAt) {
      modifiedBase = {
        updated_at: {
          $gt: options.lastDynamicItemModifiedAt
        }
      };
    }

    if (!options.after && !options.before) {
      _.merge(where, modifiedBase)
    } else if (options.before) {
      _.merge(where, {
        $and: [
          {
            updated_at: { $lt: options.before }
          },
          modifiedBase
        ]
      })
    } else if (options.after) {
      _.merge(where, {
        $and: [
          {
            updated_at: { $gt: options.after }
          },
          modifiedBase
        ]
      })
    }
  } else {
    if (options.before) {
      _.merge(where, {
        updated_at: { $lt: options.before }
      });
    } else if (options.after) {
      _.merge(where,
        {
          updated_at: { $gt: options.after }
        });
    }
  }

  if (options.domain_id) {
    _.merge(where, {
      domain_id: options.domain_id
    })
  }

  if (options.community_id) {
    _.merge(where, {
      community_id: options.community_id
    })
  }

  if (options.group_id) {
    _.merge(where, {
      group_id: options.group_id
    })
  }

  if (options.post_id) {
    _.merge(where, {
      post_id: options.post_id
    })
  }

  if (options.user_id) {
    _.merge(where, {
      user_id: options.user_id
    })
  }

  return where;
};

var getNewsFeed = function(options, callback) {
  models.AcNewsFeedItem.findAll({
    where: whereFromOptions(options),
    order: [
      ["updated_at", "desc"]
    ],
    limit: options.limit || GENERAL_NEWS_FEED_LIMIT,
    include: [
      {
        model: models.AcActivity,
        required: true,
        include: activitiesDefaultIncludes
      }
    ]
  }).then(function(items) {
    callback(null, items);
  }).catch(function(error) {
    callback(error);
  });
};

var addRecommendedActivities = function (user, currentInFeedItems, options, callback) {
  var activitiesCurrentlyInFeedIds = _.map(currentInFeedItems, function (item) { return item.ac_activity_id });
  var allActivities, finalActivities;
  async.series([
    // Get firstDynamicRecommendedNewsFeed item AcActivity.created_at date for options
    function (seriesCallback) {
      getRecommendedNewsFeedDate(_.merge(options, { firstItem: true }), 'newsFeed.dynamic.recommendation', function(error, itemUpdatedAt) {
        if (error) {
          seriesCallback(error);
        } else {
          if (itemUpdatedAt) {
            options.firstDynamicItemModifiedAt = itemUpdatedAt;
          }
          seriesCallback();
        }
      });
    },
    // Get lastDynamicRecommendedNewsFeed item AcActivity.created_at date for options
    function (seriesCallback) {
      getRecommendedNewsFeedDate(options, 'newsFeed.dynamic.recommendation', function(error, itemUpdatedAt) {
        if (error) {
          seriesCallback(error);
        } else {
          if (itemUpdatedAt) {
            options.lastDynamicItemModifiedAt = itemUpdatedAt;
          }
          seriesCallback();
        }
      });
    },
    // Get all activities
    function (seriesCallback) {
      options.isAcActivity = true;
      var where = whereFromOptions(options);
      where = _.merge(where, {
        type: {
          $in: ['activity.post.status.update','activity.post.officialStatus.successful',
            'activity.point.new','activity.post.new','activity.post.officialStatus.failed',
            'activity.post.officialStatus.inProgress']
        },
        id: {
          $notIn: activitiesCurrentlyInFeedIds
        }
      });
      models.AcActivity.findAll({
        where: where,
        limit: GENERAL_NEWS_FEED_LIMIT
      }).then(function(activities) {
        allActivities = activities;
      }).catch(function(error) {
        seriesCallback(error);
      });
    },
    // Filter out activities if needed
    function (seriesCallback) {
      if (allActivities.length>RECOMMENDATION_FILTER_THRESHOLD) {
        var currentActivityIds = _.map(allActivities, function (item) { return item.id.toString(); });
        var dateRange = {};
        if (options.after && options.before) {
          dateRange = { after: options.after, before: options.before }
        } else if (options.after) {
          dateRange = { after: options.after }
        } else if (options.before) {
          dateRange = { before: options.before }
        }
        getRecommendationFor(user, dateRange, options, function (error, recommendedItemIds) {
          if (error) {
            seriesCallback(error);
          } else {
            var recommendedActivityIds = _.filter(currentActivityIds, function (activity) { return _.includes(activity, recommendedItemIds)});
            var notRecommendedActivityIds = _.filter(currentActivityIds, function (activity) { return !_.includes(activity, recommendedItemIds)});
            var finalActivityIds;
            if (recommendedActivityIds.length<RECOMMENDATION_FILTER_THRESHOLD) {
              // Randomize the remaining not recommended activities
              notRecommendedActivityIds = _.shuffle(notRecommendedActivityIds);
              // Merge the recommended activities using the not recommended ones
              finalActivityIds = _.concat(recommendedActivityIds, _.dropRight(notRecommendedActivityIds, notRecommendedActivityIds.length-(RECOMMENDATION_FILTER_THRESHOLD-recommendedActivityIds.length)));
            } else {
              finalActivityIds = recommendedActivityIds;
            }
            allActivities = _.filter(allActivities, function (activity) { return _.includes(activity.id.toString(), finalActivityIds)});
            seriesCallback();
          }
        });
      } else {
        seriesCallback();
      }
    },
    // Make sure there are no doubles
    function (seriesCallback) {
      var currentActivityIds = _.map(allActivities, function (item) { return item.id; });
      models.AcNewsFeedItem.findAll({
        where: {
          id: {
            $in: currentActivityIds
          }
        }
      }).then(function(alreadySavedActivities) {
        var alreadySavedActivitiesIds = _.map(alreadySavedActivities, function (item) { return item.id; });
        // Filter out activities already in this newsfeed
        allActivities = _.filter(allActivities, function (activity) { return !_.includes(activity.id, alreadySavedActivities)});
      }).catch(function(error) {
        seriesCallback(error);
      });
    },
    // Save all left in a transaction
    function (seriesCallback) {
      sequelize.transaction(function (t1) {
        allInserts = [];
        _.forEach(allActivities, function (activity) {
          allInserts.push(models.AcNewsFeedItem.create({ ac_activity_id: activity.id,
                                                         type: 'newsFeed.dynamic.recommendation', user_id: user.id,
                                                         domain_id: options.domain_id, community_id: options.community_id,
                                                         group_id: options.group_id, post_id: options.post_id }));

        });
        return Promise.all(allInserts);
      }).then(function (result) {
        seriesCallback();
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    // Combine older and new dynamically recommended activities
    function (seriesCallback) {
      var olderActivities  = _.map(allActivities, function (item) { return item.AcActivity });
      finalActivities = _.concat(allActivities, olderActivities);
      // Sort the combined activities
      finalActivities = _.orderBy(finalActivities, ['updated_at'], ['desc']);
      seriesCallback();
    }
  ], function (error) {
    callback(error, finalActivities);
  });
};
