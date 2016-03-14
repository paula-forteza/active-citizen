var models = require("../../../models");
var _ = require('lodash');

var getCommonWhereDateOptions = function(options) {
  where = {};
  if (options.isAcActivity) {
    var updatedAtBase = {};

    if (options.latestItemAt && options.oldestItemAt) {
      updatedAtBase = {
        created_at: {
          $or: {
            $gt: options.latestItemAt,  //  >  15.01.2001
            $lt: options.oldestItemAt   //  <  05.01.2001
          }
        }
      };
    } else if (options.latestItemAt) {
      updatedAtBase = {
        created_at: {
          $gt: options.latestItemAt
        }
      };
    } else if (options.oldestItemAt) {
      updatedAtBase = {
        created_at: {
          $lt: options.oldestItemAt
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

};

var getCommonWhereOptions = function(options) {
  var where = {
    status: 'active',
    user_id: options.user_id
  };

  if (options.type) {
    where = _.merge(where, {
      type: options.type
    })
  }

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

  return where;
};

var getModelDate = function(model, options, callback) {
  var where = getCommonWhereOptions(options);

  var order;
  if (options.oldest) {
    order = [[options.dateColumn, 'ASC']]
  } else {
    order = [[options.dateColumn, 'DESC']]
  }

  model.find({
    where: where,
    attributes: [options.dateColumn],
    order: [
      [ options.dateColumn, options.latest ? 'desc' : 'asc' ]
    ]
  }).then(function (item) {
    if (item) {
      callback(null, item.getDataValue(options.dateColumn));
    } else {
      callback();
    }
  }).catch(function (error) {
    callback(error);
  });
};

var getNewsFeedDate = function(options, type, callback) {
  getModelDate(models.AcNewsFeedItem, _.merge(options, {
    dateColumn: 'latest_activity_at',
    type: type
  }), callback)
};

var getActivityDate = function(options, callback) {
  getModelDate(models.AcActivity, _.merge(options, {
    dateColumn: 'created_at'
  }), callback)
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

var getLatestAfterDate = function (afterDate, callback) {
  var latestActivityTime, latestProcessedRange;

  async.parallel([
    function (seriesCallback) {
      getActivityDate({ afterDate: afterDate }, function (error, latestActivityTimeIn) {
        latestActivityTime = latestActivityTimeIn;
          seriesCallback(error);
      })
    },
    function (seriesCallback) {
      getLatestProcessedRange({ afterDate: afterDate }, function (error, latestProcessedRangeIn) {
        latestProcessedRange = latestProcessedRangeIn;
        seriesCallback(error);
      })
    }
  ],function (error) {
    if (latestActivityTime>=latestProcessedRange.latest_activity_at) {
      generateNewsfeedFromActivities({ afterDate: afterDate }, callback);
    } else {
      getNewsfeedItemsFromProccessedRange(latestProcessedRange, callback);
    }
  })
};

var whereFromOptions = function (options) {

  // Example query 1
  //  Get latest
    // If newer activities than latest_processed_range
      // Load latest notification news feed items with created_at $gt oldest_activity being processed
      // Generate items from activities newer than latest_processed_range_start or Max 30
      // Create processed_range


  // Get more
    // If activities older than last viewed and newer than last_processed_at (older than last viewed also)
      // Generate Items
      // Load latest notification news feed items with created_at $gt oldest_activity being processed
      // Create processed_range
    // Else load all items in the time range next processed range (older than last viewed)
  //  Get new updated
    // If newer activities than latest_processed_range and newer than last viewed
      // Generate items from activities newer than latest_processed_range_start and newer than the last viewed or Max 30
      // Load latest notification news feed items with created_at $gt oldest_activity being processed
      // Create processed_range
  // Else if processed_range newer than last viewed
    // load all items in the time range
  // Else if notification generated items newer than the last viewed
    // Deliver items


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
  getNewsFeedDate: getNewsFeedDate,
  activitiesDefaultIncludes: activitiesDefaultIncludes,
  whereFromOptions: whereFromOptions,
  defaultKeyActivities: defaultKeyActivities
};