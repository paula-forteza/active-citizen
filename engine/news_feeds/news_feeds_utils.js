var getLastRecommendedNewsFeedDate = function(options, type, callback) {
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

module.exports = {
  getLastRecommendedNewsFeedDate: getLastRecommendedNewsFeedDate
};