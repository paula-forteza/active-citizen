var commonIndexForActivitiesAndNewsFeeds = [
  {
    fields: ['type','user_id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['post_id','user_id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['group_id','user_id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['community_id','user_id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['domain_id','user_id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['type','user_id','updated_at','id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['post_id','user_id','updated_at','id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['group_id','user_id','updated_at','id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['community_id','user_id','updated_at','id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['domain_id','user_id','updated_at','id'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['type','user_id','updated_at'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['post_id','user_id','updated_at'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['group_id','user_id','updated_at'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['community_id','user_id','updated_at'],
    where: {
      status: 'active',
      deleted: false
    }
  },
  {
    fields: ['domain_id','user_id','updated_at'],
    where: {
      status: 'active',
      deleted: false
    }
  }
];

module.exports = {
  commonIndexForActivitiesAndNewsFeeds: commonIndexForActivitiesAndNewsFeeds
};