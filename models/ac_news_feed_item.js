"use strict";

var commonIndexForActivitiesAndNewsFeeds = require('../engine/news_feeds/index_definitions').commonIndexForActivitiesAndNewsFeeds;
var _ = require('lodash');

// Notify user about this object

module.exports = function(sequelize, DataTypes) {

  var AcNewsFeedItem = sequelize.define("AcNewsFeedItem", {
    priority: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        status: 'active',
        deleted: false
      }
    },

    indexes: _.concat(commonIndexForActivitiesAndNewsFeeds, [
      {
        fields: ['ac_notification_id'],
        where: {
          status: 'active',
          deleted: false
        }
      },
      {
        fields: ['ac_activity_id'],
        where: {
          status: 'active',
          deleted: false
        }
      }
    ]),

    underscored: true,

    tableName: 'ac_news_feed_item',

    classMethods: {

      associate: function(models) {
        AcNewsFeedItem.belongsTo(models.Domain);
        AcNewsFeedItem.belongsTo(models.Community);
        AcNewsFeedItem.belongsTo(models.Group);
        AcNewsFeedItem.belongsTo(models.Post);
        AcNewsFeedItem.belongsTo(models.Point);
        AcNewsFeedItem.belongsTo(models.Promotion);
        AcNewsFeedItem.belongsTo(models.AcNotification);
        AcNewsFeedItem.belongsTo(models.AcActivity);
        AcNewsFeedItem.belongsTo(models.User);
      }
    }
  });

  return AcNewsFeedItem;
};
