var models = require('../../models');
var async = require('async');
var ip = require('ip');
var fs = require('fs');
var removeDiacritics = require('diacritics').remove;

var shuffleArray = function (array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

var clean = function (string) {
  string = string.replace(/(\r\n|\n|\r)/gm," ");
  string = string.replace(',',' ');
  string = string.replace('\n',' ');
  string = string.replace(/\'/g,' ');
  string = string.replace(/\,/g,' ');
  string = string.replace(/\(/g,' ');
  string = string.replace(/\)/g,' ');
  string = string.replace(/\./g,' ');
  string = string.replace(/['"]+/g, '');
  string = string.replace("  "," ");
  string = string.replace("   "," ");
  string = string.replace("    "," ");
  string = string.replace(/<a\b[^>]*>(.*?)<\/a>/i,"");
  string = removeDiacritics(string);
  string = string.replace(/[^A-Za-z0-9(),!?\'\`]/, ' ');
  return string;
};

var trainCategoriesCsv;
var testCategoriesCsv;
var classesCategoriesCsv;

var trainCategoriesCsvFilename = 'datasets/better_reykjavik/categories/train.csv';
var testCategoriesCsvFilename = 'datasets/better_reykjavik/categories/test.csv';
var classesCategoriesCsvFilename = 'datasets/better_reykjavik/categories/classes.csv';
var categories = {};
var categoriesIds = [];

MAX_CATEGORY_LENGTH = 1500;

var replaceCategoryId = function (id) {
  if ([1,2,19,24,18,16,20,23,17,21,13,25,22,14].indexOf(id) > -1) {
    return 2;
  } else {
    switch(id) {
      case 4:
        return 1;
        break;
      case 3:
        return 3;
        break;
      case 15:
        return 4;
        break;
      case 11:
        return 5;
        break;
      case 8:
        return 6;
        break;
      case 9:
        return 7;
        break;
      case 10:
        return 8;
        break;
      case 12:
        return 9;
        break;
      case 5:
        return 10;
        break;
      case 26:
        return 11;
        break;
      case 6:
        return 12;
        break;
      case 7:
        return 13;
        break;
    }
  }
};

async.series([
  function(callback) {
    var categoriesCsvRows = [];

    models.Post.findAll(
      {
        include: [
          models.Point,
          {
            model: models.Group,
            required: true,
            include: [
              {
                model: models.Community,
                required: true,
                include: [
                  {
                    model: models.Domain,
                    required: true,
                    where: {
                      id: 1
                    }
                  }
                ]
              }
            ]
          }
        ]
      }).then(function (posts) {
      console.log('Found '+posts.length+" posts");
      async.eachSeries(posts, function (post, seriesCallback) {
        var newId = replaceCategoryId(post.category_id);
        if (newId) {
          if (!categories[newId]) {
            categories[newId] = [];
            categoriesIds.push(newId);
          }
          var content;
          if (post.description) {
            content = '"'+clean(post.name) + ' ' + clean(post.description)+'"';
          } else {
            content = '"'+clean(post.name)+'"';
          }
          categories[newId].push(content);
          async.eachSeries(post.Points, function (point, innerSeriesCallback) {
            if (point.value!=0) {
              content = '"'+clean(point.content)+'"';
              categories[newId].push(content);
            }
            innerSeriesCallback();
          }, function () {
            seriesCallback();
          });
        } else {
          seriesCallback();
        }
      }, function () {
        async.eachSeries(categoriesIds, function (category_id, seriesCallback) {
          console.log(category_id);
          console.log("-----"+category_id+"---------------------------: "+categories[category_id].length);
          if (categories[category_id].length>MAX_CATEGORY_LENGTH) {
            categories[category_id] = categories[category_id].splice(0,MAX_CATEGORY_LENGTH);
            console.log("-----"+category_id+"---------------------------: "+categories[category_id].length);
          }
          async.eachSeries(categories[category_id], function (post, innerSeriesCallback) {
            categoriesCsvRows.push(category_id+','+post);
            console.log("Key: "+category_id+" value: "+post);
            innerSeriesCallback();
          }, function () {
            seriesCallback();
          });
        }, function () {
          trainCategoriesCsv = shuffleArray(categoriesCsvRows);
          testCategoriesCsv = trainCategoriesCsv.splice(0,categoriesCsvRows.length*0.1);
          callback();
        });
      });
    }).catch(function(error) {
      console.log("ERROR: "+error);
    }) ;
  },
  function(callback) {
    fs.writeFile(trainCategoriesCsvFilename, trainCategoriesCsv.join('\n'), function(err) {
      if(err) {
         console.log(err);
      }
      callback();
    });
  },
  function(callback) {
    fs.writeFile(testCategoriesCsvFilename, testCategoriesCsv.join('\n'), function(err) {
      if(err) {
        console.log(err);
      }
      callback();
    });
  },
  function(callback) {
    classesCategoriesCsv = [];
    async.eachSeries(categoriesIds, function (category_id, seriesCallback) {
      models.Category.find({
        where: {id: category_id}
      }).then(function (category) {
        classesCategoriesCsv.push(category.id + ',' + category.name);
        seriesCallback();
      });
    }, function () {
      callback();
    });
  },
  function(callback) {
    fs.writeFile(classesCategoriesCsvFilename, classesCategoriesCsv.join('\n'), function(err) {
      if(err) {
        console.log(err);
      }
      callback();
    });
  }
], function (error) {
  console.log("FINISHED :)");
});
