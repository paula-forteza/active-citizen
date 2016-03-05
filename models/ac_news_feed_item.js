"use strict";

// Notify user about this object

module.exports = function(sequelize, DataTypes) {
  var AcNewsFeedItem = sequelize.define("AcNewsFeedItem", {
    priority: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {

    defaultScope: {
      where: {
        deleted: false
      }
    },

    indexes: [
      {
        fields: ['post_id','user_id'],
        where: {
          status: 'active'
        }
      },
      {
        fields: ['group_id','user_id'],
        where: {
          status: 'active'
        }
      },
      {
        fields: ['community_id','user_id'],
        where: {
          status: 'active'
        }
      },
      {
        fields: ['domain_id','user_id'],
        where: {
          status: 'active'
        }
      }
    ],

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
        AcNewsFeedItem.belongsTo(models.User);
      }
    }
  });

  return AcNewsFeed;
};
