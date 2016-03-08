var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

// Load current news feed generated from notifications by modified_at
// Get recommendations and insert into the news with the modified_at timestamps
// Get promotions to add to the news feed
// Create critical priority job to insert recommendation and promotions to postgres
// Send data back to user

var GENERAL_NEWS_FEED_LIMIT = 30;
var RECOMMENDATION_FILTER_THRESHOLD = 5;

var whereFromOptions = function (options) {
  var where = {
    status: 'active'
  };

  if (options.after && options.before) {
    _.merge(where, {
      modified_at: {
        $ge: options.after,
        $le: options.before
      }
    })
  } else if (options.before) {
    _.merge(where, {
      modified_at: { $lt: options.before }
    })
  } else if (options.after) {
    _.merge(where, {
      modified_at: { $gt: options.after }
    })
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

var getNewsFeed = function(userId, options, callback) {

  options.user_id = userId;

  models.AcNewsFeedItem.findAll({
    where: whereFromOptions(options),
    order: [
      ["modified_at", "desc"]
    ],
    limit: options.limit || GENERAL_NEWS_FEED_LIMIT,
    include: [
      {
        model: models.AcActivity,
        required: true
      }
    ]
  }).then(function(items) {
    callback(null, items);
  }).catch(function(error) {
    callback(error);
  });
};

var addRecommendedActivities = function (user, items, options, callback) {
  var activityOldIds = _.map(items, function (item) { return item.ac_activity_id });
  var allActivities;
  async.series([
    // Get lastDynamicRecommendedNewsFeed item AcActivity.created_at date for options
    // Include it in where
    // Get all activities
    function (seriesCallback) {
      var where = whereFromOptions(options);
      where = _.merge(where, {
        type: {
          $in: ['activity.post.status.update','activity.post.officialStatus.successful',
            'activity.point.new','activity.post.new','activity.post.officialStatus.failed',
            'activity.post.officialStatus.inProgress']
        },
        id: {
          $notIn: activityOldIds
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
    // Filter our activities if needed
    function (seriesCallback) {
      if (allActivities.length>RECOMMENDATION_FILTER_THRESHOLD) {
        var currentActivityIds = _.map(allActivities, function (item) { return item.id.toString(); });
        getRecommendationFor(user, { after: options.after, before: options.before }, options, function (error, recommendedItemIds) {
          if (error) {
            seriesCallback(error);
          } else {
            var commonActivityIds = _.filter(currentActivityIds, function (activity) { return _.includes(activity, recommendedItemIds)});
            var notCommonActivityIds = _.filter(currentActivityIds, function (activity) { return !_.includes(activity, recommendedItemIds)});
            currentActivityIds = _.shuffle(currentActivityIds);
            var finalActivityIds;
            if (commonActivityIds.length<RECOMMENDATION_FILTER_THRESHOLD) {
              finalActivityIds = _.merge(commonActivityIds, _.dropRight(notCommonActivityIds, notCommonActivityIds.length-(RECOMMENDATION_FILTER_THRESHOLD-commonActivityIds.length)));
            } else {
              finalActivityIds = commonActivityIds;
            }
            allActivities = _.filter(allActivities, function (activity) { return _.includes(activity.id.toString(), finalActivityIds)});
            seriesCallback();
          }
        });
      } else {
        seriesCallback();
      }
    }
  ], function (error) {
    callback(error, allActivities);
  });

};

router.get('/:id/domain', auth.can('view domain'), function(req, res) {
  var options = {
    domain_id: req.params.id,
    after: req.params.after,
    before: req.params.before
  };

  getNewsFeed(req.user.id, options,
    function (error, items) {
      if (error) {
        log.error("News Feed Error Domain", { domainId: req.params.id, user: toJson(req.user.simple()), errorStatus:  500 });
        res.sendStatus(500);
      } else {
        addRecommendedActivities(req.user, items, options, function(error, finalItems) {
          res.send(finalItems);
        });
      }
  });
});

module.exports = router;