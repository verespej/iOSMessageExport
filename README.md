iOSMessageExport
================
Notes

* Emojis would only show up when viewing the pages in Safari. 
* Images and videos are visible within the message threads, but all other content is linked. 
* Files are overwritten without checking to see if one already exists. 
* If you get an error about the DateTime module, please see this CPAN article on installing modules: http://www.cpan.org/modules/INSTALL.html
* This does not support group texts. It just adds the text sent from a user to that user's thread with you. This is basically a bug, but I haven't figured out how to do group texts yet. 

Basic steps: 

1. Create a local back up of your iPhone data via iTunes (https://support.apple.com/en-us/HT203977)
1. Find your iPhone backup data. This is most likely in /Users/[username]/Library/Application Support/MobileSync/Backup/f8c0f686125a05acdefb3ca867502ec6213ec757/. Note: Text messages are contained in 3d0d7e5fb2ce288813306e4d4636395e047a3d28.
1. Clone this repo and cd into the directory created by the clone.
1. Copy the backup folder into this directory.
1. Run backup.pl, passing the backup directory:
	```
	perl iOSMessageExport/backup.pl --directory_path [whatever your copied directory is called]
	```
	If you see an error that iOSSMSBackup cannot be found, you may need to run 
	```
	export PERLLIB=iOSMessageExport/
	```
1. View the resulting content in the newly-created folder, "_export"

