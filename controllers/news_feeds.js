var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var getCuratedNewsItems = require('../engine/news_feeds/generate_dynamically').getCuratedNewsItems;

router.get('/domains/:id', auth.can('view domain'), auth.isLoggedIn, function(req, res) {

  var options = {
    user_id: req.user.id,
    domain_id: req.params.id,
    after: req.params.after,
    before: req.params.before
  };

  getCuratedNewsItems(options, function (error, items) {
    if (error) {
      log.error("News Feed Error Domain", { domainId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send(items);
    }
  });
});

module.exports = router;