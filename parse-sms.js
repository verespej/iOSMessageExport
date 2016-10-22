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

function parseMessageTextAndMedia($, el, dirPath) {
	let media = [];
	$(el).find('img').each((index, img) => {
		media.push({
			type: 'image',
			url: 'file://' + path.join(dirPath, $(img).attr('src'))
		});
	});
	$(el).find('video > source').each((index, vid) => {
		media.push({
			type: 'video',
			url: 'file://' + path.join(dirPath, $(vid).attr('src'))
		});
	});

	let html = $(el).find('.text').html().replace(/\n/g, '<br />');
	let matches = html.match(/&#xFFFC;/ig);
	if (matches) {
		if (matches.length !== media.length) {
			console.log($(el).html());
			console.log(html);
			throw new Error('Image spaces in html should match number of media items: ' + matches.length + ' !== ' + media.length);
		}
		for (let i = 0; i < matches.length; i++) {
			if (media[i].type === 'image') {
				html = html.replace(/&#xFFFC;/i, '<img src="' + media[i].url + '" />');
			} else if (media[i].type === 'video') {
				html = html.replace(/&#xFFFC;/i, '<video controls><source src="' + media[i].url + '" /></video>');
			}
		};
	}

	return {
		html: html,
		media: media
	};
}

function extractAsJson(fileName, fileContent, theirPhone, myPhone, dirPath) {
	let $ = cheerio.load(fileContent);

	let header = parseHeader($('.title_header').text());
	// Base date in header is incorrect due to UTC mis-use
	let baseTimestamp = moment(/(\d{8})\.html$/.exec(fileName)[1], 'YYYYMMDD');

	let messages = [];
	$('.texts > div').each((index, el) => {
		let content = parseMessageTextAndMedia($, el, dirPath);
		messages.push({
			id: $(el).attr('id'),
			timestamp: getMomentFromTextTimeString(baseTimestamp, $(el).find('.time').text()),
			source: 'sms',
			sender: $(el).hasClass('sent') ? myPhone : theirPhone,
			html: content.html,
			media: content.media
		});
	});

	return messages;
}

function parse(exportDir, theirPhone, myPhone, /* optional */ fileFilterRegex) {
	let dirPath = path.resolve(process.cwd(), exportDir, theirPhone);
	fileFilterRegex = fileFilterRegex || /.*\.html$/;
	return fs.readdirAsync(dirPath).then(fileNames => {
		return fileNames.filter(fileName => fileFilterRegex.test(fileName)).reduce((set, fileName) => {
			set = set.concat(fs.readFileAsync(path.join(dirPath, fileName)).then(content => {
				return extractAsJson(fileName, content, theirPhone, myPhone, dirPath);
			}));
			return set;
		}, []);
	}).all().then(results => {
		// This is an array of arrays since it's the result of evaluating promises
		return results.reduce((flattened, entry) => {
			flattened = flattened.concat(entry);
			return flattened;
		}, []);
	});
}

module.exports = {
	parse: parse
};
