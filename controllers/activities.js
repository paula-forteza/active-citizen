var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var addRecommendedActivities = require('../engine/news_feeds/generate_dynamically').addRecommendedActivities;
var whereFromOptions = require('../engine/news_feeds/news_feeds_utils').whereFromOptions;
var defaultKeyActivities = require('../engine/news_feeds/news_feeds_utils').defaultKeyActivities;

router.get('/:id/domain', auth.can('view domain'), function(req, res) {
  var options = {
    domain_id: req.params.id,
    after: req.params.after,
    before: req.params.before
  };

  models.AcActivity.findAll({
    where: _.merge(whereFromOptions(options), { type: { $in: defaultKeyActivities }}),
    order: [
      ["updated_at", "desc"]
    ],
    limit: 30
  }).then(function(activities) {
    res.send(activities);
  }).catch(function(error) {
    log.error("Activities Error Domain", { domainId: req.params.id, user: req.user ? toJson(req.user.simple()) : null, errorStatus:  500 });
  });
});

module.exports = router;