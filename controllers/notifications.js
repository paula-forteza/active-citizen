var express = require('express');
var router = express.Router();
var models = require("../../models");
var auth = require('../../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');

var getCommonWhereDateOptions = require('../engine/news_feeds/news_feeds_utils').getCommonWhereDateOptions;

var getNotifications = function (req, res, options, callback) {
  options = _.merge(options, {
    dateColumn: 'updated_at'
  });

  if (req.query.afterDate) {
    options = _.merge(options, {
      afterDate: new Date(req.query.afterDate)
    })
  }

  if (req.query.beforeDate) {
    options = _.merge(options, {
      beforeDate: new Date(req.query.beforeDate)
    })
  }

  var where = _.merge({
    user_id: req.user.id
  }, getCommonWhereDateOptions(options));

  models.AcNotification.findAll({
    where: where,
    order: [
      ["updated_at", "desc"],
      [ { model: models.AcActivity, as: 'AcActivities'} ,'created_at', 'desc' ],
      [ { model: models.AcActivity, as: 'AcActivities'}, models.User, { model: models.Image, as: 'UserProfileImages' }, 'created_at', 'asc' ],
      [ { model: models.AcActivity, as: 'AcActivities'}, models.User, { model: models.Organization, as: 'OrganizationUsers' }, { model: models.Image, as: 'OrganizationLogoImages' }, 'created_at', 'asc' ]
    ],
    include: [
      {
        model: models.AcActivity,
        as: 'AcActivities',
        attributes: ['id','type','domain_id'],
        required: true,
        include: [
          {
            model: models.Post,
            required: false,
            attributes: ['id','name','user_id']
          },
          { model: models.User,
            attributes: ["id", "name", "facebook_id", "twitter_id", "google_id", "github_id"],
            required: false,
            include: [
              {
                model: models.Image, as: 'UserProfileImages',
                required: false
              },
              {
                model: models.Organization,
                as: 'OrganizationUsers',
                required: false,
                attributes: ['id', 'name'],
                include: [
                  {
                    model: models.Image,
                    as: 'OrganizationLogoImages',
                    //TODO: Figure out why there are no formats attributes coming through here
                    attributes: ['id', 'formats'],
                    required: false
                  }
                ]
              }
            ]
          },
          {
            model: models.Community,
            required: false,
            attributes: ['id','name']
          },
          {
            model: models.Group,
            required: false,
            attributes: ['id','name']
          },
          {
            model: models.Point,
            required: false,
            attributes: ['id','value','content']
          }
        ]
      }
    ],
    limit: 20
  }).then(function(notifications) {
    var slicedActivitesBecauseOfLimitBug = _.take(notifications, 20);
    res.send({
      notifications: slicedActivitesBecauseOfLimitBug,
      oldestProcessedNotificationAt: slicedActivitesBecauseOfLimitBug.length>0 ? _.last(slicedActivitesBecauseOfLimitBug).created_at : null
    });
    callback();
  }).catch(function(error) {
    callback(error);
  });
};

router.get('/', auth.isLoggedIn, function(req, res) {
  var options = {};
  getNotifications(req, res, options, function (error) {
    if (error) {
      log.error("Notifications Error", { userId: req.user ? req.user.id : null, errorStatus:  500 });
      res.sendStatus(500);
    }
  });
});

module.exports = router;