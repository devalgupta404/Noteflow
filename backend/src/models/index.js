// Firebase-only models
const User = require('./User');
const Document = require('./Document');
const Quiz = require('./Quiz');
const Gig = require('./Gig');
const config = require('../config/config');

module.exports = {
  User,
  Document,
  Quiz,
  Gig,
  config
};
