var models = require("../../../models");
var _ = require('lodash');

var getRecommendedNewsFeedDate = function(options, type, callback) {
  var where = {
    type: type,
    user_id: options.user_id
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

  var order;
  if (options.firstItem) {
    order = [['latest_activity_at','DESC']]
  } else {
    order = [['latest_activity_at','ASC']]
  }

  models.AcNewsFeedItem.find({
    where: where,
    attributes: ['latest_activity_at'],
    order: [
      [ 'latest_activity_at', options.latest ? 'desc' : 'asc' ]
    ]
  }).then(function (item) {
    if (item) {
      callback(null, item.latest_activity_at);
    } else {
      callback();
    }
  }).catch(function (error) {
    callback(error);
  });
};

var activitiesDefaultIncludes = [
  {
    model: models.User,
    required: true
  },
  {
    model: models.Domain,
    required: true
  },
  {
    model: models.Community,
    required: false
  },
  {
    model: models.Group,
    required: false
  },
  {
    model: models.Post,
    required: false
  },
  {
    model: models.Point,
    required: false
  }
];

var whereFromOptions = function (options) {

  // Example query 1
  //  Get latest
    // If newer activities than latest_processed_range
      // Generate items from activities
      // Load latest notification news feed items with created_at $gt oldest_processed_activity
      // Create processed_range

  // If I request older items by scrolling down

  //  AcNewsFeed Options
  //    Limit 30
  //  AcActivities
  //    modified_at $gt latest_dynamically_generated_processed_news_feed_ac_activity_modified_at
  //    modified_at $lt oldest_dynamically_generated_processed_news_feed_ac_activity_modified_at

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
    var updatedAtBase = {};

    if (options.latestDynamicItemModifiedAt && options.oldestDynamicItemModifiedAt) {
      updatedAtBase = {
        created_at: {
          $or: {
            $gt: options.latestDynamicItemModifiedAt,  //  >  15.01.2001
            $lt: options.oldestDynamicItemModifiedAt   //  <  05.01.2001
          }
        }
      };
    } else if (options.latestDynamicItemModifiedAt) {
      updatedAtBase = {
        created_at: {
          $gt: options.latestDynamicItemModifiedAt
        }
      };
    } else if (options.oldestDynamicItemModifiedAt) {
      updatedAtBase = {
        created_at: {
          $lt: options.oldestDynamicItemModifiedAt
        }
      };
    }

    if (!options.after && !options.before) {
      _.merge(where, updatedAtBase)
    } else if (options.before) {
      _.merge(where, {
        $and: [
          {
            created_at: { $lt: options.before }
          },
          updatedAtBase
        ]
      })
    } else if (options.after) {
      _.merge(where, {
        $and: [
          {
            created_at: { $gt: options.after }
          },
          updatedAtBase
        ]
      })
    }
  } else {
    if (options.before) {
      _.merge(where, {
        created_at: { $lt: options.before }
      });
    } else if (options.after) {
      _.merge(where,
        {
          created_at: { $gt: options.after }
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

defaultKeyActivities = ['activity.post.status.update','activity.post.officialStatus.successful',
  'activity.point.new','activity.post.new','activity.post.officialStatus.failed',
  'activity.post.officialStatus.inProgress'];

module.exports = {
  getRecommendedNewsFeedDate: getRecommendedNewsFeedDate,
  activitiesDefaultIncludes: activitiesDefaultIncludes,
  whereFromOptions: whereFromOptions,
  defaultKeyActivities: defaultKeyActivities
};