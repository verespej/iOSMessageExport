'use strict';

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = Promise.promisifyAll(require('fs'));
const moment = require('moment');
const path = require('path');

function parseHeader(headerText) {
	let parts = headerText.split(' on ');

	let parsedDate = parts[1];
	parsedDate = parsedDate.substring(parsedDate.indexOf(',') + 1).trim();

	return {
		name: parts[0].trim(),
		date: moment(parsedDate, 'MMMM D, YYYY')
	};
}

function getMomentFromTextTimeString(base, timeText) {
	let parts = timeText.split(':');
	let timestamp = moment(base);
	timestamp.add(parseInt(parts[0], 10), 'h');
	timestamp.add(parseInt(parts[1], 10), 'm');
	timestamp.add(parseInt(parts[2], 10), 's');
	return timestamp;
}

function parseMessageTextAndImages($, el) {
	let images = [];
	$(el).find('img').each((index, img) => {
		images.push($(img).attr('src'));
	});

	let text = $(el).find('.text').html().replace(/\n/g, '<br />');
	let matches = text.match(/&#xFFFC;/ig);
	if (matches) {
		if (matches.length !== images.length) {
			throw new Error('Image spaces in text should match number of images: ' + matches.length + ' !== ' + images.length);
		}
		for (let i = 0; i < matches.length; i++) {
			text = text.replace(/&#xFFFC;/i, '<img src="' + images[i] + '" />');
		};
	}

	return {
		text: text,
		images: images
	};
}

function extractAsJson(fileContent, myPhone, theirPhone) {
	let $ = cheerio.load(fileContent);

	let header = parseHeader($('.title_header').text());

	let messages = [];
	$('.texts > div').each((index, el) => {
		let content = parseMessageTextAndImages($, el);
		messages.push({
			id: $(el).attr('id'),
			timestamp: getMomentFromTextTimeString(header.date, $(el).find('.time').text()).format(),
			source: 'SMS',
			sender: $(el).hasClass('sent') ? myPhone : theirPhone,
			text: content.text,
			images: content.images
		});
	});

	return messages;
}

function parse(exportDir, myPhone, theirPhone, /* optional */ fileFilterRegex) {
	let dirPath = path.join(exportDir, theirPhone);
	fileFilterRegex = fileFilterRegex || /.*\.html$/;
	return fs.readdirAsync(dirPath).then(fileNames => {
		return fileNames.filter(fileName => fileFilterRegex.test(fileName)).reduce((set, fileName) => {
			set.push(fs.readFileAsync(path.join(dirPath, fileName)).then(content => {
				return extractAsJson(content, myPhone, theirPhone);
			}));
			return set;
		}, []);
	}).all();
}

module.exports = {
	parse: parse
};
