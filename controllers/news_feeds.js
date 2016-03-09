var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var addRecommendedActivities = require('../engine/news_feeds/generate_dynamically').addRecommendedActivities;
var getNewsFeed = require('../engine/news_feeds/generate_dynamically').getNewsFeed;

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
          if (error) {
            log.error("News Feed Error Domain", { domainId: req.params.id, user: toJson(req.user.simple()), error: error, errorStatus:  500 });
            res.sendStatus(500);
          } else {
            res.send(finalItems);
          }
        });
      }
  });
});


module.exports = router;