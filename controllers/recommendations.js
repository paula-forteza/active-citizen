var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var getRecommendationFor = require('../engine/recommendations/events_manager').getRecommendationFor;

var OVERALL_LIMIT=7;

var setupOptions = function (req) {
  var options = {
    user_id: req.user ? req.user.id : -1
  };

  return options;
};

router.get('/domains/:id', auth.can('view domain'), function(req, res) {

  var options = setupOptions(req);

  options = _.merge(options, {
    domain_id: req.params.id,
    limit: OVERALL_LIMIT*2
  });

  getRecommendationFor(options.user_id, {}, options, function (error, recommendedItemIds) {
    var finalIds;

    if (error) {
      finalIds = [];
      log.error("Recommendation Error Domain", { err: error, domainId: req.params.id, userId:  req.user ? req.user.id : -1, errorStatus:  500 });
      airbrake.notify(error, function(airbrakeErr, url) {
        if (airbrakeErr) {
          log.error("AirBrake Error", { context: 'airbrake', err: airbrakeErr, errorStatus: 500 });
        }
      });
    } else {
      finalIds = _.shuffle(recommendedItemIds);
      finalIds = _.dropRight(finalIds, OVERALL_LIMIT);
    }

    log.info("Recommendations domains status", { recommendedItemIds: recommendedItemIds });

    models.Post.findAll({
      where: {
        id: {
          $in: finalIds
        }
      },
      include: [
        {
          // Category
          model: models.Category,
          required: false,
          include: [
            {
              model: models.Image,
              required: false,
              as: 'CategoryIconImages'
            }
          ]
        },
        // Group
        {
          model: models.Group,
          include: [
            {
              model: models.Category,
              required: false
            },
            {
              model: models.Community,
              attributes: ['id','name','theme_id'],
              required: false
            }
          ]
        },
        // User
        {
          model: models.User,
          required: false,
          attributes: models.User.defaultAttributesWithSocialMediaPublic
        },
        // Image
        {
          model: models.Image,
          required: false,
          as: 'PostHeaderImages'
        },
        // PointRevision
        {
          model: models.PostRevision,
          required: false
        }
      ]
    }).then(function(posts) {
      res.send(posts);
    }).catch(function(error) {
      log.error("Recommendation Error Domain", { err: error, domainId: req.params.id, userId:  req.user ? req.user.id : -1, errorStatus: 500 });
      res.sendStatus(500);
    });
  });
});


router.get('/communities/:id', auth.can('view community'), auth.isLoggedIn, function(req, res) {

  var options = setupOptions(req);

  options = _.merge(options, {
    community_id: req.params.id
  });

  getCuratedNewsItems(options, function (error, activities, oldestProcessedActivityAt) {
    if (error) {
      log.error("News Feed Error Communities", { err: error, communityId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        activities: activities,
        oldestProcessedActivityAt: oldestProcessedActivityAt
      });
    }
  });
});

router.get('/groups/:id', auth.can('view group'), auth.isLoggedIn, function(req, res) {

  var options = setupOptions(req);

  options = _.merge(options, {
    group_id: req.params.id
  });

  getCuratedNewsItems(options, function (error, activities, oldestProcessedActivityAt) {
    if (error) {
      log.error("News Feed Error Group", { err: error, groupId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        activities: activities,
        oldestProcessedActivityAt: oldestProcessedActivityAt
      });
    }
  });
});

router.get('/posts/:id', auth.can('view post'), auth.isLoggedIn, function(req, res) {

  var options = setupOptions(req);

  options = _.merge(options, {
    post_id: req.params.id
  });

  getCuratedNewsItems(options, function (error, activities, oldestProcessedActivityAt) {
    if (error) {
      log.error("News Feed Error Post", { err: error, postId: req.params.id, userId: req.user.id, errorStatus:  500 });
      res.sendStatus(500);
    } else {
      res.send({
        activities: activities,
        oldestProcessedActivityAt: oldestProcessedActivityAt
      });
    }
  });
});

module.exports = router;