gh-proxy-worker
===

This project is designed to run on Cloudflare Workers and provides a caching and minification system for files hosted on raw.githubusercontent.com.

Features
--------

* Caches files from raw.githubusercontent.com in Cloudflare R2 Storage
* Option to minify JS and CSS file using https://www.toptal.com