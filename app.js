'use strict';

const parseFb = require('./parse-fb');
const parseSms = require('./parse-sms');

// parseSms.parse('./_export', '', /20160803\.html$/).then(messages => {
// 	console.log(messages);
// }).catch(err => {
// 	console.dir(err);
// });

parseFb.parseFromScrape('').then(() => {
	console.log('done');
});
