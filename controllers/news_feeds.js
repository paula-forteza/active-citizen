var express = require('express');
var router = express.Router();
var newsFeedFilter = ("../engine/newsfeed_filter");
var models = require("../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');

// Load current news feed generated from notifications by modified_at
// Get recommendations and insert into the news with the modified_at timestamps
// Get promotions to add to the news feed
// Create high priority job to insert recommendation and promotions to postgres
// Send data back to user

