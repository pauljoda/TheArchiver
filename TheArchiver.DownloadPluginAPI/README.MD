# Download API Interface

Contains helper methods and base attribute to load plugins for The Archiver
https://github.com/pauljoda/TheArchiver

Extend IDownloadHandler and Implement Download, this is an open ended method, handle it however you'd like.
You are provided the url, the root download location (you should create sub directories specific to this plugin), and the max 
concurrent threads allowed. 

Annotate the class with DownloadHandler, and a comma separated list of base urls this supports, like "https://youtube.com"

