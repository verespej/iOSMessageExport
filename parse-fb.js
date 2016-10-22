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
		type: 'image',
		url: url,
		width: parsed[2],
		height: parsed[3]
	};
}

function parseLinkPreviewFromScrape($, el) {
	let image = $(el).find('.__6n');
	let descriptionNode = $(el).find('.__6l');

	return {
		type: 'link-preview',
		url: image.attr('src'),
		width: image.attr('width'),
		title: $(el).find('.__6k').text(),
		description: descriptionNode.length > 0 ? descriptionNode.text() : '',
		reference: $(el).find('.__6m').text()
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
			timestamp: timestamp,
			source: 'facebook',
			sender: senderName,
			html: '',
			media: []
		};

		if ($(el).hasClass('_4yp9') || $(el).is('[aria-label*="sticker"]')) {
			let mediaInfo = parseImageInfoFromScrape($(el).attr('style'));
			message.html = '<img src="' + mediaInfo.url + '" width="' + mediaInfo.width + '" height="' + mediaInfo.height + '" />';
			message.media.push(mediaInfo);
		} else if ($(el).hasClass('__nm')) {
			let mediaInfo = parseLinkPreviewFromScrape($, el);
			if (!mediaInfo.url) {
				return;
			}
			message.html = '<img src="' + mediaInfo.url + '" width="' + mediaInfo.width + '" /><br />' +
				mediaInfo.title + '<br />' +
				(mediaInfo.description.length > 0 ? mediaInfo.description + '<br />' : '') +
				mediaInfo.reference;
			message.media.push(mediaInfo);
		} else {
			message.html = $(el).html();
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
		return messages;
	});
}

module.exports = {
	parseFromDownload: parseFromDownload,
	parseFromScrape: parseFromScrape
};
