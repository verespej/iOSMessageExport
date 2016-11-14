'use strict';

const parseFb = require('./parse-fb');
const parseSms = require('./parse-sms');

// TODO:
// * In FB, link text and link preview are sometimes displayed in reverse order
// * In FB, emojis are shown twice
// * FB images from scrape have expiring links - need to download all the images
// * SMS unicode emojis don't display in iOS font

const theirPhone = '+';
const myPhone = '+';
const myName = 'Hakon Verespej';

function compareMessagesByTimestamp(left, right) {
	return left.timestamp.isBefore(right.timestamp) ? -1 : left.timestamp.isSame(right.timestamp) ? 0 : 1;
}

let messages = [];
parseSms.parse('./_export', theirPhone, myPhone, /201506\d\d\.html$/).then(smsMessages => {
	messages = smsMessages;
	return parseFb.parseFromScrape('./data-fb/extracted-conversation-with-nev.html');
}).then(fbMessages => {
	messages = messages.concat(fbMessages);
	messages.sort(compareMessagesByTimestamp);
	console.log('<html>');
	console.log('<head>');
	console.log('<link rel="stylesheet" type="text/css" href="style.css">');
	console.log('</head>');
	console.log('<body>');
	console.log('<div class="display-container">')
	messages.forEach(message => {
		let sentTo = message.sender === myPhone || message.sender === myName ? 'to-them' : 'to-me';
		let classes = 'message ' + message.source + ' ' + sentTo + (message.media.length > 0 ? ' media' : '');
		console.log('<div class="message-group">');
		console.log('<div class="' + classes + '">');
		console.log(message.html);
		console.log('</div>');
		console.log('</div>');
	});
	console.log('</div>');
	console.log('</body>');
	console.log('</html>');
}).catch(err => {
	console.dir(err);
});
