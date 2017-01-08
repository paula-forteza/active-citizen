var models = require('../../../models');
var async = require('async');
var log = require('../../utils/logger');
var _ = require('lodash');
var moment = require('moment');
var i18n = require('../../utils/i18n');
var Backend = require('i18next-node-fs-backend');
var sendOneEmail = require('./emails_utils').sendOneEmail;

var sendPostNew = function (delayedNotification, callback) {
  console.log("sendPostNew");
  console.log("User email: "+delayedNotification.User.email);
  async.forEach(delayedNotification.AcNotifications, function (notification, seriesCallback) {
    console.log("Type: "+notification.AcActivities[0].type);
    console.log("Post name: "+notification.AcActivities[0].Post.name);
    console.log("Domain name: "+notification.AcActivities[0].Domain.name);
    console.log("User name: "+notification.AcActivities[0].User.name);
    seriesCallback();
  }, function (error) {
    callback();
  });
};

var sendPostEndorsement = function (delayedNotification, callback) {
  console.log("sendPostEndorsement");
  console.log("User email: "+delayedNotification.User.email);
  async.forEach(delayedNotification.AcNotifications, function (notification, seriesCallback) {
    console.log("Type: "+notification.AcActivities[0].type);
    console.log("Post name: "+notification.AcActivities[0].Post.name);
    console.log("Domain name: "+notification.AcActivities[0].Domain.name);
    console.log("User name: "+notification.AcActivities[0].User.name);
    seriesCallback();
  }, function (error) {
    callback();
  });
};

var sendPointNew = function (delayedNotification, callback) {
  console.log("sendPointNew");
  console.log("User email: "+delayedNotification.User.email);
  async.forEach(delayedNotification.AcNotifications, function (notification, seriesCallback) {
    console.log("Type: "+notification.AcActivities[0].type);
    console.log("Post name: "+notification.AcActivities[0].Post.name);
    console.log("Domain name: "+notification.AcActivities[0].Domain.name);
    console.log("User name: "+notification.AcActivities[0].User.name);
    seriesCallback();
  }, function (error) {
    callback();
  });
};

var formatNameArray = function (arr){
  var outStr = "";
  if (arr.length === 1) {
    outStr = arr[0];
  } else if (arr.length === 2) {
    //joins all with "and" but no commas
    //example: "bob and sam"
    outStr = arr.join(' & ');
  } else if (arr.length > 2) {
    //joins all with commas, but last one gets ", and" (oxford comma!)
    //example: "bob, joe, and sam"
    outStr = arr.slice(0, -1).join(', ') + ', & ' + arr.slice(-1);
  }
  return outStr;
};

var writeHeader = function (emailUser, headerText) {
  var email = '<div style="padding:8px">'+headerText+'</div>';
  return email;
};

var writeDomainHeader = function (email, domain) {
  email += '<div style="display: flex;margin: 8px;padding: 8px;border solid 1px;background-color: #FFF;color: #222;">';
  email += '<div style="max-width:200px;"><img src="'+domain.getImageFormatUrl(1)+'"/></div>';
  email += '<div style="flex-grow:1"><div>'+domain.name+'</div></div>';
  return email;
};

var writeCommunityHeader = function (email, community) {
  email += '<div style="display: flex;margin: 8px;padding: 8px;border solid 1px;background-color: #FFF;color: #222;">';
  email += '<div style="max-width:200px;"><img src="'+community.getImageFormatUrl(1)+'"/></div>';
  email += '<div style="flex-grow:1"><div>'+community.name+'</div></div>';
  return email;
};

var writeGroupHeader = function (email, group) {
  email += '<div style="display: flex;margin: 8px;padding: 8px;border solid 1px;background-color: #FFF;color: #222;">';
  email += '<div style="max-width:200px;"><img src="'+group.getImageFormatUrl(1)+'"/></div>';
  email += '<div style="flex-grow:1"><div>'+group.name+'</div></div>';
  return email;
};

var writePostHeader = function (email, post) {
  email += '<div style="padding:8px">'+post.name+'</div>';
  return email;
};

var writePointHeader = function (email, point) {
  email += '<div style="padding:8px">'+point.content+'</div>';
  return email;
};

var writePointQualities = function (email, helpfulNames, unhelpfulNames) {
  if (helpfulNames && helpfulNames.length>0) {
    email += '<div style="padding:8px">'+i18n.t('notification.email.foundHelpful')+': '+formatNameArray(helpfulNames)+'</div>';
  }
  if (unhelpfulNames && unhelpfulNames.length>0) {
    email += '<div style="padding:8px">'+i18n.t('notification.email.foundNotHelpful')+': '+formatNameArray(unhelpfulNames)+'</div>';
  }
  return email;
};

var writeFooter = function (email, emailUser) {

  return email;
};

var setLanguage = function (user, defaultLocaleObject, item, callback) {
  var locale;

  if (user.default_locale && user.default_locale != "") {
    locale = user.default_locale;
  } else if (defaultLocaleObject && defaultLocaleObject.default_locale && defaultLocaleObject.default_locale != "") {
    locale = defaultLocaleObject.default_locale;
  } else if (item.Community && item.Community.default_locale && item.Community.default_locale != "") {
    locale = item.Community.default_locale;
  } else if (item.Domain && item.Domain.default_locale && item.Domain.default_locale != "") {
    locale = item.Domain.default_locale;
  } else {
    locale = 'en';
  }
  log.info("Process delayed notifications selected locale", {locale: locale});

  i18n.changeLanguage(locale, function (err, t) {
    callback(err);
  });
};

var sendPointQuality = function (delayedNotification, callback) {
  console.log("SendPointQuality User email: "+delayedNotification.User.email);

  var emailUser = delayedNotification.User;
  var items = [];
  var email;

  async.forEach(delayedNotification.AcNotifications, function (notificationWithId, seriesCallback) {
    models.AcNotification.find({
      where: {
        id: notificationWithId.id
      },
      order: [
        [ { model: models.AcActivity, as: 'AcActivities' }, models.Post, { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ],
        [ { model: models.AcActivity, as: 'AcActivities' }, models.Domain, { model: models.Image, as: 'DomainLogoImages' } ,'updated_at', 'asc' ],
        [ { model: models.AcActivity, as: 'AcActivities' }, models.Community, { model: models.Image, as: 'CommunityLogoImages' } ,'updated_at', 'asc' ],
        [ { model: models.AcActivity, as: 'AcActivities' }, models.Group, { model: models.Image, as: 'GroupLogoImages' } ,'updated_at', 'asc' ]
      ],
      include: [
        {
          model: models.AcActivity, as: 'AcActivities',
          required: true,
          where: {
            deleted: false
          },
          include: [
            {
              model: models.User,
              required: true
            },
            {
              model: models.Post,
              required: false,
              include: [
                { model: models.Image,
                  as: 'PostHeaderImages',
                  required: false
                }
              ]
            },
            {
              model: models.Domain,
              required: true,
              include: [
                {
                  model: models.Image,
                  as: 'DomainLogoImages',
                  required: false
                }
              ]
            },
            {
              model: models.Community,
              required: true,
              include: [
                {
                  model: models.Image,
                  as: 'CommunityLogoImages',
                  required: false
                }
              ]
            },
            {
              model: models.Group,
              required: true,
              include: [
                {
                  model: models.Image,
                  as: 'GroupLogoImages',
                  required: false
                }
              ]
            },
            {
              model: models.Point,
              required: false,
              include: [
                {
                  model: models.Post,
                  required: false
                }
              ]
            }
          ]
        }
      ]
    }).then(function (notification) {
      if (notification) {
        var post;
        if (!notification.AcActivities[0].Post && notification.AcActivities[0].Point.Post) {
          post = notification.AcActivities[0].Point.Post;
        } else if (notification.AcActivities[0].Post) {
          post = notification.AcActivities[0].Post;
        }
        if (post && notification.AcActivities[0].Point) {
          items.push({
            notification_type: notification.type,
            notification_id: notification.id,
            domain_id: notification.AcActivities[0].domain_id,
            Domain: notification.AcActivities[0].Domain,
            community_id: notification.AcActivities[0].community_id,
            Community: notification.AcActivities[0].Community,
            group_id: notification.AcActivities[0].group_id,
            Group: notification.AcActivities[0].Group,
            post_id: post.id,
            Post: post,
            point_id: notification.AcActivities[0].point_id,
            Point: notification.AcActivities[0].Point,
            User: notification.AcActivities[0].User,
            created_at: notification.AcActivities[0].created_at,
            AcActivities: notification.AcActivities
          });
          /*console.log("Type: "+notification.AcActivities[0].type);
           console.log("Post name: "+post.name);
           console.log("Point content: "+notification.AcActivities[0].Point.content);
           console.log("Domain name: "+notification.AcActivities[0].Domain.name);
           console.log("User name: "+notification.AcActivities[0].User.name);*/
          seriesCallback();
        } else {
          console.log("can't find post");
          seriesCallback()
        }
      } else {
        console.error("No notification");
        seriesCallback();
      }
    }).catch(function (error) {
      seriesCallback(error);
    });
  }, function (error) {
    if (items.length>0) {
      setLanguage(emailUser, null, items[0], function () {
        email = writeHeader(emailUser, i18n.t('notifications.email.pointQualities'));
        var domains = _.groupBy(items, 'domain_id');
        var firstDomain, firstCommunity;
        _.forEach(domains, function (domainCommunities, domain) {
          domain = domainCommunities[0].Domain;
          if (!firstDomain) {
            firstDomain = domain;
            firstCommunity = domainCommunities[0].Community;
          }
          console.log(domain.name);

          setLanguage(emailUser, domain, domainCommunities[0], function () {
            email = writeDomainHeader(email, domain);
            var communities = _.groupBy(domainCommunities, 'community_id');
            _.forEach(communities, function (communityGroups, community) {
              community = communityGroups[0].Community;
              console.log(community.name);

              setLanguage(emailUser, community, domainCommunities[0], function () {
                email = writeCommunityHeader(email, community);
                var groups = _.groupBy(communityGroups, 'group_id');
                _.forEach(groups, function (groupPosts, group) {
                  group = groupPosts[0].Group;
                  console.log(group.name);
                  email = writeGroupHeader(email, group);
                  var posts = _.groupBy(groupPosts, 'post_id');
                  _.forEach(posts, function (postPoints, post) {
                    post = postPoints[0].Post;
                    console.log(post.name);
                    email = writePostHeader(email, post);

                    var points = _.groupBy(postPoints, 'point_id');
                    _.forEach(points, function (pointsIn, point) {
                      point = pointsIn[0].Point;
                      console.log(point.content);
                      email = writePointHeader(email, point);

                      var helpfulUserNames = [];
                      var unhelpfulUserNames = [];
                      var pointIdsCollected = [];
                      var orgPointIdsCollected = [];
                      var activityIdsCollected = [];
                      _.forEach(pointsIn, function (point) {
                        orgPointIdsCollected.push(point.point_id);
                        console.log("Notification type: "+point.notification_type);
                        _.forEach(point.AcActivities, function (activity) {
                          if (activity.point_id==point.point_id) {
                            if (activity.type=="activity.point.helpful.new") {
                              helpfulUserNames.push(activity.User.name);
                            } else if (activity.type=="activity.point.unhelpful.new") {
                              unhelpfulUserNames.push(activity.User.name)
                            } else {
                              console.error("Unexpected activity type: "+activity.type);
                            }
                            pointIdsCollected.push(activity.point_id);
                            activityIdsCollected.push(activity.id);
                          } else {
                            console.error("Wrong point id for notificationId: "+point.notification_id);
                          }
                        });
                      });
                      helpfulUserNames = _.uniq(helpfulUserNames);
                      unhelpfulUserNames = _.uniq(unhelpfulUserNames);
                      if (helpfulUserNames.length>4) {
                        var c = orgPointIdsCollected;
                        var b = activityIdsCollected;
                        var a = pointIdsCollected;
                      }
                      email = writePointQualities(email, point, helpfulUserNames, unhelpfulUserNames);

                      console.log("Helpful: "+helpfulUserNames.join(','));
                      console.log("Not helpful: "+unhelpfulUserNames.join(','));
                    });
                    console.log("1");
                  });
                  console.log("2");
                });
                console.log("3");
              });
            });
            console.log("4");
          });
        });
        console.log("5");
        email = writeFooter(email, emailUser);
        var emailLocals = {
          subject: { translateToken: 'notifications.email.pointQualities' },
          template: 'delayed_notification',
          user: emailUser,
          domain: firstDomain,
          community: firstCommunity,
          emailContents: email
        };
        sendOneEmail(emailLocals, callback);
      });
    } else {
      console.error("No items");
      callback();
    }
  });
};

var sendPointNewsStory = function (delayedNotification, callback) {
  console.log("sendPointNewsStory");
  console.log("User email: "+delayedNotification.User.email);
  async.forEach(delayedNotification.AcNotifications, function (notification, seriesCallback) {
    console.log("Type: "+notification.AcActivities[0].type);
    console.log("Post name: "+notification.AcActivities[0].Post.name);
    console.log("Domain name: "+notification.AcActivities[0].Domain.name);
    console.log("User name: "+notification.AcActivities[0].User.name);
    seriesCallback();
  }, function (error) {
    callback();
  });
};

var sendPointComment = function (delayedNotification, callback) {
  console.log("sendPointComment");
  console.log("User email: "+delayedNotification.User.email);
  async.forEach(delayedNotification.AcNotifications, function (notification, seriesCallback) {
    console.log("Type: "+notification.AcActivities[0].type);
    console.log("Post name: "+notification.AcActivities[0].Post.name);
    console.log("Domain name: "+notification.AcActivities[0].Domain.name);
    console.log("User name: "+notification.AcActivities[0].User.name);
    seriesCallback();
  }, function (error) {
    callback();
  });
};

var sendNotification = function (notification, callback) {
  switch(notification.type) {
    case "xnotification.post.new":
      sendPostNew(notification, callback);
      break;
    case "xnotification.post.endorsement":
      sendPostEndorsement(notification, callback);
      break;
    case "xnotification.point.new":
      sendPointNew(notification, callback);
      break;
    case "notification.point.quality":
      sendPointQuality(notification, callback);
      break;
    case "xnotification.point.newsStory":
      sendPointNewsStory(notification, callback);
      break;
    case "xnotification.point.comment":
      sendPointComment(notification, callback);
      break;
    default:
//      callback("Unknown notification type");
      callback();
  }
};

var getDelayedNotificationToProcess = function (frequency, callback) {
  var beforeDate;
  if (frequency==1) {
    console.log("Processing hourly");
    beforeDate = {name: "date", after: moment().add(-1, 'hours').toDate()};
  } else if (frequency==2) {
    console.log("Processing daily");
    beforeDate = { name:"date", after: moment().add(-1, 'days').toDate() };
  } else if (frequency==3) {
    console.log("Processing weekly");
    beforeDate = { name:"date", after: moment().add(-7, 'days').toDate() };
  } else if (frequency==4) {
    console.log("Processing monthly");
    beforeDate = { name:"date", after: moment().add(-1, 'months').toDate() };
  }

  if (beforeDate) {
    models.AcDelayedNotification.findAll({
      where: {
        frequency: frequency,
        delivered: false,
        created_at: {
          $lt: beforeDate
        }
      },
      include: [
        {
          model: models.User,
          required: true
        },
        {
          model: models.AcNotification, as: 'AcNotifications',
          attributes: ['id'],
          required: true
        }
      ]
    }).then(function (delayedNotifications) {
      async.forEach(delayedNotifications, function (delayedNotification, seriesCallback) {
        sendNotification(delayedNotification, seriesCallback);
      }, function (error) {
        callback(error);
      });
    }).catch(function (error) {
      callback(error);
    });
  } else {
    callback("Unknown frequency state");
  }
};

var path = require('path');
var localesPath = path.resolve(__dirname, '../../locales');

i18n
  .use(Backend)
  .init({
    preload: ['en','is','hr','pl','no'],

    fallbackLng:'en',

    // this is the defaults
    backend: {
      // path where resources get loaded from
      loadPath: localesPath+'/{{lng}}/translation.json',

      // path to post missing resources
      addPath: localesPath+'/{{lng}}/translation.missing.json',

      // jsonIndent to use when storing json files
      jsonIndent: 2
    }
  }, function (err, t) {
    log.info("Have Loaded i18n", {err: err});

    async.eachSeries([1,2,3,4], function (frequency, seriesCallback) {
      getDelayedNotificationToProcess(frequency, seriesCallback);
    });
  });


