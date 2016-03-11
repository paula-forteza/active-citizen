var queue = require('../../workers/queue');
var models = require("../../../models");
var i18n = require('../../utils/i18n');
var async = require('async');
var log = require('../../utils/logger');
var _ = require('lodash');
var toJson = require('../../utils/to_json');

var isItemRecommended = require('../recommendations/events_manager').isItemRecommended;
var getRecommendationFor = require('../recommendations/events_manager').getRecommendationFor;

var getRecommendedNewsFeedDate = require('./news_feeds_utils').getRecommendedNewsFeedDate;
var activitiesDefaultIncludes = require('./news_feeds_utils').activitiesDefaultIncludes;
var whereFromOptions = require('./news_feeds_utils').whereFromOptions;
var defaultKeyActivities = require('./news_feeds_utils').defaultKeyActivities;

// Load current news feed generated from notifications by modified_at
// Get recommendations and insert into the news with the modified_at timestamps
// Get promotions to add to the news feed
// Create critical priority job to insert recommendation and promotions to postgres
// Send data back to user

var GENERAL_NEWS_FEED_LIMIT = 30;
var RECOMMENDATION_FILTER_THRESHOLD = 5;

var getNewsFeed = function(options, callback) {
  var where = whereFromOptions(options);
  models.AcNewsFeedItem.findAll({
    where: where,
    order: [
      ["latest_activity_at", "desc"]
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
    log.info("Generate News Feed Dynamically Got news feed", { itemsLength: items.length });
    callback(null, items);
  }).catch(function(error) {
    callback(error);
  });
};

var addRecommendedActivities = function (user, currentInFeedItems, options, callback) {
  var activitiesCurrentlyInFeedIds = _.map(currentInFeedItems, function (item) { return item.ac_activity_id });
  var allActivities, finalActivities;
  if (currentInFeedItems.length>=GENERAL_NEWS_FEED_LIMIT) {
    log.info("Generate News Feed Dynamically Not generated recommendations as at GENERAL_NEWS_FEED_LIMIT", { GENERAL_NEWS_FEED_LIMIT: GENERAL_NEWS_FEED_LIMIT });
    callback(null, currentInFeedItems);
  } else {
    async.series([
      // Get firstDynamicRecommendedNewsFeed item AcActivity.created_at date for options
      function (seriesCallback) {
        getRecommendedNewsFeedDate(_.merge(options, { latest: true }), 'newsFeed.dynamic.recommendation', function(error, itemUpdatedAt) {
          if (error) {
            seriesCallback(error);
          } else {
            if (itemUpdatedAt) {
              options.latestDynamicItemModifiedAt = itemUpdatedAt;
              log.info("Generate News Feed Dynamically Got latestDynamicItemModifiedAt", { itemUpdatedAt: itemUpdatedAt });
            }
            seriesCallback();
          }
        });
      },
      // Get oldersDynamicRecommendedNewsFeed item AcActivity.created_at date for options
      function (seriesCallback) {
        getRecommendedNewsFeedDate(_.merge(options, { latest: false }), 'newsFeed.dynamic.recommendation', function(error, itemUpdatedAt) {
          if (error) {
            seriesCallback(error);
          } else {
            if (itemUpdatedAt) {
              options.oldestDynamicItemModifiedAt = itemUpdatedAt;
              log.info("Generate News Feed Dynamically Got oldestDynamicItemModifiedAt", { itemUpdatedAt: itemUpdatedAt });
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
            $in: defaultKeyActivities
          }
        });
        if (activitiesCurrentlyInFeedIds.length>0) {
          where = _.merge(where, {
            id: {
              $notIn: activitiesCurrentlyInFeedIds
            }
          });
        }
        delete where.user_id;
        models.AcActivity.findAll({
          where: where,
          limit: GENERAL_NEWS_FEED_LIMIT,
          order: [
            [ "created_at", "desc"]
          ]
        }).then(function(activities) {
          log.info("Generate News Feed Dynamically Got defaultKeyActivities", { activitiesLength: activities.length });
          allActivities = activities;
          seriesCallback();
        }).catch(function(error) {
          seriesCallback(error);
        });
      },
      // Filter out activities if needed
      function (seriesCallback) {
        if (allActivities.length>RECOMMENDATION_FILTER_THRESHOLD) {
          log.info("Generate News Feed Dynamically Breached Recommendation Filter Threshold", {
            allActivitiesLength: allActivities.length, threshold: RECOMMENDATION_FILTER_THRESHOLD
          });
          var currentPostIds = _.map(allActivities, function (item) { return item.post_id ? item.post_id.toString() : null; });
          // There can be more than one instance of a post_id from a group of activities
          currentPostIds =_.uniq(currentPostIds);
          currentPostIds = _.without(currentPostIds, null);
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
              var recommendedPostIds = _.filter(currentPostIds, function (activity) { return _.includes(recommendedItemIds, activity) });
              var notRecommendedPostIds = _.filter(currentPostIds, function (activity) { return !_.includes(recommendedItemIds, activity)});
              log.info("Generate News Feed Dynamically Recommendation status", {
                recommendedPostIdsLength: recommendedPostIds.length, notRecommendedPostIdsLength: notRecommendedPostIds.length
              });
              var finalPostIds;
              if (recommendedPostIds.length<RECOMMENDATION_FILTER_THRESHOLD) {
                // Randomize the remaining not recommended activities
                notRecommendedPostIds = _.shuffle(notRecommendedPostIds);
                // Merge the recommended activities using the not recommended ones
                finalPostIds = _.concat(recommendedPostIds, _.dropRight(notRecommendedPostIds,
                  notRecommendedPostIds.length-(RECOMMENDATION_FILTER_THRESHOLD-recommendedPostIds.length)));
              } else {
                finalPostIds = recommendedPostIds;
              }
              allActivities = _.filter(allActivities, function (activity) { return (activity.post_id && _.includes(finalPostIds, activity.post_id.toString()))});
              seriesCallback();
            }
          });
        } else {
          log.info("Generate News Feed Dynamically Not filtering", {
            allActivitiesLength: allActivities.length, threshold: RECOMMENDATION_FILTER_THRESHOLD
          });
          seriesCallback();
        }
      },
      // Make sure there are no doubles
      function (seriesCallback) {
        var currentActivityIds = _.map(allActivities, function (item) { return item.id; });
        models.AcNewsFeedItem.findAll({
          where: {
            ac_activity_id: {
              $in: currentActivityIds
            }
          }
        }).then(function(alreadySavedActivities) {
          log.info("Generate News Feed Dynamically Found already saved", {
            alreadySavedActivitiesLength: alreadySavedActivities.length
          });
          var alreadySavedActivitiesIds = _.map(alreadySavedActivities, function (item) { return item.id; });
          // Filter out activities alreqady in this newsfeed
          allActivities = _.filter(allActivities, function (activity) { return !_.includes(alreadySavedActivities, activity.id)});
          seriesCallback();
        }).catch(function(error) {
          seriesCallback(error);
        });
      },
      // Save all left in a transaction
      function (seriesCallback) {
        log.info("Generate News Feed Dynamically Saving new news items", { allActivitiesLength: allActivities.length });

        models.sequelize.transaction(function (t1) {
          allInserts = [];
          var tempIds = _.map(allActivities, function (item) { return item.user_id; });
          _.forEach(allActivities, function (activity) {
            allInserts.push(models.AcNewsFeedItem.create({ ac_activity_id: activity.id, latest_activity_at: activity.created_at,
              type: 'newsFeed.dynamic.recommendation', user_id: user.id,
              domain_id: options.domain_id, community_id: options.community_id,
              group_id: options.group_id, post_id: options.post_id }, { transaction: t1 }));

          });
          return Promise.all(allInserts);
        }).then(function (result) {
          log.info("Generate News Feed Dynamically Saved", { result: result });
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        });
      },
      // Combine older and new dynamically recommended activities
      function (seriesCallback) {
        var olderActivities  = _.map(currentInFeedItems, function (item) { return item.AcActivity });
        finalActivities = _.concat(allActivities, olderActivities);
        // Sort the combined activities
        finalActivities = _.orderBy(finalActivities, ['created_at'], ['desc']);
        log.info("Generate News Feed Dynamically Have created the final activities to deliver", { finalActivitiesLength: finalActivities.length });
        seriesCallback();
      }
    ], function (error) {
      // Return all
      callback(error, finalActivities);
    });
  }
};

module.exports = {
  getNewsFeed: getNewsFeed,
  addRecommendedActivities: addRecommendedActivities
};