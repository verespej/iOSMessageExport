'use strict';

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = Promise.promisifyAll(require('fs'));
const moment = require('moment');
const nodeUrl = require('url');
const path = require('path');

function filterThreadsFromDownload($, targetParticipants, exclusive) {
	let threads = [];
	$('.thread').each((index, el) => {
		let participants = $(el).clone().find('>*').remove().end().text().split(',').map(item => {
			return item.trim();
		});

		// Make sure all target participants are present
		for (let i = 0; i < targetParticipants.length; i++) {
			if (participants.indexOf(targetParticipants[i]) < 0) {
				return;
			}
		}

		if (exclusive && participants.length !== targetParticipants.length) {
			return;
		}

		// Create a list of everyone who sent a message in the thread
		// May contain multiple names for the same user if they changed username
		// May not contain some participants if any participants didn't send any messages
		let senderAliasMap = {};
		$(el).find('.user').each((index, el) => {
			let name = $(el).text();
			senderAliasMap[name] = true;
		});
		let senderAliases = Object.keys(senderAliasMap);

		threads.push({
			participants: participants,
			senderAliases: senderAliases,
			el: el
		});

		if (exclusive) {
			// Don't need to iterate further
			return false;
		}
	});

	return threads;
}

function parseFromDownload(exportDir, targetParticipants, /* optional */ exclusive) {
	exclusive = !!exclusive;
	return fs.readFileAsync(path.join(exportDir, 'html/messages.htm')).then(content => {
		let $ = cheerio.load(content);
		let threads = filterThreadsFromDownload($, targetParticipants, exclusive);
		// TODO: Extract JSON
	});
}

function parseImageInfoFromScrape(text) {
	let rgx = /background-image:[ ]?url\("([^"]+)"\);.*(?:width|height):[ ]? (\d+px);.*(?:width|height):[ ]?(\d+px);/;
	let parsed = rgx.exec(text);

	let url = parsed[1];
	if (!/^http[s]?:\/\//.test(url)) {
		url = nodeUrl.resolve('https://www.facebook.com', url);
	}

	return {
		url: url,
		width: parsed[2],
		height: parsed[3]
	};
}

function parseLinkPreviewFromScrape($, el) {
	let image = $(el).find('.__6n');
	let descriptionNode = $(el).find('.__6l');

	return {
		title: $(el).find('.__6k').text(),
		description: descriptionNode.length > 0 ? descriptionNode.text() : '',
		reference: $(el).find('.__6m').text(),
		imageUrl: image.attr('src'),
		imageDimension: image.attr('width')
	};
}

function parseMessageGroup($, messageGroupEl) {
	let baseId = $(messageGroupEl).attr('id');
	let timestamp = moment($(messageGroupEl).find('._35').attr('data-utime') * 1000);
	let senderName = $(messageGroupEl).find('._36').text();

	let messages = [];
	$(messageGroupEl).find('._38 > span,._4yp9,[aria-label*="sticker"],.__nm').each((i, el) => {
		let message = {
			id: baseId + '.' + i,
			timestamp: timestamp.format(),
			source: 'Facebook',
			sender: senderName,
			text: '',
			images: []
		};

		if ($(el).hasClass('_4yp9') || $(el).is('[aria-label*="sticker"]')) {
			let imageInfo = parseImageInfoFromScrape($(el).attr('style'));
			message.text = '<img src="' + imageInfo.url + '" width="' + imageInfo.width + '" height="' + imageInfo.height + '" />';
			message.images.push(imageInfo.url);
		} else if ($(el).hasClass('__nm')) {
			let previewInfo = parseLinkPreviewFromScrape($, el);
			if (!previewInfo.imageUrl) {
				return;
			}
			message.text = '<img src="' + previewInfo.imageUrl + '" width="' + previewInfo.imageDimension + '" /><br />' +
				previewInfo.title + '<br />' +
				(previewInfo.description.length > 0 ? previewInfo.description + '<br />' : '') +
				previewInfo.reference;
			message.images.push(previewInfo.imageUrl);
		} else {
			message.text = $(el).html();
		}

		messages.push(message);
	});

	return messages;
}

function parseFromScrape(filePath) {
	return fs.readFileAsync(filePath).then(content => {
		let $ = cheerio.load(content);
		let messages = [];
		$('.webMessengerMessageGroup').each((i, el) => {
			messages = messages.concat(parseMessageGroup($, el));
		});
	});
}

module.exports = {
	parseFromDownload: parseFromDownload,
	parseFromScrape: parseFromScrape
};
