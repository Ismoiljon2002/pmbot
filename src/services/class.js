const Class = require('../models/Class');

exports.createClass = async (data) => {
  return Class.create(data);
};

exports.getAllClasses = async () => {
  return Class.find();
};
