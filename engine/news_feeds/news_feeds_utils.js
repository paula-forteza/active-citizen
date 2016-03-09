var getRecommendedNewsFeedDate = function(options, type, callback) {
  var where = {
    type: type
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
    attributes: ['updated_at'],
    order: [
      [ 'updated_at', options.firstItem ? 'desc' : 'asc' ]
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

var activitiesDefaultIncludes = [
  {
    model: models.User,
    required: true
  },
  {
    model: models.Domain,
    required: false
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

module.exports = {
  getRecommendedNewsFeedDate: getRecommendedNewsFeedDate,
  activitiesDefaultIncludes: activitiesDefaultIncludes
};